import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

function readServerEnv(){
  const apiKey=(process.env.OPENAI_API_KEY||'').trim()
  const model=(process.env.OPENAI_VISION_MODEL||'gpt-4.1-mini').trim()
  const supabaseUrl=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').trim()
  const supabasePublicKey=(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'').trim()
  const supabaseServiceKey=(process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim()
  return {apiKey,model,supabaseUrl,supabasePublicKey,supabaseServiceKey}
}

function clients(){
  const {supabaseUrl:url,supabasePublicKey:publicKey,supabaseServiceKey:serviceKey}=readServerEnv()
  if(!url||!publicKey||!serviceKey) throw new Error('Supabase 伺服器環境變數尚未設定完整。')
  return {
    auth:createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}}),
    admin:createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
  }
}

async function requireUser(request){
  const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')
  if(!token) return {error:NextResponse.json({error:'尚未登入。'},{status:401})}
  const {auth,admin}=clients()
  const {data:{user},error}=await auth.auth.getUser(token)
  if(error||!user) return {error:NextResponse.json({error:'登入已失效，請重新登入。'},{status:401})}
  const {data:profile}=await admin.from('profiles').select('role').eq('id',user.id).single()
  return {admin,user,profile}
}

const schema={
  type:'object',additionalProperties:false,
  properties:{
    score:{type:'integer',minimum:0,maximum:100},
    verdict:{type:'string',enum:['pass','review','fail']},
    oil_stain:{type:'object',additionalProperties:false,properties:{detected:{type:'boolean'},severity:{type:'integer',minimum:0,maximum:3},confidence:{type:'integer',minimum:0,maximum:100}},required:['detected','severity','confidence']},
    water_stain:{type:'object',additionalProperties:false,properties:{detected:{type:'boolean'},severity:{type:'integer',minimum:0,maximum:3},confidence:{type:'integer',minimum:0,maximum:100}},required:['detected','severity','confidence']},
    trash:{type:'object',additionalProperties:false,properties:{detected:{type:'boolean'},severity:{type:'integer',minimum:0,maximum:3},confidence:{type:'integer',minimum:0,maximum:100}},required:['detected','severity','confidence']},
    summary:{type:'string'},
    suggestions:{type:'array',items:{type:'string'},maxItems:4},
    image_quality:{type:'string',enum:['good','usable','poor']}
  },
  required:['score','verdict','oil_stain','water_stain','trash','summary','suggestions','image_quality']
}

function outputText(raw){
  if(typeof raw?.output_text==='string'&&raw.output_text.trim()) return raw.output_text
  for(const item of raw?.output||[]){
    for(const part of item?.content||[]){
      if(part?.type==='output_text'&&typeof part.text==='string') return part.text
    }
  }
  return ''
}

function validateResult(result){
  if(!result||typeof result!=='object') throw new Error('AI 回傳格式不正確。')
  if(!Number.isInteger(result.score)||result.score<0||result.score>100) throw new Error('AI 評分格式不正確。')
  if(!['pass','review','fail'].includes(result.verdict)) throw new Error('AI 判定格式不正確。')
  return result
}

export async function GET(){
  const env=readServerEnv()
  const openAIEnvNames=Object.keys(process.env).filter(name=>name.toUpperCase().includes('OPENAI')).sort()
  return NextResponse.json({
    ok:true,
    service:'DP Clean AI analysis',
    configured:Boolean(env.apiKey),
    model:env.model,
    runtime:'nodejs',
    deployment:{
      vercelEnv:process.env.VERCEL_ENV||null,
      vercelRegion:process.env.VERCEL_REGION||null,
      commitSha:process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,8)||null
    },
    env:{
      OPENAI_API_KEY:Boolean(env.apiKey),
      OPENAI_VISION_MODEL:Boolean((process.env.OPENAI_VISION_MODEL||'').trim()),
      NEXT_PUBLIC_SUPABASE_URL:Boolean(env.supabaseUrl),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:Boolean(env.supabasePublicKey),
      SUPABASE_SERVICE_ROLE_KEY:Boolean(env.supabaseServiceKey)
    },
    detectedOpenAIEnvNames:openAIEnvNames,
    note:env.apiKey
      ? '伺服器已讀取 OPENAI_API_KEY。'
      : '伺服器未讀取 OPENAI_API_KEY。請重新建立 Production 環境變數，再以最新 main commit 建立新部署。'
  },{headers:{'Cache-Control':'no-store, max-age=0'}})
}

