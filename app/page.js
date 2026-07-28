'use client'

import { useEffect, useMemo, useState } from 'react'
import { Camera, CheckCircle2, ChevronRight, ClipboardCheck, History, Home, Image as ImageIcon, KeyRound, ListChecks, LogOut, Pencil, Plus, RefreshCw, Search, Settings, ShieldCheck, Sparkles, Store, Trash2, UserRound, UserX, Users, X, XCircle } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const today = () => new Date().toLocaleDateString('en-CA')
const formatDateTime = value => value ? new Date(value).toLocaleString('zh-TW',{dateStyle:'short',timeStyle:'short'}) : ''

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
      if(existing){
        const {error}=await supabase.from('cleaning_submissions').update({photo_path:path,note,status:'review',manager_note:'',reviewed_by:null,reviewed_at:null,created_at:new Date().toISOString()}).eq('id',existing.id)
        if(error) throw error
      }else{
        const {error}=await supabase.from('cleaning_submissions').insert({task_id:selected.id,staff_id:session.user.id,photo_path:path,note,work_date:today(),status:'review'})
        if(error) throw error
      }
      await loadData();setPage('home');flash('照片已上傳，等待主管審核。')
    }catch(e){flash(e.message||'上傳失敗','error')}finally{setLoading(false)}
  }

  async function review(id,status,managerNote=''){
    const {error}=await supabase.from('cleaning_submissions').update({status,manager_note:managerNote,reviewed_by:session.user.id,reviewed_at:new Date().toISOString()}).eq('id',id)
    if(error) flash(error.message,'error');else {await loadData();flash(status==='approved'?'已審核合格。':'已退回重做。')}
  }

  async function saveTask(values,id){
    const payload={name:values.name.trim(),area:values.area.trim(),schedule_label:values.schedule_label.trim(),sort_order:Number(values.sort_order)||0,active:values.active}
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

  const todaySubs=submissions.filter(s=>s.work_date===today())
  const activeTasks=tasks.filter(t=>t.active)
  const taskRows=activeTasks.map(t=>({...t,submission:todaySubs.find(s=>s.task_id===t.id)}))
  const canManage=profile.role==='manager'

  return <div className="page">
    {page==='task' ? <TaskPage task={selected} submission={selected?.submission} onBack={()=>setPage('home')} onSubmit={submitTask} loading={loading}/> : <>
      <Header user={profile} onLogout={logout}/>
      <main className="content">
        {notice&&<div className={`notice ${noticeType==='error'?'errorNotice':'successNotice'}`}>{notice}</div>}
        {page==='home'&&<Dashboard rows={taskRows} profile={profile} mode={mode} setMode={setMode} openTask={t=>{setSelected(t);setPage('task')}} review={review} signedUrl={signedUrl}/>} 
        {page==='history'&&<HistoryPage submissions={submissions} signedUrl={signedUrl}/>} 
        {page==='manage'&&canManage&&<ManagePage tasks={tasks} saveTask={saveTask} deleteTask={deleteTask} currentUserId={session.user.id} flash={flash}/>} 
        {page==='settings'&&<SettingsPage user={profile} reload={loadData} loading={loading}/>} 
      </main>
      <Nav page={page} setPage={setPage} manager={canManage}/>
    </>}
  </div>
}

function Login({notice}){
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  async function go(e){e.preventDefault();setBusy(true);setError('');const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)setError(error.message==='Invalid login credentials'?'Email 或密碼不正確。':error.message);setBusy(false)}
  return <div className="login"><form className="loginbox card" onSubmit={go}><div className="logo">🧹</div><h1 style={{textAlign:'center',margin:'0 0 6px'}}>潔淨打卡</h1><p className="muted" style={{textAlign:'center',marginBottom:24}}>每日清潔管理 App</p>{(error||notice)&&<div className="notice errorNotice">{error||notice}</div>}<label className="label">Email</label><input className="input" type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/><div style={{height:12}}/><label className="label">密碼</label><input className="input" type="password" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/><div style={{height:18}}/><button className="button primary" style={{width:'100%'}} disabled={busy}>{busy?'登入中…':'登入'}</button></form></div>
}
function SetupNeeded({message}){return <div className="login"><div className="loginbox card"><div className="logo">🔌</div><h2>尚未完成 Supabase 設定</h2><p className="muted">請確認 Vercel 環境變數與 Supabase profiles 設定。</p>{message&&<div className="notice errorNotice">{message}</div>}</div></div>}
function Loading(){return <div className="login"><div className="loginbox card"><h2>載入中…</h2></div></div>}
function Header({user,onLogout}){return <header className="header"><div className="row space"><div><div style={{fontSize:13,opacity:.85}}>大埔鐵板燒 · 單店清潔管理</div><h2 style={{margin:'4px 0'}}>你好，{user.display_name}</h2><div style={{fontSize:13}}>{user.role==='manager'?'主管模式':'員工模式'} · {new Date().toLocaleDateString('zh-TW')}</div></div><button className="topback" onClick={onLogout} aria-label="登出"><LogOut size={20}/></button></div></header>}

