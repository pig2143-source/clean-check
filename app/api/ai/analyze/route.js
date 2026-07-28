import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

function clients(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  const publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY
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

export async function POST(request){
  try{
    const gate=await requireUser(request);if(gate.error)return gate.error
    if(!process.env.OPENAI_API_KEY) return NextResponse.json({error:'尚未設定 OPENAI_API_KEY。'},{status:503})
    const {submissionId}=await request.json()
    if(!submissionId) return NextResponse.json({error:'缺少 submissionId。'},{status:400})

    const {data:submission,error:subError}=await gate.admin.from('cleaning_submissions')
      .select('id,staff_id,photo_path,cleaning_tasks(name,area,photo_angles,instructions)')
      .eq('id',submissionId).single()
    if(subError||!submission) return NextResponse.json({error:'找不到照片紀錄。'},{status:404})
    if(submission.staff_id!==gate.user.id&&gate.profile?.role!=='manager') return NextResponse.json({error:'沒有權限分析此照片。'},{status:403})

    await gate.admin.from('cleaning_submissions').update({ai_status:'analyzing',ai_error:null}).eq('id',submissionId)
    const {data:signed,error:signedError}=await gate.admin.storage.from('cleaning-photos').createSignedUrl(submission.photo_path,600)
    if(signedError||!signed?.signedUrl) throw new Error('無法讀取清潔照片。')

    const task=submission.cleaning_tasks||{}
    const prompt=`你是餐飲業清潔稽核助理。請只根據照片中可見內容分析，不可假裝看見被遮擋或照片外的區域。\n清潔項目：${task.name||'未提供'}\n區域：${task.area||'未提供'}\n建議角度：${task.photo_angles||'未提供'}\nSOP：${task.instructions||'未提供'}\n評估油污、水漬、垃圾/雜物，並給 0-100 分。照片模糊、過暗、角度不完整時降低 image_quality 並將 verdict 設為 review。severity：0無、1輕微、2明顯、3嚴重。AI 只能輔助主管，不可把不確定內容判定為確定缺失。請使用繁體中文摘要與建議。`

    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:process.env.OPENAI_VISION_MODEL||'gpt-4.1-mini',
        input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:signed.signedUrl,detail:'high'}]}],
        text:{format:{type:'json_schema',name:'cleanliness_analysis',strict:true,schema}},
        max_output_tokens:900
      })
    })
    const raw=await response.json()
    if(!response.ok) throw new Error(raw?.error?.message||'AI 分析服務暫時無法使用。')
    const outputText=raw.output_text||raw.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text
    if(!outputText) throw new Error('AI 沒有回傳分析結果。')
    const result=JSON.parse(outputText)

    const update={
      ai_status:'completed',ai_score:result.score,ai_verdict:result.verdict,
      ai_oil_stain:result.oil_stain,ai_water_stain:result.water_stain,ai_trash:result.trash,
      ai_summary:result.summary,ai_suggestions:result.suggestions,ai_image_quality:result.image_quality,
      ai_model:process.env.OPENAI_VISION_MODEL||'gpt-4.1-mini',ai_analyzed_at:new Date().toISOString(),ai_error:null
    }
    const {error:updateError}=await gate.admin.from('cleaning_submissions').update(update).eq('id',submissionId)
    if(updateError) throw updateError
    return NextResponse.json({ok:true,analysis:result})
  }catch(e){
    try{
      const body=await request.clone().json();if(body?.submissionId){const {admin}=clients();await admin.from('cleaning_submissions').update({ai_status:'failed',ai_error:e.message||'AI 分析失敗'}).eq('id',body.submissionId)}
    }catch{}
    return NextResponse.json({error:e.message||'AI 分析失敗。'},{status:500})
  }
}