export async function POST(request){
  let submissionId=''
  let admin=null
  try{
    const gate=await requireUser(request)
    if(gate.error)return gate.error
    admin=gate.admin
    const env=readServerEnv()
    if(!env.apiKey) return NextResponse.json({
      error:'伺服器未讀取 OPENAI_API_KEY。',
      code:'OPENAI_API_KEY_MISSING',
      diagnostics:{vercelEnv:process.env.VERCEL_ENV||null,detectedOpenAIEnvNames:Object.keys(process.env).filter(name=>name.toUpperCase().includes('OPENAI')).sort()}
    },{status:503,headers:{'Cache-Control':'no-store'}})

    const body=await request.json().catch(()=>null)
    submissionId=body?.submissionId||''
    if(!submissionId) return NextResponse.json({error:'缺少 submissionId。'},{status:400})

    const {data:submission,error:subError}=await admin.from('cleaning_submissions')
      .select('id,staff_id,photo_path,cleaning_tasks(name,area,photo_angles,instructions)')
      .eq('id',submissionId).single()
    if(subError||!submission) return NextResponse.json({error:'找不到照片紀錄。'},{status:404})
    if(submission.staff_id!==gate.user.id&&gate.profile?.role!=='manager') return NextResponse.json({error:'沒有權限分析此照片。'},{status:403})
    if(!submission.photo_path) return NextResponse.json({error:'此紀錄沒有照片。'},{status:400})

    const started=Date.now()
    const {error:pendingError}=await admin.from('cleaning_submissions').update({ai_status:'analyzing',ai_error:null}).eq('id',submissionId)
    if(pendingError) throw pendingError

    const {data:signed,error:signedError}=await admin.storage.from('cleaning-photos').createSignedUrl(submission.photo_path,600)
    if(signedError||!signed?.signedUrl) throw new Error('無法讀取清潔照片。')

    const task=submission.cleaning_tasks||{}
    const prompt=`你是餐飲業清潔稽核助理。只根據照片可見內容判斷，不推測被遮擋或畫面外區域。\n清潔項目：${task.name||'未提供'}\n區域：${task.area||'未提供'}\n建議角度：${task.photo_angles||'未提供'}\nSOP：${task.instructions||'未提供'}\n請評估油污、水漬、垃圾或雜物，並給 0 到 100 分。照片模糊、過暗或角度不完整時，image_quality 應降低且 verdict 設為 review。severity：0 無、1 輕微、2 明顯、3 嚴重。AI 僅供主管參考，不確定時不可判定為確定缺失。摘要與建議使用繁體中文。`

    const controller=new AbortController()
    const timer=setTimeout(()=>controller.abort(),50000)
    let response
    try{
      response=await fetch('https://api.openai.com/v1/responses',{
        method:'POST',signal:controller.signal,
        headers:{Authorization:`Bearer ${env.apiKey}`,'Content-Type':'application/json'},
        body:JSON.stringify({
          model:env.model,
          input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:signed.signedUrl,detail:'high'}]}],
          text:{format:{type:'json_schema',name:'cleanliness_analysis',strict:true,schema}},
          max_output_tokens:900
        })
      })
    }finally{clearTimeout(timer)}

    const raw=await response.json().catch(()=>({}))
    if(!response.ok) throw new Error(raw?.error?.message||`AI 分析服務錯誤（${response.status}）。`)
    const text=outputText(raw)
    if(!text) throw new Error('AI 沒有回傳分析結果。')
    const result=validateResult(JSON.parse(text))

    const update={
      ai_status:'completed',ai_score:result.score,ai_verdict:result.verdict,
      ai_oil_stain:result.oil_stain,ai_water_stain:result.water_stain,ai_trash:result.trash,
      ai_summary:result.summary,ai_suggestions:result.suggestions,ai_image_quality:result.image_quality,
      ai_model:env.model,ai_analyzed_at:new Date().toISOString(),ai_error:null
    }
    const {error:updateError}=await admin.from('cleaning_submissions').update(update).eq('id',submissionId)
    if(updateError) throw updateError
    return NextResponse.json({ok:true,analysis:result,duration_ms:Date.now()-started})
  }catch(e){
    if(admin&&submissionId){
      await admin.from('cleaning_submissions').update({ai_status:'failed',ai_error:e?.name==='AbortError'?'AI 分析逾時，請稍後重試。':(e.message||'AI 分析失敗')}).eq('id',submissionId)
    }
    const message=e?.name==='AbortError'?'AI 分析逾時，請稍後重試。':(e.message||'AI 分析失敗。')
    return NextResponse.json({error:message},{status:500})
  }
}
