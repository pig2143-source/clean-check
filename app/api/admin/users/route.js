import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function clients(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  const publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!publicKey||!serviceKey) throw new Error('伺服器環境變數尚未設定完整。')
  return {
    auth:createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}}),
    admin:createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
  }
}

async function requireManager(request){
  const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')
  if(!token) return {error:NextResponse.json({error:'尚未登入。'},{status:401})}
  const {auth,admin}=clients()
  const {data:{user},error}=await auth.auth.getUser(token)
  if(error||!user) return {error:NextResponse.json({error:'登入已失效，請重新登入。'},{status:401})}
  const {data:profile}=await admin.from('profiles').select('role').eq('id',user.id).single()
  if(profile?.role!=='manager') return {error:NextResponse.json({error:'僅主管可以執行此操作。'},{status:403})}
  return {admin,user}
}

async function listUsers(admin){
  const {data,error}=await admin.auth.admin.listUsers({page:1,perPage:1000})
  if(error) throw error
  const {data:profiles,error:profileError}=await admin.from('profiles').select('id,display_name,role,created_at')
  if(profileError) throw profileError
  const map=new Map((profiles||[]).map(p=>[p.id,p]))
  return (data.users||[]).map(u=>({
    id:u.id,
    email:u.email||'',
    display_name:map.get(u.id)?.display_name||u.user_metadata?.display_name||'',
    role:map.get(u.id)?.role||'staff',
    created_at:u.created_at,
    last_sign_in_at:u.last_sign_in_at,
    disabled:Boolean(u.banned_until&&new Date(u.banned_until)>new Date())
  })).sort((a,b)=>a.display_name.localeCompare(b.display_name,'zh-Hant'))
}

export async function GET(request){
  try{
    const gate=await requireManager(request);if(gate.error)return gate.error
    return NextResponse.json({users:await listUsers(gate.admin)})
  }catch(e){return NextResponse.json({error:e.message||'讀取員工失敗。'},{status:500})}
}

export async function POST(request){
  try{
    const gate=await requireManager(request);if(gate.error)return gate.error
    const body=await request.json()
    const email=String(body.email||'').trim().toLowerCase()
    const password=String(body.password||'')
    const displayName=String(body.display_name||'').trim()
    const role=body.role==='manager'?'manager':'staff'
    if(!email||!displayName||password.length<8) return NextResponse.json({error:'請填寫姓名、Email，密碼至少 8 碼。'},{status:400})
    const {data,error}=await gate.admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:displayName}})
    if(error) throw error
    const {error:profileError}=await gate.admin.from('profiles').upsert({id:data.user.id,display_name:displayName,role})
    if(profileError){await gate.admin.auth.admin.deleteUser(data.user.id);throw profileError}
    return NextResponse.json({ok:true,user:data.user})
  }catch(e){return NextResponse.json({error:e.message||'新增員工失敗。'},{status:500})}
}

export async function PATCH(request){
  try{
    const gate=await requireManager(request);if(gate.error)return gate.error
    const body=await request.json();const id=String(body.id||'')
    if(!id) return NextResponse.json({error:'缺少使用者 ID。'},{status:400})
    if(body.action==='reset_password'){
      const password=String(body.password||'')
      if(password.length<8) return NextResponse.json({error:'新密碼至少 8 碼。'},{status:400})
      const {error}=await gate.admin.auth.admin.updateUserById(id,{password});if(error)throw error
    }else if(body.action==='toggle_disabled'){
      if(id===gate.user.id) return NextResponse.json({error:'不能停用自己的主管帳號。'},{status:400})
      const {error}=await gate.admin.auth.admin.updateUserById(id,{ban_duration:body.disabled?'none':'876000h'});if(error)throw error
    }else{
      const displayName=String(body.display_name||'').trim();const role=body.role==='manager'?'manager':'staff';const email=String(body.email||'').trim().toLowerCase()
      if(!displayName||!email) return NextResponse.json({error:'姓名與 Email 不可空白。'},{status:400})
      if(id===gate.user.id&&role!=='manager') return NextResponse.json({error:'不能移除自己的主管權限。'},{status:400})
      const {error:userError}=await gate.admin.auth.admin.updateUserById(id,{email,email_confirm:true,user_metadata:{display_name:displayName}});if(userError)throw userError
      const {error:profileError}=await gate.admin.from('profiles').upsert({id,display_name:displayName,role});if(profileError)throw profileError
    }
    return NextResponse.json({ok:true})
  }catch(e){return NextResponse.json({error:e.message||'更新員工失敗。'},{status:500})}
}

export async function DELETE(request){
  try{
    const gate=await requireManager(request);if(gate.error)return gate.error
    const id=new URL(request.url).searchParams.get('id')
    if(!id) return NextResponse.json({error:'缺少使用者 ID。'},{status:400})
    if(id===gate.user.id) return NextResponse.json({error:'不能刪除自己的主管帳號。'},{status:400})
    const {error}=await gate.admin.auth.admin.deleteUser(id);if(error)throw error
    return NextResponse.json({ok:true})
  }catch(e){return NextResponse.json({error:e.message||'刪除員工失敗。'},{status:500})}
}