function Dashboard({rows,profile,mode,setMode,openTask,review,signedUrl}){
  const approved=rows.filter(r=>r.submission?.status==='approved').length
  const reviewing=rows.filter(r=>r.submission?.status==='review').length
  const redo=rows.filter(r=>r.submission?.status==='redo').length
  return <>
    <div className="grid3"><div className="stat"><span className="muted">已合格</span><b>{approved}</b></div><div className="stat"><span className="muted">待審核</span><b>{reviewing}</b></div><div className="stat"><span className="muted">需重做</span><b>{redo}</b></div></div>
    <div className="card" style={{marginTop:12}}><div className="row space"><div><div className="muted">今日完成率</div><h2 style={{margin:'4px 0'}}>{approved} / {rows.length} 項</h2></div><Sparkles color="#138a4b"/></div><div className="progress"><div style={{width:`${rows.length?approved/rows.length*100:0}%`}}/></div></div>
    {profile.role==='manager'&&<div className="tabs"><button className={mode==='tasks'?'on':''} onClick={()=>setMode('tasks')}>今日任務</button><button className={mode==='review'?'on':''} onClick={()=>setMode('review')}>主管審核 {reviewing?`(${reviewing})`:''}</button></div>}
    {mode==='review'&&profile.role==='manager'?<ReviewList rows={rows.filter(r=>r.submission?.status==='review')} review={review} signedUrl={signedUrl}/>:<TaskList rows={rows} openTask={openTask}/>} 
  </>
}
function TaskList({rows,openTask}){return <><div className="sectionTitle"><h3 style={{margin:0}}>今日任務</h3><span className="muted">點選項目拍照</span></div><div className="card">{rows.length===0?<div className="empty">尚未建立清潔項目。</div>:rows.map(t=><button className="task clickable" key={t.id} onClick={()=>openTask(t)} style={{width:'100%',border:0,background:'transparent',textAlign:'left'}}><div className="iconbox"><ClipboardCheck size={21}/></div><div style={{flex:1}}><b>{t.name}</b><div className="muted">{t.area} · {t.schedule_label}</div>{t.submission?.manager_note&&<div className="dangerText">退回原因：{t.submission.manager_note}</div>}</div><Status status={t.submission?.status||'pending'}/><ChevronRight size={18} color="#829388"/></button>)}</div></>}
function ReviewList({rows,review,signedUrl}){return <><div className="sectionTitle"><h3 style={{margin:0}}>待審核照片</h3></div><div className="card">{rows.length===0?<div className="empty"><CheckCircle2 size={34}/><p>目前沒有待審核項目。</p></div>:rows.map(r=><ReviewCard key={r.submission.id} row={r} review={review} signedUrl={signedUrl}/>)}</div></>}
function ReviewCard({row,review,signedUrl}){const [url,setUrl]=useState(''),[rejecting,setRejecting]=useState(false),[reason,setReason]=useState('');useEffect(()=>{signedUrl(row.submission.photo_path).then(setUrl)},[row.submission.photo_path]);return <div className="reviewCard"><div className="row space"><div><b>{row.name}</b><div className="muted">{row.submission.profiles?.display_name||'員工'} · {row.area} · {formatDateTime(row.submission.created_at)}</div></div><Status status="review"/></div>{url?<img className="photo" src={url} alt="清潔照片" style={{marginTop:12}}/>:<div className="upload" style={{marginTop:12}}>照片載入中…</div>}{row.submission.note&&<p>{row.submission.note}</p>}{rejecting?<><label className="label">退回原因</label><textarea className="input textarea" value={reason} onChange={e=>setReason(e.target.value)} placeholder="例如：鐵板邊角仍有油漬"/><div className="row" style={{marginTop:10}}><button className="button ghost" style={{flex:1}} onClick={()=>setRejecting(false)}>取消</button><button className="button danger" style={{flex:1}} disabled={!reason.trim()} onClick={()=>review(row.submission.id,'redo',reason.trim())}>確認退回</button></div></>:<div className="row" style={{marginTop:12}}><button className="button primary" style={{flex:1}} onClick={()=>review(row.submission.id,'approved','')}><CheckCircle2 size={17}/>合格</button><button className="button danger" style={{flex:1}} onClick={()=>setRejecting(true)}><XCircle size={17}/>重做</button></div>}</div>}

