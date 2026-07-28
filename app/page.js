'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BarChart3, CalendarDays, Camera, CheckCircle2, ChevronRight, ClipboardCheck, Clock3, Download, History, Home, Image as ImageIcon, KeyRound, ListChecks, LogOut, Pencil, Plus, RefreshCw, Search, Settings, ShieldCheck, Sparkles, Store, Trash2, TrendingUp, Trophy, UserRound, UserX, Users, X, XCircle } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const today = () => new Date().toLocaleDateString('en-CA')
const formatDateTime = value => value ? new Date(value).toLocaleString('zh-TW',{dateStyle:'short',timeStyle:'short'}) : ''
const aiLabel={pass:'AI 建議合格',review:'建議人工確認',fail:'AI 發現疑慮'}

export default function App(){
  const [session,setSession]=useState(null)
  const [profile,setProfile]=useState(null)
  const [loading,setLoading]=useState(true)
  const [page,setPage]=useState('home')
  const [mode,setMode]=useState('tasks')
  const [tasks,setTasks]=useState([])
  const [submissions,setSubmissions]=useState([])
  const [profiles,setProfiles]=useState([])
  const [selected,setSelected]=useState(null)
  const [notice,setNotice]=useState('')
  const [noticeType,setNoticeType]=useState('notice')

  useEffect(()=>{
    if(!isSupabaseConfigured){setLoading(false);return}
    supabase.auth.getSession().then(({data})=>{
      setSession(data.session)
      if(data.session) loadProfile(data.session.user.id)
      else setLoading(false)
    })
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{
      setSession(s)
      if(s) loadProfile(s.user.id)
      else {setProfile(null);setLoading(false)}
    })
    return ()=>subscription.unsubscribe()
  },[])

  useEffect(()=>{if(profile) loadData()},[profile])

  async function loadProfile(id){
    const {data,error}=await supabase.from('profiles').select('*').eq('id',id).single()
    if(error){flash('找不到帳號資料，請先在 profiles 建立此使用者。','error');setLoading(false);return}
    setProfile(data);setLoading(false)
  }

  async function loadData(){
    setLoading(true)
    const queries=[
      supabase.from('cleaning_tasks').select('*').order('sort_order'),
      supabase.from('cleaning_submissions').select('*, cleaning_tasks(name,area,schedule_label), profiles!cleaning_submissions_staff_id_fkey(display_name)').order('created_at',{ascending:false}).limit(300),
      supabase.from('profiles').select('id,display_name,role,created_at').order('display_name')
    ]
    const [t,s,p]=await Promise.all(queries)
    if(t.error||s.error||p.error) flash(t.error?.message||s.error?.message||p.error?.message,'error')
    setTasks(t.data||[]);setSubmissions(s.data||[]);setProfiles(p.data||[]);setLoading(false)
  }

  function flash(text,type='success'){setNotice(text);setNoticeType(type);window.setTimeout(()=>setNotice(''),4500)}
  async function logout(){await supabase.auth.signOut();setPage('home')}

  async function submitTask({file,note}){
    try{
      setLoading(true)
      const ext=(file.name.split('.').pop()||'jpg').toLowerCase()
      const path=`${session.user.id}/${today()}/${selected.id}-${Date.now()}.${ext}`
      const {error:uploadError}=await supabase.storage.from('cleaning-photos').upload(path,file,{contentType:file.type||'image/jpeg',upsert:false})
      if(uploadError) throw uploadError
      const existing=submissions.find(s=>s.task_id===selected.id&&s.work_date===today())
      let submissionId
      if(existing){
        const {data,error}=await supabase.from('cleaning_submissions').update({photo_path:path,note,status:'review',manager_note:'',reviewed_by:null,reviewed_at:null,created_at:new Date().toISOString(),ai_status:'pending',ai_score:null,ai_verdict:null,ai_summary:null,ai_error:null}).eq('id',existing.id).select('id').single()
        if(error) throw error
        submissionId=data.id
      }else{
        const {data,error}=await supabase.from('cleaning_submissions').insert({task_id:selected.id,staff_id:session.user.id,photo_path:path,note,work_date:today(),status:'review',ai_status:'pending'}).select('id').single()
        if(error) throw error
        submissionId=data.id
      }
      const {data:{session:currentSession}}=await supabase.auth.getSession()
      const aiResponse=await fetch('/api/ai/analyze',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${currentSession?.access_token||''}`},body:JSON.stringify({submissionId})})
      const aiBody=await aiResponse.json().catch(()=>({}))
      await loadData();setPage('home');flash(aiResponse.ok?'照片已上傳，AI 分析完成並等待主管審核。':`照片已上傳；AI 分析未完成：${aiBody.error||'請稍後重試'}`,aiResponse.ok?'success':'error')
    }catch(e){flash(e.message||'上傳失敗','error')}finally{setLoading(false)}
  }

  async function retryAI(submissionId){
    try{
      setLoading(true)
      const {data:{session:currentSession}}=await supabase.auth.getSession()
      const response=await fetch('/api/ai/analyze',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${currentSession?.access_token||''}`},body:JSON.stringify({submissionId})})
      const body=await response.json().catch(()=>({}))
      await loadData()
      flash(response.ok?'AI 已重新分析完成。':`AI 重新分析失敗：${body.error||'請稍後重試'}`,response.ok?'success':'error')
    }catch(e){flash(e.message||'AI 重新分析失敗','error')}finally{setLoading(false)}
  }

  async function review(id,status,managerNote=''){
    const {error}=await supabase.from('cleaning_submissions').update({status,manager_note:managerNote,reviewed_by:session.user.id,reviewed_at:new Date().toISOString()}).eq('id',id)
    if(error) flash(error.message,'error');else {await loadData();flash(status==='approved'?'已審核合格。':'已退回重做。')}
  }

  async function saveTask(values,id){
    const payload={name:values.name.trim(),area:values.area.trim(),schedule_label:values.schedule_label.trim(),frequency:values.frequency,deadline_time:values.deadline_time||null,photo_required:values.photo_required,photo_angles:values.photo_angles.trim(),instructions:values.instructions.trim(),assigned_role:values.assigned_role,assigned_staff_id:values.assigned_staff_id||null,sort_order:Number(values.sort_order)||0,active:values.active}
    const result=id?await supabase.from('cleaning_tasks').update(payload).eq('id',id):await supabase.from('cleaning_tasks').insert(payload)
    if(result.error) flash(result.error.message,'error');else {await loadData();flash(id?'清潔項目已更新。':'清潔項目已新增。')}
  }

  async function deleteTask(id){
    if(!window.confirm('確定刪除這個清潔項目？歷史紀錄也會一起刪除。')) return
    const {error}=await supabase.from('cleaning_tasks').delete().eq('id',id)
    if(error) flash(error.message,'error');else {await loadData();flash('清潔項目已刪除。')}
  }

  async function signedUrl(path){
    const {data,error}=await supabase.storage.from('cleaning-photos').createSignedUrl(path,3600)
    if(error) return ''
    return data?.signedUrl||''
  }

  if(!isSupabaseConfigured) return <SetupNeeded/>
  if(loading && !profile) return <Loading/>
  if(!session) return <Login notice={notice}/>
  if(!profile) return <SetupNeeded message={notice}/>

  const canManage=profile.role==='manager'
  const todaySubs=submissions.filter(s=>s.work_date===today())
  const activeTasks=tasks.filter(t=>t.active && (canManage || t.assigned_staff_id===session.user.id || (!t.assigned_staff_id && ['staff','all'].includes(t.assigned_role||'staff'))))
  const taskRows=activeTasks.map(t=>({...t,submission:todaySubs.find(s=>s.task_id===t.id)}))

  return <div className="page">
    {page==='task' ? <TaskPage task={selected} submission={selected?.submission} onBack={()=>setPage('home')} onSubmit={submitTask} loading={loading}/> : <>
      <Header user={profile} onLogout={logout}/>
      <main className="content">
        {notice&&<div className={`notice ${noticeType==='error'?'errorNotice':'successNotice'}`}>{notice}</div>}
        {page==='home'&&<Dashboard rows={taskRows} profile={profile} profiles={profiles} submissions={submissions} mode={mode} setMode={setMode} openTask={t=>{setSelected(t);setPage('task')}} review={review} retryAI={retryAI} signedUrl={signedUrl}/>} 
        {page==='history'&&<HistoryPage submissions={submissions} signedUrl={signedUrl}/>} 
        {page==='manage'&&canManage&&<ManagePage tasks={tasks} profiles={profiles} saveTask={saveTask} deleteTask={deleteTask} currentUserId={session.user.id} flash={flash}/>} 
        {page==='reports'&&canManage&&<ReportsPage submissions={submissions} tasks={tasks} profiles={profiles}/>} 
        {page==='settings'&&<SettingsPage user={profile} reload={loadData} loading={loading}/>} 
      </main>
      <Nav page={page} setPage={setPage} manager={canManage}/>
    </>}
  </div>
}

