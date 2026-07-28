'use client'
import { useEffect, useMemo, useState } from 'react'
import { Camera, CheckCircle2, ClipboardCheck, History, Home, LogOut, Settings, Sparkles, Store, UserRound, XCircle } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const today = () => new Date().toLocaleDateString('en-CA')

export default function App(){
  const [session,setSession]=useState(null), [profile,setProfile]=useState(null), [loading,setLoading]=useState(true)
  const [page,setPage]=useState('home'), [tasks,setTasks]=useState([]), [submissions,setSubmissions]=useState([]), [selected,setSelected]=useState(null)
  const [notice,setNotice]=useState('')

  useEffect(()=>{
    if(!isSupabaseConfigured){setLoading(false);return}
    supabase.auth.getSession().then(({data})=>{setSession(data.session); if(data.session) loadProfile(data.session.user.id); else setLoading(false)})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{setSession(s); if(s) loadProfile(s.user.id); else {setProfile(null);setLoading(false)}})
    return ()=>subscription.unsubscribe()
  },[])
  useEffect(()=>{if(profile) loadData()},[profile])

  async function loadProfile(id){
    const {data,error}=await supabase.from('profiles').select('*').eq('id',id).single()
    if(error){setNotice('找不到帳號資料，請主管先在 profiles 建立此使用者。');setLoading(false);return}
    setProfile(data);setLoading(false)
  }
  async function loadData(){
    setLoading(true)
    const [{data:t,error:te},{data:s,error:se}]=await Promise.all([
      supabase.from('cleaning_tasks').select('*').eq('active',true).order('sort_order'),
      supabase.from('cleaning_submissions').select('*, cleaning_tasks(name,area,schedule_label), profiles!cleaning_submissions_staff_id_fkey(display_name)').order('created_at',{ascending:false}).limit(100)
    ])
    if(te||se) setNotice(te?.message||se?.message)
    setTasks(t||[]);setSubmissions(s||[]);setLoading(false)
  }
  async function logout(){await supabase.auth.signOut();setPage('home')}
  async function submitTask({file,note}){
    try{
      setLoading(true);setNotice('')
      const ext=file.name.split('.').pop()||'jpg'; const path=`${session.user.id}/${today()}/${selected.id}-${Date.now()}.${ext}`
      const {error:uploadError}=await supabase.storage.from('cleaning-photos').upload(path,file,{contentType:file.type,upsert:false})
      if(uploadError) throw uploadError
      const existing=submissions.find(s=>s.task_id===selected.id&&s.work_date===today())
      if(existing){
        const {error}=await supabase.from('cleaning_submissions').update({photo_path:path,note,status:'review',manager_note:'',reviewed_by:null,reviewed_at:null}).eq('id',existing.id)
        if(error) throw error
      } else {
        const {error}=await supabase.from('cleaning_submissions').insert({task_id:selected.id,staff_id:session.user.id,photo_path:path,note,work_date:today()})
        if(error) throw error
      }
      await loadData();setPage('home');setNotice('已送出主管審核。')
    }catch(e){setNotice(e.message)}finally{setLoading(false)}
  }
  async function review(id,status){
    const managerNote=status==='redo' ? (window.prompt('請輸入需要重做的原因：')||'請重新清潔') : ''
    const {error}=await supabase.from('cleaning_submissions').update({status,manager_note:managerNote,reviewed_by:session.user.id,reviewed_at:new Date().toISOString()}).eq('id',id)
    if(error)setNotice(error.message);else loadData()
  }
  async function signedUrl(path){const {data}=await supabase.storage.from('cleaning-photos').createSignedUrl(path,3600);return data?.signedUrl}

  if(!isSupabaseConfigured) return <SetupNeeded/>
  if(loading && !profile) return <Loading/>
  if(!session) return <Login notice={notice}/>
  if(!profile) return <SetupNeeded message={notice}/>

  const todaySubs=submissions.filter(s=>s.work_date===today())
  const taskRows=tasks.map(t=>({...t,submission:todaySubs.find(s=>s.task_id===t.id)}))
  return <div className="page">
    {page==='task'?<TaskPage task={selected} onBack={()=>setPage('home')} onSubmit={submitTask} loading={loading}/>:<>
      <Header user={profile} onLogout={logout}/><main className="content">
        {notice&&<div className="notice">{notice}</div>}
        {page==='home'&&(profile.role==='manager'?<ManagerHome rows={taskRows} review={review} signedUrl={signedUrl}/>:<StaffHome rows={taskRows} openTask={t=>{setSelected(t);setPage('task')}}/>)}
        {page==='history'&&<HistoryPage submissions={submissions}/>} {page==='settings'&&<SettingsPage user={profile}/>} 
      </main><Nav page={page} setPage={setPage}/>
    </>}
  </div>
}