function TaskPage({task,submission,onBack,onSubmit,loading}){const [file,setFile]=useState(null),[preview,setPreview]=useState(''),[note,setNote]=useState(submission?.note||'');function read(e){const f=e.target.files?.[0];if(!f)return;if(f.size>12*1024*1024){alert('照片請小於 12MB');return}setFile(f);setPreview(URL.createObjectURL(f))}return <><header className="header"><div className="row"><button className="topback" onClick={onBack}>返回</button><div><div style={{fontSize:13,opacity:.85}}>清潔項目</div><h2 style={{margin:0}}>{task.name}</h2></div></div></header><main className="content">{submission&&<div className="card soft"><div className="row space"><div><b>目前狀態</b><div className="muted">{submission.status==='redo'?'請依主管意見重新拍照送出':'可重新拍照更新紀錄'}</div></div><Status status={submission.status}/></div>{submission.manager_note&&<div className="dangerText" style={{fontSize:14,marginTop:10}}>主管：{submission.manager_note}</div>}</div>}<div className="card"><b>清潔標準</b><p className="muted">完成表面、邊角與周邊區域清潔，照片需清楚呈現完成結果。避免模糊、過暗或只拍局部。</p><label className="label">清潔照片 *</label><label className="upload">{preview?<img className="photo photoTall" src={preview} alt="預覽"/>:<><Camera size={38} color="#138a4b"/><p><b>點擊拍照或選擇照片</b></p><span className="muted">手機會優先開啟後置相機</span></>}<input hidden type="file" accept="image/*" capture="environment" onChange={read}/></label>{preview&&<button className="button ghost" style={{width:'100%',marginTop:10}} onClick={()=>{setFile(null);setPreview('')}}><RefreshCw size={16}/>重新選擇</button>}<div style={{height:16}}/><label className="label">備註</label><textarea className="input textarea" value={note} onChange={e=>setNote(e.target.value)} placeholder="可填寫清潔狀況或異常事項"/><div style={{height:16}}/><button className="button primary" style={{width:'100%'}} disabled={!file||loading} onClick={()=>onSubmit({file,note})}>{loading?'照片上傳中…':'完成並送出審核'}</button></div></main></>}

function HistoryPage({submissions,signedUrl}){const [filter,setFilter]=useState('all'),[query,setQuery]=useState(''),[selected,setSelected]=useState(null);const list=useMemo(()=>submissions.filter(s=>(filter==='all'||s.status===filter)&&(!query||s.cleaning_tasks?.name?.includes(query)||s.profiles?.display_name?.includes(query))),[submissions,filter,query]);return <><h2>歷史紀錄</h2><div className="search"><Search size={18}/><input className="input" placeholder="搜尋項目或員工" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="tabs" style={{marginTop:12}}>{[['all','全部'],['approved','合格'],['review','待審核'],['redo','需重做']].map(([v,t])=><button key={v} className={filter===v?'on':''} onClick={()=>setFilter(v)}>{t}</button>)}</div><div className="card">{list.length===0?<div className="empty">沒有符合的紀錄。</div>:list.map(r=><button className="task clickable" key={r.id} onClick={()=>setSelected(r)} style={{width:'100%',border:0,background:'transparent',textAlign:'left'}}><div className="iconbox"><History size={20}/></div><div style={{flex:1}}><b>{r.cleaning_tasks?.name}</b><div className="muted">{r.profiles?.display_name} · {r.work_date}</div></div><Status status={r.status}/><ChevronRight size={18}/></button>)}</div>{selected&&<HistoryModal item={selected} signedUrl={signedUrl} close={()=>setSelected(null)}/>}</>}
function HistoryModal({item,signedUrl,close}){const [url,setUrl]=useState('');useEffect(()=>{signedUrl(item.photo_path).then(setUrl)},[item.photo_path]);return <div className="modal" onClick={close}><div className="sheet" onClick={e=>e.stopPropagation()}><div className="row space"><div><h2 style={{margin:0}}>{item.cleaning_tasks?.name}</h2><div className="muted">{item.profiles?.display_name} · {item.work_date}</div></div><button className="button ghost" onClick={close}><X size={18}/></button></div><div className="divider"/>{url?<img className="photo photoTall" src={url} alt="清潔紀錄"/>:<div className="upload">照片載入中…</div>}<p><b>員工備註：</b>{item.note||'無'}</p>{item.manager_note&&<p><b>主管意見：</b>{item.manager_note}</p>}<div className="row space"><Status status={item.status}/><span className="muted">{formatDateTime(item.created_at)}</span></div></div></div>}