function BrandMark({compact=false}){return <div className={`brandMark ${compact?'compactMark':''}`} aria-label="DP Clean"><span className="brandDp">DP</span><span className="brandLine"/><span className="brandDapu">大埔</span></div>}
function Login({notice}){
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[remember,setRemember]=useState(true),[resetBusy,setResetBusy]=useState(false)
  useEffect(()=>{const saved=window.localStorage.getItem('dp-clean-email');if(saved)setEmail(saved)},[])
  async function go(e){e.preventDefault();setBusy(true);setError('');if(remember)window.localStorage.setItem('dp-clean-email',email.trim());else window.localStorage.removeItem('dp-clean-email');const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)setError(error.message==='Invalid login credentials'?'Email 或密碼不正確。':error.message);setBusy(false)}
  async function resetPassword(){if(!email.trim()){setError('請先輸入 Email。');return}setResetBusy(true);setError('');const redirectTo=`${window.location.origin}/`;const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo});setResetBusy(false);if(error)setError(error.message);else setError('重設密碼信已寄出，請查看信箱。')}
  return <div className="login dpLogin"><div className="loginAura auraOne"/><div className="loginAura auraTwo"/><form className="loginbox brandLoginCard" onSubmit={go}>
    <div className="brandHero"><BrandMark/><div><h1>DP Clean</h1><p>大埔鐵板燒 屏東民生店</p><span>清潔管理系統</span></div></div>
    <div className="loginDivider"><span/></div>
    {(error||notice)&&<div className={`notice ${(error||'').includes('寄出')?'successNotice':'errorNotice'}`}>{error||notice}</div>}
    <label className="label">Email</label><input className="input brandInput" type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="name@example.com"/>
    <div style={{height:14}}/><label className="label">密碼</label><input className="input brandInput" type="password" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" placeholder="請輸入密碼"/>
    <div className="loginOptions"><label className="remember"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/>記住帳號</label><button type="button" className="textButton" onClick={resetPassword} disabled={resetBusy}>{resetBusy?'寄送中…':'忘記密碼'}</button></div>
    <button className="button goldButton" style={{width:'100%'}} disabled={busy}>{busy?'登入中…':'登入 DP Clean'}</button>
    <div className="loginFooter">DP Clean Enterprise <b>v5.4</b></div>
  </form></div>
}
function SetupNeeded({message}){return <div className="login"><div className="loginbox card"><div className="logo">🔌</div><h2>尚未完成 Supabase 設定</h2><p className="muted">請確認 Vercel 環境變數與 Supabase profiles 設定。</p>{message&&<div className="notice errorNotice">{message}</div>}</div></div>}
function Loading(){return <div className="login"><div className="loginbox card"><h2>載入中…</h2></div></div>}
function Header({user,onLogout}){return <header className="header brandHeader"><div className="row space"><div className="row"><BrandMark compact/><div><div className="headerBrand">DP Clean · 屏東民生店</div><h2 style={{margin:'3px 0'}}>你好，{user.display_name}</h2><div style={{fontSize:13,opacity:.88}}>{user.role==='manager'?'主管模式':'員工模式'} · {new Date().toLocaleDateString('zh-TW')}</div></div></div><button className="topback" onClick={onLogout} aria-label="登出"><LogOut size={20}/></button></div></header>}