function Login({notice}){const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');async function go(e){e.preventDefault();setBusy(true);setError('');const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setError(error.message);setBusy(false)}return <div className="login"><form className="loginbox card" onSubmit={go}><div className="logo">🧹</div><h1 style={{textAlign:'center',margin:'0 0 6px'}}>潔淨打卡</h1><p className="muted" style={{textAlign:'center',marginBottom:24}}>每日清潔管理 App</p>{(error||notice)&&<div className="notice">{error||notice}</div>}<label className="label">Email</label><input className="input" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="staff@example.com"/><div style={{height:12}}/><label className="label">密碼</label><input className="input" type="password" required value={password} onChange={e=>setPassword(e.target.value)}/><div style={{height:18}}/><button className="button primary" style={{width:'100%'}} disabled={busy}>{busy?'登入中…':'登入'}</button></form></div>}
function SetupNeeded({message}){return <div className="login"><div className="loginbox card"><div className="logo">🔌</div><h2>尚未完成 Supabase 設定</h2><p className="muted">請依 README 建立 <code>.env.local</code>、執行 <code>supabase/schema.sql</code>，再重新啟動專案。</p>{message&&<div className="notice">{message}</div>}</div></div>}
function Loading(){return <div className="login"><div className="loginbox card"><h2>載入中…</h2></div></div>}
function Header({user,onLogout}){return <header className="header"><div className="row space"><div><div style={{fontSize:13,opacity:.85}}>單店清潔管理</div><h2 style={{margin:'4px 0'}}>午安，{user.display_name}</h2><div style={{fontSize:13}}>{user.role==='manager'?'主管模式':'員工模式'} · {new Date().toLocaleDateString('zh-TW')}</div></div><button className="topback" onClick={onLogout}><LogOut size={20}/></button></div></header>}
function StaffHome({rows,openTask}){const done=rows.filter(r=>r.submission?.status==='approved').length;return <><div className="card"><div className="row space"><div><div className="muted">今日清潔進度</div><h2 style={{margin:'4px 0'}}>{done} / {rows.length} 項</h2></div><Sparkles color="#138a4b"/></div><div className="progress"><div style={{width:`${rows.length?done/rows.length*100:0}%`}}/></div></div><h3>今日任務</h3><div className="card">{rows.map(t=><div className="task" key={t.id} onClick={()=>openTask(t)} style={{cursor:'pointer'}}><div className="iconbox"><ClipboardCheck size={21}/></div><div style={{flex:1}}><b>{t.name}</b><div className="muted">{t.area} · {t.schedule_label}</div>{t.submission?.manager_note&&<div className="dangerText">{t.submission.manager_note}</div>}</div><Status status={t.submission?.status||'pending'}/></div>)}</div></>}
function ManagerHome({rows,review,signedUrl}){return <><div className="grid2"><div className="stat"><span className="muted">已合格</span><b>{rows.filter(r=>r.submission?.status==='approved').length}</b></div><div className="stat"><span className="muted">待審核</span><b>{rows.filter(r=>r.submission?.status==='review').length}</b></div></div><h3>待審核</h3><div className="card">{rows.filter(r=>r.submission?.status==='review').length===0?<p className="muted">目前沒有待審核項目。</p>:rows.filter(r=>r.submission?.status==='review').map(r=><ReviewCard key={r.submission.id} row={r} review={review} signedUrl={signedUrl}/>)}</div><h3>全部項目</h3><div className="card">{rows.map(r=><div className="task" key={r.id}><div style={{flex:1}}><b>{r.name}</b><div className="muted">{r.submission?.profiles?.display_name||'未完成'}</div></div><Status status={r.submission?.status||'pending'}/></div>)}</div></>}
function ReviewCard({row,review,signedUrl}){const [url,setUrl]=useState('');useEffect(()=>{signedUrl(row.submission.photo_path).then(setUrl)},[row.submission.photo_path]);return <div style={{padding:'12px 0',borderBottom:'1px solid #edf2ee'}}><div className="row space"><div><b>{row.name}</b><div className="muted">{row.submission.profiles?.display_name} · {row.area}</div></div><Status status="review"/></div>{url&&<img className="photo" src={url} alt="清潔照片" style={{marginTop:10}}/>}<p>{row.submission.note}</p><div className="row"><button className="button primary" style={{flex:1}} onClick={()=>review(row.submission.id,'approved')}><CheckCircle2 size={17}/> 合格</button><button className="button danger" style={{flex:1}} onClick={()=>review(row.submission.id,'redo')}><XCircle size={17}/> 重做</button></div></div>}
function TaskPage({task,onBack,onSubmit,loading}){const [file,setFile]=useState(null),[preview,setPreview]=useState(''),[note,setNote]=useState('');function read(e){const f=e.target.files?.[0];if(!f)return;setFile(f);setPreview(URL.createObjectURL(f))}return <><header className="header"><div className="row"><button className="topback" onClick={onBack}>返回</button><div><div style={{fontSize:13,opacity:.85}}>清潔項目</div><h2 style={{margin:0}}>{task.name}</h2></div></div></header><main className="content"><div className="card"><b>清潔標準</b><p className="muted">完成表面、邊角與周邊區域清潔，照片需清楚呈現完成結果。</p><label className="label">清潔照片 *</label><label className="upload">{preview?<img className="photo" src={preview} alt="預覽"/>:<><Camera size={38} color="#138a4b"/><p><b>點擊拍照或選擇照片</b></p><span className="muted">手機會優先開啟相機</span></>}<input hidden type="file" accept="image/*" capture="environment" onChange={read}/></label><div style={{height:16}}/><label className="label">備註</label><textarea className="input textarea" value={note} onChange={e=>setNote(e.target.value)} placeholder="可填寫清潔狀況或異常事項"/><div style={{height:16}}/><button className="button primary" style={{width:'100%'}} disabled={!file||loading} onClick={()=>onSubmit({file,note})}>{loading?'上傳中…':'完成並送出審核'}</button></div></main></>}
function HistoryPage({submissions}){return <><h2>歷史紀錄</h2><div className="card">{submissions.map(r=><div className="task" key={r.id}><div className="iconbox"><History size={20}/></div><div style={{flex:1}}><b>{r.cleaning_tasks?.name}</b><div className="muted">{r.profiles?.display_name} · {r.work_date}</div></div><Status status={r.status}/></div>)}</div></>}
function SettingsPage({user}){return <><h2>設定</h2><div className="card"><div className="task"><div className="iconbox"><Store/></div><div><b>門市資料</b><div className="muted">單店模式</div></div></div><div className="task"><div className="iconbox"><UserRound/></div><div><b>目前帳號</b><div className="muted">{user.display_name} · {user.role==='manager'?'主管':'員工'}</div></div></div><div className="task"><div className="iconbox"><Settings/></div><div><b>雲端同步</b><div className="muted">Supabase 已連線</div></div></div></div></>}
function Status({status}){const map={approved:['合格','done'],review:['待審核','pending'],pending:['待完成','pending'],redo:['需重做','redo']};const [t,c]=map[status]||map.pending;return <span className={`badge ${c}`}>{t}</span>}
function Nav({page,setPage}){return <nav className="nav"><button className={page==='home'?'active':''} onClick={()=>setPage('home')}><Home size={20}/><div>首頁</div></button><button className={page==='history'?'active':''} onClick={()=>setPage('history')}><History size={20}/><div>紀錄</div></button><button className={page==='settings'?'active':''} onClick={()=>setPage('settings')}><Settings size={20}/><div>設定</div></button></nav>}