function ManagePage({tasks,saveTask,deleteTask,currentUserId,flash}){
  const [tab,setTab]=useState('employees'),[editing,setEditing]=useState(null),[showTaskForm,setShowTaskForm]=useState(false)
  return <>
    <div><h2 style={{marginBottom:2}}>主管後台</h2><div className="muted">員工帳號與清潔項目管理</div></div>
    <div className="tabs" style={{marginTop:16}}><button className={tab==='employees'?'on':''} onClick={()=>setTab('employees')}>員工管理</button><button className={tab==='tasks'?'on':''} onClick={()=>setTab('tasks')}>清潔項目</button></div>
    {tab==='employees'?<EmployeeManager currentUserId={currentUserId} flash={flash}/>:<><div className="row space"><div className="sectionTitle" style={{flex:1,marginTop:10}}><h3 style={{margin:0}}>清潔項目</h3><span className="muted">{tasks.filter(t=>t.active).length} 個啟用</span></div><button className="button primary" onClick={()=>{setEditing(null);setShowTaskForm(true)}}><Plus size={18}/>新增</button></div><div className="card">{tasks.map(t=><div className="task" key={t.id}><div className="iconbox"><ListChecks size={20}/></div><div style={{flex:1}}><b>{t.name}</b><div className="muted">{t.area} · {t.schedule_label} · {t.active?'啟用':'停用'}</div></div><button className="button ghost compact" onClick={()=>{setEditing(t);setShowTaskForm(true)}}><Pencil size={16}/></button><button className="button danger compact" onClick={()=>deleteTask(t.id)}><Trash2 size={16}/></button></div>)}</div>{showTaskForm&&<TaskForm task={editing} close={()=>setShowTaskForm(false)} save={async(v)=>{await saveTask(v,editing?.id);setShowTaskForm(false)}}/>}</>}
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
function TaskForm({task,close,save}){const [values,setValues]=useState({name:task?.name||'',area:task?.area||'',schedule_label:task?.schedule_label||'每日',sort_order:task?.sort_order||0,active:task?.active??true});const set=(k,v)=>setValues(x=>({...x,[k]:v}));return <div className="modal" onClick={close}><form className="sheet" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();save(values)}}><div className="row space"><h2 style={{margin:0}}>{task?'編輯清潔項目':'新增清潔項目'}</h2><button type="button" className="button ghost" onClick={close}><X size={18}/></button></div><div className="divider"/><label className="label">項目名稱</label><input className="input" required value={values.name} onChange={e=>set('name',e.target.value)}/><div style={{height:12}}/><label className="label">區域</label><input className="input" required value={values.area} onChange={e=>set('area',e.target.value)} placeholder="廚房、用餐區、廁所…"/><div style={{height:12}}/><label className="label">執行時段</label><input className="input" required value={values.schedule_label} onChange={e=>set('schedule_label',e.target.value)} placeholder="每日、打烊後、每週一…"/><div style={{height:12}}/><label className="label">排序</label><input className="input" type="number" value={values.sort_order} onChange={e=>set('sort_order',e.target.value)}/><div style={{height:12}}/><label className="row"><input type="checkbox" checked={values.active} onChange={e=>set('active',e.target.checked)}/>啟用此項目</label><button className="button primary" style={{width:'100%',marginTop:18}}>儲存</button></form></div>}

function SettingsPage({user,reload,loading}){return <><h2>設定</h2><div className="card"><div className="task"><div className="iconbox"><Store/></div><div><b>門市資料</b><div className="muted">大埔鐵板燒 · 單店模式</div></div></div><div className="task"><div className="iconbox"><UserRound/></div><div><b>目前帳號</b><div className="muted">{user.display_name} · {user.role==='manager'?'主管':'員工'}</div></div></div><div className="task"><div className="iconbox"><Settings/></div><div style={{flex:1}}><b>雲端同步</b><div className="muted">Supabase 已連線</div></div><button className="button ghost" disabled={loading} onClick={reload}><RefreshCw size={16}/>同步</button></div></div><div className="card soft"><b>安裝到手機桌面</b><p className="muted">iPhone：Safari 分享 → 加入主畫面。Android：Chrome 選單 → 安裝應用程式。</p></div></>}
function Status({status}){const map={approved:['合格','done'],review:['待審核','pending'],pending:['待完成','pending'],redo:['需重做','redo']};const [t,c]=map[status]||map.pending;return <span className={`badge ${c}`}>{t}</span>}
function Nav({page,setPage,manager}){const items=[[Home,'home','首頁'],[History,'history','紀錄'],manager?[Users,'manage','管理']:[ListChecks,'home','任務'],[Settings,'settings','設定']];return <nav className="nav">{items.map(([Icon,value,label],i)=><button key={`${value}-${i}`} className={page===value?'active':''} onClick={()=>setPage(value)}><Icon size={20}/><div>{label}</div></button>)}</nav>}