function Dashboard({rows,profile,profiles,submissions,mode,setMode,openTask,review,retryAI,signedUrl}){
  const approved=rows.filter(r=>r.submission?.status==='approved').length
  const reviewing=rows.filter(r=>r.submission?.status==='review').length
  const redo=rows.filter(r=>r.submission?.status==='redo').length
  const pending=rows.filter(r=>!r.submission).length
  const completionRate=rows.length?Math.round(approved/rows.length*100):0
  const now=new Date()
  const minutesNow=now.getHours()*60+now.getMinutes()
  const overdueRows=rows.filter(r=>{
    if(r.submission?.status==='approved'||!r.deadline_time) return false
    const [h,m]=String(r.deadline_time).split(':').map(Number)
    return Number.isFinite(h)&&Number.isFinite(m)&&(h*60+m)<minutesNow
  })
  const todaySubs=submissions.filter(s=>s.work_date===today())
  const staffStats=profiles.filter(p=>p.role==='staff').map(p=>{
    const assigned=rows.filter(r=>r.assigned_staff_id===p.id || (!r.assigned_staff_id && ['staff','all'].includes(r.assigned_role||'staff')))
    const own=todaySubs.filter(s=>s.staff_id===p.id)
    const ownApproved=own.filter(s=>s.status==='approved').length
    return {id:p.id,name:p.display_name||'未命名',total:assigned.length,approved:ownApproved,review:own.filter(s=>s.status==='review').length,redo:own.filter(s=>s.status==='redo').length,rate:assigned.length?Math.min(100,Math.round(ownApproved/assigned.length*100)):0}
  }).sort((a,b)=>b.rate-a.rate||b.approved-a.approved)
  const sevenDays=useMemo(()=>{
    const days=[]
    for(let i=6;i>=0;i--){
      const d=new Date();d.setDate(d.getDate()-i)
      const key=d.toLocaleDateString('en-CA')
      const own=submissions.filter(s=>s.work_date===key)
      const ok=own.filter(s=>s.status==='approved').length
      days.push({key,label:d.toLocaleDateString('zh-TW',{weekday:'short'}),rate:own.length?Math.round(ok/own.length*100):0,total:own.length})
    }
    return days
  },[submissions])
  const exceptionRows=[...rows.filter(r=>r.submission?.status==='redo'),...overdueRows.filter(r=>r.submission?.status!=='redo')].slice(0,5)
  return <>
    <div className="dashboardIntro"><div><div className="eyebrow">今日營運總覽</div><h2>全店清潔進度</h2><p>關鍵狀況集中在這一頁，少翻頁、多掌握。</p></div><div className={`scoreRing ${completionRate===100?'complete':''}`} style={{'--score':`${completionRate}%`}}><strong>{completionRate}%</strong><span>完成率</span></div></div>

    <div className="kpiGrid">
      <div className="kpiCard kpiGood"><CheckCircle2/><span>已合格</span><b>{approved}</b></div>
      <div className="kpiCard kpiReview"><Clock3/><span>待審核</span><b>{reviewing}</b></div>
      <div className="kpiCard kpiWarn"><AlertTriangle/><span>逾期</span><b>{overdueRows.length}</b></div>
      <div className="kpiCard kpiPlain"><ListChecks/><span>未完成</span><b>{pending+redo}</b></div>
    </div>

    <div className="card dashboardProgress"><div className="row space"><div><div className="muted">今日總任務</div><h2>{approved} / {rows.length} 項完成</h2></div><Sparkles color="#b68b2f"/></div><div className="progress progressLarge"><div style={{width:`${completionRate}%`}}/></div><div className="progressMeta"><span>待完成 {pending}</span><span>待審核 {reviewing}</span><span>需重做 {redo}</span></div></div>

    {profile.role==='manager'&&<>
      <div className="sectionTitle"><h3><AlertTriangle size={19}/>今日異常</h3><span className="muted">{exceptionRows.length} 項需留意</span></div>
      <div className="card exceptionList">{exceptionRows.length===0?<div className="empty compactEmpty"><CheckCircle2 size={30}/><p>目前沒有逾期或退回項目。</p></div>:exceptionRows.map(t=><button key={t.id} className="exceptionRow" onClick={()=>openTask(t)}><div className={t.submission?.status==='redo'?'exceptionIcon red':'exceptionIcon amber'}>{t.submission?.status==='redo'?<XCircle size={19}/>:<Clock3 size={19}/>}</div><div><b>{t.name}</b><div className="muted">{t.area} · {t.submission?.status==='redo'?'需重新清潔':`期限 ${String(t.deadline_time).slice(0,5)}`}</div></div><ChevronRight size={17}/></button>)}</div>

      <div className="sectionTitle"><h3><TrendingUp size={19}/>近 7 日完成率</h3></div>
      <div className="card weekChart">{sevenDays.map(d=><div className="weekCol" key={d.key}><div className="weekValue">{d.total?`${d.rate}%`:'-'}</div><div className="weekTrack"><div style={{height:`${d.total?Math.max(8,d.rate):4}%`}}/></div><span>{d.label}</span></div>)}</div>

      <div className="sectionTitle"><h3><Users size={19}/>員工今日進度</h3></div>
      <div className="card staffBoard">{staffStats.length===0?<div className="empty">尚未建立員工帳號。</div>:staffStats.map((u,i)=><div className="staffRow" key={u.id}><div className="staffAvatar">{u.name.slice(0,1)}</div><div className="staffInfo"><div className="row space"><b>{u.name}</b><strong>{u.rate}%</strong></div><div className="miniProgress"><div style={{width:`${u.rate}%`}}/></div><div className="muted tiny">合格 {u.approved} · 待審 {u.review} · 重做 {u.redo}</div></div>{i===0&&u.approved>0?<Trophy size={20} className="goldIcon"/>:<span className="rankNo">{i+1}</span>}</div>)}</div>
    </>}

    {profile.role==='manager'&&<div className="tabs dashboardTabs"><button className={mode==='tasks'?'on':''} onClick={()=>setMode('tasks')}>今日任務</button><button className={mode==='review'?'on':''} onClick={()=>setMode('review')}>主管審核 {reviewing?`(${reviewing})`:''}</button></div>}
    {mode==='review'&&profile.role==='manager'?<ReviewList rows={rows.filter(r=>r.submission?.status==='review')} review={review} retryAI={retryAI} signedUrl={signedUrl}/>:<TaskList rows={rows} openTask={openTask}/>} 
  </>
}
function TaskList({rows,openTask}){return <><div className="sectionTitle"><h3 style={{margin:0}}>今日任務</h3><span className="muted">點選項目拍照</span></div><div className="card">{rows.length===0?<div className="empty">尚未建立清潔項目。</div>:rows.map(t=><button className="task clickable" key={t.id} onClick={()=>openTask(t)} style={{width:'100%',border:0,background:'transparent',textAlign:'left'}}><div className="iconbox"><ClipboardCheck size={21}/></div><div style={{flex:1}}><b>{t.name}</b><div className="muted">{t.area} · {t.schedule_label}</div>{t.submission?.manager_note&&<div className="dangerText">退回原因：{t.submission.manager_note}</div>}</div><Status status={t.submission?.status||'pending'}/><ChevronRight size={18} color="#829388"/></button>)}</div></>}
function ReviewList({rows,review,retryAI,signedUrl}){return <><div className="sectionTitle"><h3 style={{margin:0}}>待審核照片</h3></div><div className="card">{rows.length===0?<div className="empty"><CheckCircle2 size={34}/><p>目前沒有待審核項目。</p></div>:rows.map(r=><ReviewCard key={r.submission.id} row={r} review={review} retryAI={retryAI} signedUrl={signedUrl}/>)}</div></>}
function AIAnalysis({submission}){const status=submission?.ai_status;if(!status||status==='pending')return <div className="aiPanel aiPending"><Sparkles size={18}/><div><b>AI 等待分析</b><div className="muted tiny">照片上傳後會自動檢查油污、水漬與垃圾。</div></div></div>;if(status==='analyzing')return <div className="aiPanel aiPending"><RefreshCw size={18} className="spin"/><div><b>AI 分析中</b><div className="muted tiny">通常約需數秒。</div></div></div>;if(status==='failed')return <div className="aiPanel aiFail"><AlertTriangle size={18}/><div><b>AI 分析失敗</b><div className="muted tiny">{submission.ai_error||'主管仍可人工審核。'}</div></div></div>;const items=[['油污',submission.ai_oil_stain],['水漬',submission.ai_water_stain],['垃圾',submission.ai_trash]];return <div className={`aiPanel aiResult ${submission.ai_verdict||'review'}`}><div className="aiHead"><div className="aiScore"><Sparkles size={18}/><strong>{submission.ai_score??'--'}</strong><span>分</span></div><div><b>{aiLabel[submission.ai_verdict]||'AI 分析結果'}</b><div className="muted tiny">照片品質：{{good:'良好',usable:'可判讀',poor:'不足'}[submission.ai_image_quality]||'未判定'} · 僅供主管參考</div></div></div><div className="aiChecks">{items.map(([name,v])=><span key={name} className={v?.detected?'aiDetected':'aiClear'}>{name} {v?.detected?`疑似 ${v.severity}/3`:'未見明顯'}</span>)}</div>{submission.ai_summary&&<p className="aiSummary">{submission.ai_summary}</p>}{Array.isArray(submission.ai_suggestions)&&submission.ai_suggestions.length>0&&<ul className="aiSuggestions">{submission.ai_suggestions.map((x,i)=><li key={i}>{x}</li>)}</ul>}</div>}

function ReviewCard({row,review,retryAI,signedUrl}){const [url,setUrl]=useState(''),[rejecting,setRejecting]=useState(false),[reason,setReason]=useState('');useEffect(()=>{signedUrl(row.submission.photo_path).then(setUrl)},[row.submission.photo_path]);return <div className="reviewCard"><div className="row space"><div><b>{row.name}</b><div className="muted">{row.submission.profiles?.display_name||'員工'} · {row.area} · {formatDateTime(row.submission.created_at)}</div></div><Status status="review"/></div>{url?<img className="photo" src={url} alt="清潔照片" style={{marginTop:12}}/>:<div className="upload" style={{marginTop:12}}>照片載入中…</div>}{row.submission.note&&<p>{row.submission.note}</p>}<AIAnalysis submission={row.submission}/>{['failed','pending'].includes(row.submission.ai_status)&&<button className="button ghost" style={{width:'100%',marginTop:10}} onClick={()=>retryAI(row.submission.id)}><RefreshCw size={16}/>重新執行 AI 分析</button>}{rejecting?<><label className="label">退回原因</label><textarea className="input textarea" value={reason} onChange={e=>setReason(e.target.value)} placeholder="例如：鐵板邊角仍有油漬"/><div className="row" style={{marginTop:10}}><button className="button ghost" style={{flex:1}} onClick={()=>setRejecting(false)}>取消</button><button className="button danger" style={{flex:1}} disabled={!reason.trim()} onClick={()=>review(row.submission.id,'redo',reason.trim())}>確認退回</button></div></>:<div className="row" style={{marginTop:12}}><button className="button primary" style={{flex:1}} onClick={()=>review(row.submission.id,'approved','')}><CheckCircle2 size={17}/>合格</button><button className="button danger" style={{flex:1}} onClick={()=>setRejecting(true)}><XCircle size={17}/>重做</button></div>}</div>}

function TaskPage({task,submission,onBack,onSubmit,loading}){const [file,setFile]=useState(null),[preview,setPreview]=useState(''),[note,setNote]=useState(submission?.note||'');function read(e){const f=e.target.files?.[0];if(!f)return;if(f.size>12*1024*1024){alert('照片請小於 12MB');return}setFile(f);setPreview(URL.createObjectURL(f))}return <><header className="header"><div className="row"><button className="topback" onClick={onBack}>返回</button><div><div style={{fontSize:13,opacity:.85}}>清潔項目</div><h2 style={{margin:0}}>{task.name}</h2></div></div></header><main className="content">{submission&&<div className="card soft"><div className="row space"><div><b>目前狀態</b><div className="muted">{submission.status==='redo'?'請依主管意見重新拍照送出':'可重新拍照更新紀錄'}</div></div><Status status={submission.status}/></div>{submission.manager_note&&<div className="dangerText" style={{fontSize:14,marginTop:10}}>主管：{submission.manager_note}</div>}</div>}<div className="card"><b>清潔標準</b><p className="muted">完成表面、邊角與周邊區域清潔，照片需清楚呈現完成結果。避免模糊、過暗或只拍局部。</p><label className="label">清潔照片 *</label><label className="upload">{preview?<img className="photo photoTall" src={preview} alt="預覽"/>:<><Camera size={38} color="#138a4b"/><p><b>點擊拍照或選擇照片</b></p><span className="muted">手機會優先開啟後置相機</span></>}<input hidden type="file" accept="image/*" capture="environment" onChange={read}/></label>{preview&&<button className="button ghost" style={{width:'100%',marginTop:10}} onClick={()=>{setFile(null);setPreview('')}}><RefreshCw size={16}/>重新選擇</button>}<div style={{height:16}}/><label className="label">備註</label><textarea className="input textarea" value={note} onChange={e=>setNote(e.target.value)} placeholder="可填寫清潔狀況或異常事項"/><div style={{height:16}}/><button className="button primary" style={{width:'100%'}} disabled={!file||loading} onClick={()=>onSubmit({file,note})}>{loading?'照片上傳中…':'完成並送出審核'}</button></div></main></>}

function HistoryPage({submissions,signedUrl}){const [filter,setFilter]=useState('all'),[query,setQuery]=useState(''),[selected,setSelected]=useState(null);const list=useMemo(()=>submissions.filter(s=>(filter==='all'||s.status===filter)&&(!query||s.cleaning_tasks?.name?.includes(query)||s.profiles?.display_name?.includes(query))),[submissions,filter,query]);return <><h2>歷史紀錄</h2><div className="search"><Search size={18}/><input className="input" placeholder="搜尋項目或員工" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="tabs" style={{marginTop:12}}>{[['all','全部'],['approved','合格'],['review','待審核'],['redo','需重做']].map(([v,t])=><button key={v} className={filter===v?'on':''} onClick={()=>setFilter(v)}>{t}</button>)}</div><div className="card">{list.length===0?<div className="empty">沒有符合的紀錄。</div>:list.map(r=><button className="task clickable" key={r.id} onClick={()=>setSelected(r)} style={{width:'100%',border:0,background:'transparent',textAlign:'left'}}><div className="iconbox"><History size={20}/></div><div style={{flex:1}}><b>{r.cleaning_tasks?.name}</b><div className="muted">{r.profiles?.display_name} · {r.work_date}</div></div><Status status={r.status}/><ChevronRight size={18}/></button>)}</div>{selected&&<HistoryModal item={selected} signedUrl={signedUrl} close={()=>setSelected(null)}/>}</>}
function HistoryModal({item,signedUrl,close}){const [url,setUrl]=useState('');useEffect(()=>{signedUrl(item.photo_path).then(setUrl)},[item.photo_path]);return <div className="modal" onClick={close}><div className="sheet" onClick={e=>e.stopPropagation()}><div className="row space"><div><h2 style={{margin:0}}>{item.cleaning_tasks?.name}</h2><div className="muted">{item.profiles?.display_name} · {item.work_date}</div></div><button className="button ghost" onClick={close}><X size={18}/></button></div><div className="divider"/>{url?<img className="photo photoTall" src={url} alt="清潔紀錄"/>:<div className="upload">照片載入中…</div>}<p><b>員工備註：</b>{item.note||'無'}</p>{item.manager_note&&<p><b>主管意見：</b>{item.manager_note}</p>}<div className="row space"><Status status={item.status}/><span className="muted">{formatDateTime(item.created_at)}</span></div></div></div>}

function ManagePage({tasks,profiles=[],saveTask,deleteTask,currentUserId,flash}){
  const [tab,setTab]=useState('employees'),[editing,setEditing]=useState(null),[showTaskForm,setShowTaskForm]=useState(false)
  return <>
    <div><h2 style={{marginBottom:2}}>主管後台</h2><div className="muted">員工帳號與清潔項目管理</div></div>
    <div className="tabs" style={{marginTop:16}}><button className={tab==='employees'?'on':''} onClick={()=>setTab('employees')}>員工管理</button><button className={tab==='tasks'?'on':''} onClick={()=>setTab('tasks')}>清潔項目</button></div>
    {tab==='employees'?<EmployeeManager currentUserId={currentUserId} flash={flash}/>:<><div className="row space"><div className="sectionTitle" style={{flex:1,marginTop:10}}><h3 style={{margin:0}}>清潔項目</h3><span className="muted">{tasks.filter(t=>t.active).length} 個啟用</span></div><button className="button primary" onClick={()=>{setEditing(null);setShowTaskForm(true)}}><Plus size={18}/>新增</button></div><div className="card">{tasks.map(t=><div className="task" key={t.id}><div className="iconbox"><ListChecks size={20}/></div><div style={{flex:1}}><b>{t.name}</b><div className="muted">{t.area} · {t.schedule_label}{t.deadline_time?` · ${t.deadline_time.slice(0,5)}前`:''} · {t.active?'啟用':'停用'}</div></div><button className="button ghost compact" onClick={()=>{setEditing(t);setShowTaskForm(true)}}><Pencil size={16}/></button><button className="button danger compact" onClick={()=>deleteTask(t.id)}><Trash2 size={16}/></button></div>)}</div>{showTaskForm&&<TaskForm task={editing} profiles={profiles} close={()=>setShowTaskForm(false)} save={async(v)=>{await saveTask(v,editing?.id);setShowTaskForm(false)}}/>}</>}
  </>
}

function EmployeeManager({currentUserId,flash}){
  const [users,setUsers]=useState([]),[busy,setBusy]=useState(true),[modal,setModal]=useState(null),[query,setQuery]=useState('')
  async function request(method='GET',body,url='/api/admin/users'){
    const {data:{session}}=await supabase.auth.getSession()
    const res=await fetch(url,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token||''}`},body:body?JSON.stringify(body):undefined})
    const json=await res.json();if(!res.ok)throw new Error(json.error||'操作失敗');return json
  }
  async function load(){try{setBusy(true);const data=await request();setUsers(data.users||[])}catch(e){flash(e.message,'error')}finally{setBusy(false)}}
  useEffect(()=>{load()},[])
  async function save(values){try{setBusy(true);if(modal?.type==='new')await request('POST',values);else await request('PATCH',{id:modal.user.id,...values});setModal(null);await load();flash(modal?.type==='new'?'員工帳號已建立。':'員工資料已更新。')}catch(e){flash(e.message,'error');setBusy(false)}}
  async function reset(user,password){try{setBusy(true);await request('PATCH',{id:user.id,action:'reset_password',password});setModal(null);flash('密碼已重設。')}catch(e){flash(e.message,'error')}finally{setBusy(false)}}
  async function toggle(user){if(user.id===currentUserId)return flash('不能停用自己的主管帳號。','error');try{setBusy(true);await request('PATCH',{id:user.id,action:'toggle_disabled',disabled:user.disabled});await load();flash(user.disabled?'帳號已重新啟用。':'帳號已停用。')}catch(e){flash(e.message,'error');setBusy(false)}}
  async function remove(user){if(!window.confirm(`確定永久刪除「${user.display_name||user.email}」？此動作無法復原。`))return;try{setBusy(true);await request('DELETE',null,`/api/admin/users?id=${encodeURIComponent(user.id)}`);await load();flash('帳號已刪除。')}catch(e){flash(e.message,'error');setBusy(false)}}
  const list=users.filter(u=>!query||u.display_name?.includes(query)||u.email?.toLowerCase().includes(query.toLowerCase()))
  return <><div className="row space" style={{margin:'10px 0'}}><div><h3 style={{margin:0}}>員工帳號</h3><div className="muted">共 {users.length} 個帳號</div></div><button className="button primary" onClick={()=>setModal({type:'new'})}><Plus size={18}/>新增員工</button></div><div className="search"><Search size={18}/><input className="input" placeholder="搜尋姓名或 Email" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="card" style={{marginTop:12}}>{busy&&users.length===0?<div className="empty">帳號載入中…</div>:list.length===0?<div className="empty">找不到帳號。</div>:list.map(u=><div className="task" key={u.id}><div className="iconbox">{u.role==='manager'?<ShieldCheck size={20}/>:<UserRound size={20}/>}</div><div style={{flex:1,minWidth:0}}><b>{u.display_name||'未命名'}</b><div className="muted ellipsis">{u.email}</div><div className="row wrap" style={{marginTop:5,gap:6}}><span className="pill">{u.role==='manager'?'主管':'員工'}</span>{u.disabled&&<span className="badge redo">已停用</span>}{u.id===currentUserId&&<span className="badge done">目前帳號</span>}</div></div><div className="actionStack"><button className="button ghost compact" onClick={()=>setModal({type:'edit',user:u})}><Pencil size={16}/></button><button className="button ghost compact" onClick={()=>setModal({type:'password',user:u})}><KeyRound size={16}/></button><button className="button ghost compact" disabled={u.id===currentUserId} onClick={()=>toggle(u)}>{u.disabled?<RefreshCw size={16}/>:<UserX size={16}/>}</button><button className="button danger compact" disabled={u.id===currentUserId} onClick={()=>remove(u)}><Trash2 size={16}/></button></div></div>)}</div>{modal?.type==='new'&&<EmployeeForm close={()=>setModal(null)} save={save} busy={busy}/>} {modal?.type==='edit'&&<EmployeeForm user={modal.user} close={()=>setModal(null)} save={save} busy={busy}/>} {modal?.type==='password'&&<PasswordForm user={modal.user} close={()=>setModal(null)} save={reset} busy={busy}/>}</>
}

function EmployeeForm({user,close,save,busy}){const [v,setV]=useState({display_name:user?.display_name||'',email:user?.email||'',role:user?.role||'staff',password:''});const set=(k,x)=>setV(o=>({...o,[k]:x}));return <div className="modal" onClick={close}><form className="sheet" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();save(v)}}><div className="row space"><h2 style={{margin:0}}>{user?'編輯員工':'新增員工'}</h2><button type="button" className="button ghost compact" onClick={close}><X size={18}/></button></div><div className="divider"/><label className="label">姓名</label><input className="input" required value={v.display_name} onChange={e=>set('display_name',e.target.value)}/><div style={{height:12}}/><label className="label">Email</label><input className="input" type="email" required value={v.email} onChange={e=>set('email',e.target.value)}/>{!user&&<><div style={{height:12}}/><label className="label">初始密碼（至少 8 碼）</label><input className="input" type="password" minLength={8} required value={v.password} onChange={e=>set('password',e.target.value)}/></>}<div style={{height:12}}/><label className="label">權限</label><select className="input" value={v.role} onChange={e=>set('role',e.target.value)}><option value="staff">員工</option><option value="manager">主管</option></select><button className="button primary" style={{width:'100%',marginTop:18}} disabled={busy}>{busy?'處理中…':'儲存'}</button></form></div>}
function PasswordForm({user,close,save,busy}){const [password,setPassword]=useState('');return <div className="modal" onClick={close}><form className="sheet" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();save(user,password)}}><div className="row space"><div><h2 style={{margin:0}}>重設密碼</h2><div className="muted">{user.display_name} · {user.email}</div></div><button type="button" className="button ghost compact" onClick={close}><X size={18}/></button></div><div className="divider"/><label className="label">新密碼（至少 8 碼）</label><input className="input" type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/><button className="button primary" style={{width:'100%',marginTop:18}} disabled={busy}>{busy?'處理中…':'設定新密碼'}</button></form></div>}
function TaskForm({task,close,save,profiles=[]}){const [values,setValues]=useState({name:task?.name||'',area:task?.area||'',schedule_label:task?.schedule_label||'每日',frequency:task?.frequency||'daily',deadline_time:task?.deadline_time||'',photo_required:task?.photo_required??true,photo_angles:task?.photo_angles||'',instructions:task?.instructions||'',assigned_role:task?.assigned_role||'staff',assigned_staff_id:task?.assigned_staff_id||'',sort_order:task?.sort_order||0,active:task?.active??true});const set=(k,v)=>setValues(x=>({...x,[k]:v}));return <div className="modal" onClick={close}><form className="sheet" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();save(values)}}><div className="row space"><h2 style={{margin:0}}>{task?'編輯清潔項目':'新增清潔項目'}</h2><button type="button" className="button ghost" onClick={close}><X size={18}/></button></div><div className="divider"/><label className="label">項目名稱</label><input className="input" required value={values.name} onChange={e=>set('name',e.target.value)}/><div style={{height:12}}/><label className="label">區域</label><input className="input" required value={values.area} onChange={e=>set('area',e.target.value)}/><div style={{height:12}}/><label className="label">頻率</label><select className="input" value={values.frequency} onChange={e=>set('frequency',e.target.value)}><option value="daily">每日</option><option value="weekly">每週</option><option value="monthly">每月</option><option value="custom">自訂</option></select><div style={{height:12}}/><label className="label">執行時段</label><input className="input" required value={values.schedule_label} onChange={e=>set('schedule_label',e.target.value)}/><div style={{height:12}}/><label className="label">完成期限</label><input className="input" type="time" value={values.deadline_time} onChange={e=>set('deadline_time',e.target.value)}/><div style={{height:12}}/><label className="label">指定員工</label><select className="input" value={values.assigned_staff_id} onChange={e=>set('assigned_staff_id',e.target.value)}><option value="">不指定</option>{profiles.filter(p=>p.role==='staff').map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select><div style={{height:12}}/><label className="label">預設角色</label><select className="input" value={values.assigned_role} onChange={e=>set('assigned_role',e.target.value)}><option value="staff">員工</option><option value="manager">主管</option><option value="all">所有人</option></select><div style={{height:12}}/><label className="row"><input type="checkbox" checked={values.photo_required} onChange={e=>set('photo_required',e.target.checked)}/>需要拍照</label><div style={{height:12}}/><label className="label">拍攝角度</label><input className="input" value={values.photo_angles} onChange={e=>set('photo_angles',e.target.value)} placeholder="正面、左側、右側"/><div style={{height:12}}/><label className="label">清潔 SOP</label><textarea className="input textarea" value={values.instructions} onChange={e=>set('instructions',e.target.value)}/><div style={{height:12}}/><label className="label">排序</label><input className="input" type="number" value={values.sort_order} onChange={e=>set('sort_order',e.target.value)}/><div style={{height:12}}/><label className="row"><input type="checkbox" checked={values.active} onChange={e=>set('active',e.target.checked)}/>啟用此項目</label><button className="button primary" style={{width:'100%',marginTop:18}}>儲存</button></form></div>}

function ReportsPage({submissions,tasks,profiles}){
  const [range,setRange]=useState('month')
  const now=new Date()
  const start=useMemo(()=>{
    const d=new Date(now)
    if(range==='today') d.setHours(0,0,0,0)
    else if(range==='week'){const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);d.setHours(0,0,0,0)}
    else {d.setDate(1);d.setHours(0,0,0,0)}
    return d
  },[range])
  const rows=useMemo(()=>submissions.filter(s=>new Date(`${s.work_date}T00:00:00`)>=start),[submissions,start])
  const approved=rows.filter(s=>s.status==='approved').length
  const review=rows.filter(s=>s.status==='review').length
  const redo=rows.filter(s=>s.status==='redo').length
  const rate=rows.length?Math.round(approved/rows.length*100):0
  const staffStats=profiles.map(p=>{const own=rows.filter(s=>s.staff_id===p.id);return {name:p.display_name||'未命名',role:p.role,total:own.length,approved:own.filter(s=>s.status==='approved').length,review:own.filter(s=>s.status==='review').length,redo:own.filter(s=>s.status==='redo').length}}).filter(x=>x.total>0).sort((a,b)=>b.approved-a.approved||b.total-a.total)
  const taskStats=tasks.map(t=>{const own=rows.filter(s=>s.task_id===t.id);return {name:t.name,total:own.length,approved:own.filter(s=>s.status==='approved').length,redo:own.filter(s=>s.status==='redo').length}}).filter(x=>x.total>0).sort((a,b)=>b.redo-a.redo||b.total-a.total)
  const dayStats=useMemo(()=>{const map=new Map();for(const s of rows){const v=map.get(s.work_date)||{date:s.work_date,total:0,approved:0};v.total++;if(s.status==='approved')v.approved++;map.set(s.work_date,v)}return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-14)},[rows])
  function exportCsv(){
    const head=['日期','清潔項目','區域','員工','狀態','員工備註','主管備註','送出時間','審核時間']
    const label={approved:'合格',review:'待審核',redo:'需重做'}
    const body=rows.map(s=>[s.work_date,s.cleaning_tasks?.name||'',s.cleaning_tasks?.area||'',s.profiles?.display_name||'',label[s.status]||s.status,s.note||'',s.manager_note||'',formatDateTime(s.created_at),formatDateTime(s.reviewed_at)])
    const esc=v=>`"${String(v??'').replaceAll('"','""')}"`
    const csv='\uFEFF'+[head,...body].map(r=>r.map(esc).join(',')).join('\r\n')
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'})
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`clean-check-${range}-${today()}.csv`;a.click();URL.revokeObjectURL(url)
  }
  return <>
    <div className="row space"><div><h2 style={{marginBottom:2}}>清潔報表</h2><div className="muted">即時統計與 CSV 匯出</div></div><button className="button primary" onClick={exportCsv}><Download size={18}/>匯出 CSV</button></div>
    <div className="tabs"><button className={range==='today'?'on':''} onClick={()=>setRange('today')}>今日</button><button className={range==='week'?'on':''} onClick={()=>setRange('week')}>本週</button><button className={range==='month'?'on':''} onClick={()=>setRange('month')}>本月</button></div>
    <div className="grid3"><div className="stat"><span className="muted">合格</span><b>{approved}</b></div><div className="stat"><span className="muted">待審核</span><b>{review}</b></div><div className="stat"><span className="muted">需重做</span><b>{redo}</b></div></div>
    <div className="card" style={{marginTop:12}}><div className="row space"><div><div className="muted">審核合格率</div><h1 style={{margin:'4px 0'}}>{rate}%</h1></div><BarChart3 size={34}/></div><div className="progress"><div style={{width:`${rate}%`}}/></div><div className="muted" style={{marginTop:8}}>期間內共 {rows.length} 筆打卡紀錄</div></div>
    <div className="sectionTitle"><h3><CalendarDays size={19}/>每日趨勢</h3></div>
    <div className="card reportChart">{dayStats.length===0?<div className="empty">期間內尚無資料。</div>:dayStats.map(d=>{const r=d.total?Math.round(d.approved/d.total*100):0;return <div className="chartRow" key={d.date}><span>{new Date(`${d.date}T00:00:00`).toLocaleDateString('zh-TW',{month:'numeric',day:'numeric'})}</span><div className="chartTrack"><div style={{width:`${r}%`}}/></div><b>{r}%</b></div>})}</div>
    <div className="sectionTitle"><h3><Trophy size={19}/>員工完成排行</h3></div>
    <div className="card">{staffStats.length===0?<div className="empty">期間內尚無員工紀錄。</div>:staffStats.map((u,i)=><div className="task" key={u.name}><div className="rank">{i+1}</div><div style={{flex:1}}><b>{u.name}</b><div className="muted">合格 {u.approved} · 待審 {u.review} · 重做 {u.redo}</div></div><strong>{u.total} 筆</strong></div>)}</div>
    <div className="sectionTitle"><h3><ListChecks size={19}/>項目品質分析</h3></div>
    <div className="card">{taskStats.length===0?<div className="empty">期間內尚無項目紀錄。</div>:taskStats.map(t=><div className="task" key={t.name}><div className="iconbox"><ClipboardCheck size={19}/></div><div style={{flex:1}}><b>{t.name}</b><div className="muted">合格 {t.approved} · 重做 {t.redo}</div></div><strong>{t.total} 次</strong></div>)}</div>
  </>
}

function SettingsPage({user,reload,loading}){return <><h2>設定</h2><div className="card"><div className="task"><div className="iconbox"><Store/></div><div><b>門市資料</b><div className="muted">大埔鐵板燒 屏東民生店 · DP Clean v6.0</div></div></div><div className="task"><div className="iconbox"><UserRound/></div><div><b>目前帳號</b><div className="muted">{user.display_name} · {user.role==='manager'?'主管':'員工'}</div></div></div><div className="task"><div className="iconbox"><Settings/></div><div style={{flex:1}}><b>雲端同步</b><div className="muted">Supabase 已連線</div></div><button className="button ghost" disabled={loading} onClick={reload}><RefreshCw size={16}/>同步</button></div></div><div className="card soft"><b>安裝到手機桌面</b><p className="muted">iPhone：Safari 分享 → 加入主畫面。Android：Chrome 選單 → 安裝應用程式。</p></div></>}
function Status({status}){const map={approved:['合格','done'],review:['待審核','pending'],pending:['待完成','pending'],redo:['需重做','redo']};const [t,c]=map[status]||map.pending;return <span className={`badge ${c}`}>{t}</span>}
function Nav({page,setPage,manager}){const items=manager?[[Home,'home','首頁'],[History,'history','紀錄'],[BarChart3,'reports','報表'],[Users,'manage','管理'],[Settings,'settings','設定']]:[[Home,'home','首頁'],[History,'history','紀錄'],[ListChecks,'home','任務'],[Settings,'settings','設定']];return <nav className="nav">{items.map(([Icon,value,label],i)=><button key={`${value}-${i}`} className={page===value?'active':''} onClick={()=>setPage(value)}><Icon size={20}/><div>{label}</div></button>)}</nav>}
