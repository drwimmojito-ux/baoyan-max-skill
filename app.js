/* 保研工作台：桌面版保存在本机应用数据目录，网页预览保存在当前浏览器。 */
const STORAGE_KEY = 'baoyan-workbench-v1';
const STATUSES = { research: '待调研', preparing: '准备中', submitted: '已提交', interview: '待面试' };
const NAV = [
  ['dashboard', '工作台', 'home'], ['schools', '院校项目', 'building'],
  ['board', '申请看板', 'columns'], ['materials', '材料库', 'file'],
  ['calendar', '日程提醒', 'calendar'], ['interviews', '面试准备', 'users'],
  ['consult', 'AI 咨询', 'bookmark'],
  ['settings', '设置', 'settings']
];
const ICONS = {
  cap:'<path d="m2 10 10-5 10 5-10 5-10-5Z"/><path d="M6 12v5c3 2 9 2 12 0v-5M22 10v6"/>',
  home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
  building:'<path d="M4 21V7l8-4 8 4v14M9 21V9m6 12V9M3 21h18"/>',
  columns:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
  file:'<path d="M6 2h8l5 5v15H6z"/><path d="M14 2v6h5M9 13h7M9 17h7"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 10h18M8 14h2M14 14h2"/>',
  users:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.3 1a8 8 0 0 0-1.7-1L14.5 3h-4L10 6a8 8 0 0 0-1.7 1L6 6 4 9.5 6 11a8 8 0 0 0 0 2l-2 1.5L6 18l2.3-1a8 8 0 0 0 1.7 1l.5 3h4l.5-3a8 8 0 0 0 1.7-1l2.3 1 2-3.5-2-1.5a7 7 0 0 0 .1-1Z"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  plus:'<path d="M12 4v16M4 12h16"/>',
  bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  close:'<path d="M5 5l14 14M19 5 5 19"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
  upload:'<path d="M12 21V9m-4 4 4-4 4 4M4 7V3h16v4"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6M14 11v6"/>',
  pencil:'<path d="m4 17 11-11 3 3L7 20H4zM13 8l3 3"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.file}</svg>`;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const uid = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
const datePlus = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const DEFAULT_MATERIALS = ['个人简历','成绩单','本科排名证明','推荐信','个人陈述','其他材料'].map((name,i) => ({id:`base-${i}`,name,done:false}));
function demoState(){
  const names = ['目标院校 A · 计算机学院','目标院校 B · 电子工程学院','目标院校 C · 数学学院','目标院校 D · 人工智能学院','目标院校 E · 软件学院','目标院校 F · 数据科学学院','目标院校 G · 信息学院','目标院校 H · 自动化学院','目标院校 I · 计算机学院','目标院校 J · 交叉学科学院'];
  const statuses = ['research','research','research','preparing','preparing','preparing','submitted','submitted','interview','interview'];
  const offsets = [null,null,null,4,9,18,2,6,12,23];
  return {version:1,demo:true,projects:names.map((name,i)=>({id:uid(),name,status:statuses[i],type:i%3===0?'夏令营':'推免',deadline:offsets[i]===null?'':datePlus(offsets[i]),notes:''})),materials:DEFAULT_MATERIALS.map((m,i)=>({...m,done:i<2 || i===3})),reminders:[]};
}
let loadError = '';
function readState(){try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return demoState();return normalize(JSON.parse(raw));}catch{loadError='浏览器中已有的数据无法读取。请先在设置中导出备份，避免覆盖原始数据。';return demoState();}}
function normalize(value){
  if(!value || !Array.isArray(value.projects) || !Array.isArray(value.materials)) throw new Error('文件缺少项目或材料列表');
  if(value.projects.length>1000 || value.materials.length>500) throw new Error('数据条目过多');
  return {version:1,demo:!!value.demo,projects:value.projects.map(p=>({id:String(p.id||uid()),name:String(p.name||'').slice(0,120),status:STATUSES[p.status]?p.status:'research',type:String(p.type||'推免').slice(0,30),deadline:/^\d{4}-\d{2}-\d{2}$/.test(String(p.deadline||''))?String(p.deadline):'',notes:String(p.notes||'').slice(0,3000)})).filter(p=>p.name),materials:value.materials.map(m=>({id:String(m.id||uid()),name:String(m.name||'').slice(0,100),done:!!m.done})).filter(m=>m.name),reminders:(Array.isArray(value.reminders)?value.reminders:[]).slice(0,1000).map(r=>({id:String(r.id||uid()),title:String(r.title||'').slice(0,120),when:Number.isFinite(Date.parse(r.when))?new Date(r.when).toISOString():'',notes:String(r.notes||'').slice(0,1000),done:!!r.done,notifiedAt:r.notifiedAt||''})).filter(r=>r.title&&r.when)};
}
let state=demoState(), page='dashboard', query='', modal=null, toastTimer, desktopInfo=null, saveQueue=Promise.resolve();
let attachments=[], filesReady=false, fileError='', fileTarget=null;
const app=document.getElementById('app');
function persist(){
  if(window.desktopAPI){
    if(loadError){notify('本机清单读取失败，已停止写入以保护原文件');return false;}
    const snapshot=structuredClone(state);
    saveQueue=saveQueue.then(()=>window.desktopAPI.saveState(snapshot)).catch(error=>{notify(`本机清单保存失败：${error.message}`);});
    return true;
  }
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch{notify('浏览器无法保存数据。请检查存储权限并及时导出备份。');return false;}
}
function notify(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3600);}
function projects(){const q=query.trim().toLocaleLowerCase();return q?state.projects.filter(p=>[p.name,p.type,p.notes].some(v=>v.toLocaleLowerCase().includes(q))):state.projects;}
function upcoming(){return state.projects.filter(p=>p.deadline && p.status!=='submitted').sort((a,b)=>a.deadline.localeCompare(b.deadline));}
function fmtDate(value){if(!value)return '暂无日期';const [y,m,d]=value.split('-');return `${m}-${d}`;}
function fmtWhen(value){return new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));}
function localDateTimeInput(value){if(!value)return '';const d=new Date(value);const pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;}
function attachedTo(materialId){return attachments.filter(file=>file.materialId===materialId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
function fmtSize(bytes){if(bytes<1024)return `${bytes} B`;if(bytes<1024*1024)return `${(bytes/1024).toFixed(1)} KB`;return `${(bytes/1024/1024).toFixed(1)} MB`;}
async function refreshAttachments(){try{attachments=await window.localFiles.list();filesReady=true;fileError='';}catch(error){filesReady=false;fileError=error.message||'无法读取本地文件';}render();}
function render(){
  const privacy=window.desktopAPI?'<strong>本机独立保存</strong>项目、材料和咨询资料存于当前系统账户。主动发送 AI 咨询时，所选内容会发往配置的服务商。':'<strong>当前浏览器保存</strong>项目、材料和咨询资料存于当前浏览器。主动发送 AI 咨询时，所选内容会发往配置的服务商。';
  const footer=window.desktopAPI?'本应用不设账号或自建后端。完整备份请从托盘退出后复制设置页所示目录；主动发送 AI 咨询时，问题和所选资料会传给配置的服务商。':'本应用不设账号或自建后端。浏览器清理站点数据可能删除记录；主动发送 AI 咨询时，问题和所选资料会传给配置的服务商。';
  app.innerHTML=`<div class="app"><aside class="sidebar" id="sidebar"><div class="brand"><img class="brand-mark" src="./assets/logo.png" alt="" /><span>保研工作台</span></div><nav class="nav" aria-label="主导航">${NAV.map(([id,label,ic])=>`<button type="button" class="nav-btn ${page===id?'active':''}" data-action="nav" data-page="${id}">${icon(ic)}<span>${label}</span></button>`).join('')}</nav><div class="sidebar-bottom"><div class="privacy-note">${icon('lock')}${privacy}</div></div></aside><main class="main"><header class="topbar"><button type="button" class="icon-button mobile-menu" aria-label="打开导航" data-action="menu">${icon('menu')}</button><div class="top-search">${icon('search')}<input id="search" type="search" placeholder="搜索院校、项目或备注…" value="${esc(query)}" aria-label="搜索项目" /></div><div class="user-pill"><span class="avatar">我</span><span>本地使用者</span></div></header><div class="content">${loadError?`<div class="demo-banner">${esc(loadError)}</div>`:''}${state.demo?`<div class="demo-banner"><span>当前显示演示数据，院校名称和日期均为示例。</span><button type="button" data-action="start">开始我的规划 →</button></div>`:''}${renderPage()}<div class="footer-note">${footer}</div></div></main></div>${modal?renderModal():''}`;
  const search=document.getElementById('search');if(search && document.activeElement?.id==='search')search.focus();
}
function header(title,subtitle,actions=''){return `<div class="page-header"><div class="page-title"><h1>${title}</h1><p>${subtitle}</p></div><div class="header-actions">${actions}</div></div>`;}
function addButton(){return `<button class="btn btn-primary" type="button" data-action="add-project">${icon('plus')} 添加项目</button>`;}
function renderPage(){let content;switch(page){case 'schools':content=renderSchools();break;case 'board':content=renderBoardPage();break;case 'materials':content=renderMaterials();break;case 'calendar':content=renderCalendar();break;case 'interviews':content=renderInterviews();break;case 'consult':content=renderConsult();break;case 'settings':content=renderSettings();break;default:content=renderDashboard();}return (['dashboard','board','schools'].includes(page)?filterNotice():'')+content;}
function filterNotice(){return query.trim()?`<div class="filter-notice"><span>正在筛选“${esc(query.trim())}”：显示 ${projects().length} / ${state.projects.length} 个项目</span><button type="button" data-action="clear-search">清除筛选</button></div>`:'';}
function renderDashboard(){const soon=upcoming().filter(p=>p.deadline>=datePlus(0)&&p.deadline<=datePlus(7)).length;const pending=state.materials.filter(m=>!m.done).length;return `${header('申请总览','整理节奏，聚焦重点，及时处理下一步。',addButton())}<div class="dashboard-layout"><div class="primary-column"><div class="stats"><div class="stat-card"><span class="stat-icon mint">${icon('bookmark')}</span><div><div class="stat-label">关注项目</div><div class="stat-value">${state.projects.length}</div><div class="stat-hint">${window.desktopAPI?'当前电脑中的项目':'当前浏览器中的项目'}</div></div></div><div class="stat-card"><span class="stat-icon rose">${icon('calendar')}</span><div><div class="stat-label">未来 7 天截止</div><div class="stat-value">${soon}</div><div class="stat-hint">根据已填写日期计算</div></div></div><div class="stat-card"><span class="stat-icon peach">${icon('file')}</span><div><div class="stat-label">材料待完善</div><div class="stat-value">${pending}</div><div class="stat-hint">按清单状态统计</div></div></div></div>${boardPanel()}</div><div class="side-stack"><section class="panel"><div class="panel-header"><h2 class="panel-title">近期节点</h2><button class="panel-link" data-action="nav" data-page="calendar">查看全部</button></div>${timeline()}</section><section class="panel"><div class="panel-header"><h2 class="panel-title">材料清单</h2><button class="panel-link" data-action="nav" data-page="materials">查看全部</button></div>${materialRows()}</section></div></div>`;}
function boardPanel(){return `<section class="panel"><div class="panel-header"><h2 class="panel-title">申请进度看板</h2><div class="panel-tools"><button type="button" class="btn" data-action="nav" data-page="board">打开看板 ${icon('arrow')}</button></div></div>${kanban()}</section>`;}
function kanban(){const list=projects();return `<div class="kanban">${Object.entries(STATUSES).map(([key,label])=>{const items=list.filter(p=>p.status===key);return `<div class="lane" data-status="${key}"><div class="lane-title">${label} <span class="lane-count">${items.length}</span></div>${items.map(projectCard).join('')}${items.length===0?'<div class="empty">暂无项目</div>':''}<button class="lane-add" data-action="add-project" data-status="${key}">＋ 添加项目</button></div>`;}).join('')}</div>`;}
function projectCard(p){return `<article class="project-card"><div class="project-name">${esc(p.name)}</div><div class="project-meta"><span class="badge">${esc(p.type)}</span><span class="badge status">${STATUSES[p.status]}</span></div><div class="project-date">${icon('calendar')} ${p.deadline?`截止：${esc(p.deadline)}`:'暂无截止时间'}</div><div class="project-actions"><button type="button" data-action="edit-project" data-id="${esc(p.id)}">编辑</button><select class="stage-select" data-move-project="${esc(p.id)}" aria-label="移动${esc(p.name)}到其他阶段"><option value="">移动到…</option>${Object.entries(STATUSES).filter(([key])=>key!==p.status).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select><button type="button" class="delete-inline" data-action="delete-project" data-id="${esc(p.id)}">删除</button></div></article>`;}
function timeline(){const list=upcoming().slice(0,5);return list.length?`<div class="timeline">${list.map(p=>`<div class="timeline-item"><div class="timeline-date">${fmtDate(p.deadline)}</div><div class="timeline-text">${esc(p.name)}</div><div class="timeline-sub">${STATUSES[p.status]} · 截止日期</div></div>`).join('')}</div>`:'<div class="empty">暂无已设置日期的项目</div>';}
function materialRows(){return `<div class="material-list">${state.materials.slice(0,6).map(m=>`<label class="material-row"><span class="material-icon">${icon('file')}</span><span class="material-name">${esc(m.name)} <small>${attachedTo(m.id).length} 个文件</small></span><span class="material-state ${m.done?'done':''}">${m.done?'已完成':'待完善'}</span><input class="material-check" type="checkbox" data-material-id="${esc(m.id)}" ${m.done?'checked':''} aria-label="${esc(m.name)}已完成" /></label>`).join('')}</div>`;}
function renderSchools(){return `${header('院校项目','记录关注的申请项目；招生信息请以各院校官方通知为准。',addButton())}<div class="list-grid">${projects().map(p=>`<article class="panel list-card"><h3>${esc(p.name)}</h3><p>${p.notes?esc(p.notes):'尚未填写备注，可记录申请要求、链接或沟通事项。'}</p><div class="row"><span class="badge">${esc(p.type)}</span><span class="badge status">${STATUSES[p.status]}</span></div><div class="date">${p.deadline?`截止：${esc(p.deadline)}`:'尚未设置截止日期'}</div><div class="row"><button class="btn" data-action="edit-project" data-id="${esc(p.id)}">${icon('pencil')} 编辑</button><button class="btn btn-danger" data-action="delete-project" data-id="${esc(p.id)}">${icon('trash')} 删除</button></div></article>`).join('')||'<div class="panel empty">暂无项目。点击“添加项目”建立自己的清单。</div>'}</div>`;}
function renderBoardPage(){return `${header('申请看板','按阶段管理项目；在卡片中选择目标阶段或删除项目。',addButton())}${boardPanel()}`;}
function renderMaterials(){const desktop=!!window.desktopAPI;return `${header('材料库',desktop?'按条目管理文件和准备状态。材料文件保存在这台电脑。':'按条目管理文件和准备状态。上传文件仅保存在当前浏览器。',`<button class="btn btn-primary" data-action="add-material">${icon('plus')} 添加材料条目</button>`)}${fileError?`<div class="filter-notice">文件功能不可用：${esc(fileError)}。项目与清单仍可使用。</div>`:''}<div class="material-grid">${state.materials.map(materialCard).join('')||'<div class="panel empty">暂无材料条目。点击“添加材料条目”建立清单。</div>'}</div><p class="material-caution">${desktop?'文件存放在设置页显示的本机数据目录；完整备份请复制该目录。':'预览版的文件保存在浏览器本地存储中；清理站点数据可能删除文件。'} 设置中的 JSON 仅包含项目、清单和提醒，不包含上传文件。</p>`;}
function materialCard(m){const files=attachedTo(m.id);return `<section class="panel material-card"><div class="material-card-head"><label class="material-check-label"><input type="checkbox" data-material-id="${esc(m.id)}" ${m.done?'checked':''} aria-label="${esc(m.name)}已完成" /><span><strong>${esc(m.name)}</strong><small>${m.done?'已完成':'待完善'} · ${files.length} 个文件</small></span></label><div class="material-card-actions"><button type="button" class="icon-button" data-action="edit-material" data-id="${esc(m.id)}" aria-label="修改${esc(m.name)}名称">${icon('pencil')}</button><button type="button" class="icon-button" data-action="delete-material" data-id="${esc(m.id)}" aria-label="删除${esc(m.name)}条目及文件">${icon('trash')}</button></div></div><div class="attachment-list">${files.map(file=>`<div class="attachment-row"><span class="attachment-icon">${icon('file')}</span><div class="attachment-info"><strong title="${esc(file.name)}">${esc(file.name)}</strong><small>${fmtSize(file.size)} · ${esc(file.updatedAt.slice(0,10))}</small></div><div class="attachment-actions"><button type="button" data-action="download-file" data-id="${esc(file.id)}">${window.desktopAPI?'另存为':'下载'}</button><button type="button" data-action="replace-file" data-id="${esc(file.id)}" ${filesReady?'':'disabled'}>更换</button><button type="button" data-action="delete-file" data-id="${esc(file.id)}">删除</button></div></div>`).join('')||'<div class="attachment-empty">尚未上传文件</div>'}</div><button type="button" class="btn attachment-add" data-action="add-file" data-id="${esc(m.id)}" ${filesReady?'':'disabled'}>${icon('plus')} ${window.desktopAPI?'添加本地文件':'上传文件'}</button></section>`;}
function renderCalendar(){
  const reminders=[...state.reminders].sort((a,b)=>Number(a.done)-Number(b.done)||a.when.localeCompare(b.when));
  const explain=window.desktopAPI?'应用运行或留在托盘时，到点会发送电脑系统通知；完全退出后，下次启动会补发错过的提醒。':'网页预览可以记录提醒，但系统通知只在桌面应用中生效。';
  return `${header('日程提醒','为事项设置明确的提醒日期与时间。',`<button class="btn btn-primary" data-action="add-reminder">${icon('plus')} 添加提醒</button>`)}<div class="reminder-notice">${esc(explain)}${window.desktopAPI?`<button type="button" data-action="test-notification">发送测试通知</button>`:''}</div><section class="panel"><div class="panel-header"><h2 class="panel-title">我的提醒</h2><span class="subtle-count">${reminders.filter(r=>!r.done).length} 条待处理</span></div><div class="reminder-list">${reminders.map(reminderCard).join('')||'<div class="empty">尚未设置提醒。点击“添加提醒”选择具体时间。</div>'}</div></section><section class="panel" style="margin-top:16px"><div class="panel-header"><h2 class="panel-title">申请项目日期</h2></div><div class="calendar-list">${upcoming().map(p=>`<div class="calendar-row"><div class="calendar-day">${p.deadline.slice(8)}<small>${p.deadline.slice(0,7)}</small></div><div><strong>${esc(p.name)}</strong><p>${STATUSES[p.status]} · ${esc(p.type)} · 此日期本身不会触发系统通知</p></div><button class="btn" data-action="remind-project" data-id="${esc(p.id)}">设提醒</button></div>`).join('')||'<div class="empty">暂无已设置截止日期的项目。</div>'}</div></section>`;
}
function reminderCard(r){const overdue=!r.done&&Date.parse(r.when)<Date.now();const stateLabel=r.done?'已完成':r.notifiedAt?'已提醒':overdue?'已到时间':'待提醒';return `<article class="reminder-item"><span class="reminder-icon">${icon('calendar')}</span><div class="reminder-info"><strong>${esc(r.title)}</strong><time datetime="${esc(r.when)}">${fmtWhen(r.when)}</time>${r.notes?`<p>${esc(r.notes)}</p>`:''}<span class="badge ${r.done?'status':''}">${stateLabel}</span></div><div class="reminder-actions"><button type="button" class="btn" data-action="toggle-reminder" data-id="${esc(r.id)}">${r.done?'恢复':'完成'}</button><button type="button" class="btn" data-action="edit-reminder" data-id="${esc(r.id)}">编辑</button><button type="button" class="btn btn-danger" data-action="delete-reminder" data-id="${esc(r.id)}">删除</button></div></article>`;}
function renderInterviews(){const list=state.projects.filter(p=>p.status==='interview');return `${header('面试准备','集中查看进入面试阶段的项目。',addButton())}<div class="list-grid">${list.map(p=>`<article class="panel list-card"><h3>${esc(p.name)}</h3><p>${p.notes?esc(p.notes):'可在项目备注中记录面试形式、准备事项和待确认的问题。'}</p><div class="date">${p.deadline?`记录日期：${esc(p.deadline)}`:'尚未设置日期'}</div><button class="btn" data-action="edit-project" data-id="${esc(p.id)}">${icon('pencil')} 编辑准备笔记</button></article>`).join('')||'<div class="panel empty">暂无待面试项目。可在申请看板中调整项目阶段。</div>'}</div><section class="panel" style="margin-top:15px"><div class="panel-header"><h2 class="panel-title">通用准备清单</h2></div><div class="interview-tips"><div class="tip"><strong>项目梳理</strong><p>列出研究背景、本人贡献、方法、结果和局限。</p></div><div class="tip"><strong>材料复核</strong><p>核对简历与提交材料中的日期、成绩和项目描述。</p></div><div class="tip"><strong>问题记录</strong><p>把需要向院校确认的事项写入对应项目备注。</p></div></div></section>`;}
function renderSettingsBase(){
  const desktop=!!window.desktopAPI;
  const desktopCards=desktop?`<section class="panel settings-card"><h3>系统提醒</h3><p>关闭窗口后应用会留在系统托盘，提醒仍可触发。完全退出后，错过的提醒会在下次启动时补发。${desktopInfo?.notificationsSupported===false?'当前系统报告不支持通知。':''}</p><button class="btn" data-action="test-notification">${icon('calendar')} 发送测试通知</button><label class="settings-toggle"><input id="auto-launch" type="checkbox" ${desktopInfo?.autoLaunch?'checked':''} ${desktopInfo&&['win32','darwin'].includes(desktopInfo.platform)?'':'disabled'} /> 开机启动应用</label></section><section class="panel settings-card"><h3>本机数据目录</h3><p>清单与上传文件存放在：<br><code class="data-path">${esc(desktopInfo?.dataPath||'正在读取…')}</code></p><button class="btn" data-action="open-data-directory">打开数据目录</button><p>完整备份时，请先从托盘退出应用，再复制整个目录。</p></section>`:'';
  return `${header('设置与数据',desktop?'清单和材料文件保存在当前电脑的应用数据目录。':'项目清单与上传文件保存在当前浏览器。')}<div class="settings-grid">${desktopCards}<section class="panel settings-card"><h3>导出清单</h3><p>JSON 包含项目、材料清单和提醒，不包含上传的文件。${desktop?'完整备份请复制本机数据目录。':'文件请在材料库逐一下载。'}</p><button class="btn" data-action="export">${icon('download')} 导出清单 JSON</button></section><section class="panel settings-card"><h3>导入清单</h3><p>导入 JSON 会替换清单和提醒，并删除当前存储中的上传文件。请先备份重要文件。</p><button class="btn" data-action="import">${icon('upload')} 选择 JSON</button></section><section class="panel settings-card"><h3>清空本机数据</h3><p>删除项目、材料清单、提醒及全部上传文件。此操作不能撤销。</p><button class="btn btn-danger" data-action="clear">${icon('trash')} 清空数据</button></section><section class="panel settings-card"><h3>隐私与适用范围</h3><p>本版本无登录、后端、分析脚本或远程同步。${desktop?'每个系统账户使用自己的应用数据目录。':'不同浏览器配置文件的数据相互独立。'}</p></section></div>`;
}
function renderSettings(){
  return renderSettingsBase().replace('<div class="settings-grid">', `${renderApiSettings()}<div class="settings-grid">`);
}
function renderModal(){
  if(modal.kind==='confirm-reminder-delete'){
    const r=state.reminders.find(x=>x.id===modal.id);
    return `<div class="modal-backdrop" data-action="close-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="delete-reminder-title"><h2 id="delete-reminder-title">删除提醒</h2><p>确定删除“${esc(r?.title||'该提醒')}”？</p><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button type="button" class="btn btn-danger" data-action="confirm-delete-reminder" data-id="${esc(modal.id)}">确认删除</button></div></div></div>`;
  }
  if(modal.kind==='reminder'){
    const r=modal.id?state.reminders.find(x=>x.id===modal.id):null;
    return `<div class="modal-backdrop" data-action="close-backdrop"><form class="modal" id="reminder-form"><h2>${r?'编辑提醒':'添加提醒'}</h2><div class="field"><label for="reminder-title">提醒事项 *</label><input id="reminder-title" name="title" maxlength="120" required value="${esc(r?.title||modal.prefillTitle||'')}" placeholder="例如：提交申请材料" autofocus /></div><div class="field"><label for="reminder-when">提醒日期与时间 *</label><input id="reminder-when" name="when" type="datetime-local" required value="${esc(localDateTimeInput(r?.when)||modal.prefillWhen||'')}" /></div><div class="field"><label for="reminder-notes">备注</label><textarea id="reminder-notes" name="notes" maxlength="1000" placeholder="只在应用内显示，不写入系统通知">${esc(r?.notes||'')}</textarea></div><p class="form-hint">到点时系统通知显示提醒标题。设置过去的时间会在桌面应用保存后触发。</p><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button type="submit" class="btn btn-primary">保存提醒</button></div></form></div>`;
  }
  if(modal.kind==='confirm-material-delete'){
    const m=state.materials.find(x=>x.id===modal.id),count=attachedTo(modal.id).length;
    return `<div class="modal-backdrop" data-action="close-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="delete-material-title"><h2 id="delete-material-title">删除材料条目</h2><p>确定删除“${esc(m?.name||'该材料')}”及其 ${count} 个已上传文件？此操作无法撤销。</p><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button type="button" class="btn btn-danger" data-action="confirm-delete-material" data-id="${esc(modal.id)}">确认删除</button></div></div></div>`;
  }
  if(modal.kind==='confirm-file-delete'){
    const file=attachments.find(x=>x.id===modal.id);
    return `<div class="modal-backdrop" data-action="close-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="delete-file-title"><h2 id="delete-file-title">删除文件</h2><p>确定删除“${esc(file?.name||'该文件')}”？此操作无法撤销。</p><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button type="button" class="btn btn-danger" data-action="confirm-delete-file" data-id="${esc(modal.id)}">确认删除</button></div></div></div>`;
  }
  if(modal.kind==='confirm-delete'){
    const p=state.projects.find(x=>x.id===modal.id);
    return `<div class="modal-backdrop" data-action="close-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">删除项目</h2><p>确定删除“${esc(p?.name||'该项目')}”？删除后无法恢复。</p><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button type="button" class="btn btn-danger" data-action="confirm-delete-project" data-id="${esc(modal.id)}">确认删除</button></div></div></div>`;
  }
  if(modal.kind==='project'){const p=modal.id?state.projects.find(x=>x.id===modal.id):null;return `<div class="modal-backdrop" data-action="close-backdrop"><form class="modal" id="project-form"><h2>${p?'编辑项目':'添加项目'}</h2><div class="field"><label for="project-name">院校 / 项目名称 *</label><input id="project-name" name="name" maxlength="120" required value="${esc(p?.name||'')}" placeholder="例如：某大学 · 某学院" autofocus /></div><div class="field"><label for="project-type">申请类型</label><select id="project-type" name="type">${['推免','夏令营','预推免','其他'].map(t=>`<option ${p?.type===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="field"><label for="project-status">当前阶段</label><select id="project-status" name="status">${Object.entries(STATUSES).map(([k,v])=>`<option value="${k}" ${(p?.status||modal.status||'research')===k?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label for="project-deadline">申请截止日期（不自动提醒）</label><input id="project-deadline" name="deadline" type="date" value="${esc(p?.deadline||'')}" /></div><div class="field"><label for="project-notes">备注</label><textarea id="project-notes" name="notes" maxlength="3000" placeholder="记录待办、要求或官方通知链接">${esc(p?.notes||'')}</textarea></div><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button type="submit" class="btn btn-primary">保存项目</button></div></form></div>`;}
  const m=modal.id?state.materials.find(x=>x.id===modal.id):null;
  return `<div class="modal-backdrop" data-action="close-backdrop"><form class="modal" id="material-form"><h2>${m?'修改材料条目':'添加材料条目'}</h2><div class="field"><label for="material-name">材料名称 *</label><input id="material-name" name="name" maxlength="100" required value="${esc(m?.name||'')}" placeholder="例如：英语成绩证明" autofocus /></div><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button type="submit" class="btn btn-primary">${m?'保存修改':'添加条目'}</button></div></form></div>`;
}
function openModal(value){modal=value;render();document.querySelector('.modal [autofocus]')?.focus();}
function closeModal(){modal=null;render();}
document.addEventListener('click',async e=>{
  const button=e.target.closest('[data-action]');if(!button)return;const action=button.dataset.action,id=button.dataset.id;
  if(await handleConsultAction(action))return;
  if(action==='close-backdrop' && e.target!==button)return;
  if(action==='nav'){page=button.dataset.page;document.getElementById('sidebar')?.classList.remove('open');render();window.scrollTo(0,0);}
  else if(action==='clear-search'){query='';render();notify('筛选已清除');}
  else if(action==='menu')document.getElementById('sidebar')?.classList.toggle('open');
  else if(action==='start'){if(loadError && !confirm('现有数据无法读取。建立新工作台会覆盖原有数据，确定继续？'))return;try{if(filesReady){await window.localFiles.clearAll();attachments=[];}}catch(error){notify(`无法清理演示文件：${error.message}`);return;}loadError='';state={version:1,demo:false,projects:[],materials:DEFAULT_MATERIALS.map(m=>({...m})),reminders:[]};persist();render();notify('已建立空白工作台');}
  else if(action==='add-project')openModal({kind:'project',status:button.dataset.status||'research'});
  else if(action==='edit-project')openModal({kind:'project',id});
  else if(action==='add-reminder')openModal({kind:'reminder'});
  else if(action==='edit-reminder')openModal({kind:'reminder',id});
  else if(action==='remind-project'){const project=state.projects.find(x=>x.id===id);if(project)openModal({kind:'reminder',prefillTitle:`${project.name} · 申请节点`,prefillWhen:`${project.deadline}T09:00`});}
  else if(action==='toggle-reminder'){const reminder=state.reminders.find(x=>x.id===id);if(reminder){reminder.done=!reminder.done;persist();render();notify(reminder.done?'提醒已完成':'提醒已恢复');}}
  else if(action==='delete-reminder')openModal({kind:'confirm-reminder-delete',id});
  else if(action==='confirm-delete-reminder'){state.reminders=state.reminders.filter(x=>x.id!==id);persist();closeModal();notify('提醒已删除');}
  else if(action==='test-notification'){try{const supported=await window.desktopAPI?.testNotification();notify(supported?'已请求系统发送测试通知':'当前系统未提供通知支持，请检查系统设置');}catch(error){notify(`测试通知失败：${error.message}`);}}
  else if(action==='open-data-directory'){try{await window.desktopAPI?.openDataDirectory();}catch(error){notify(`打开数据目录失败：${error.message}`);}}
  else if(action==='add-material')openModal({kind:'material'});
  else if(action==='edit-material')openModal({kind:'material',id});
  else if(action==='add-file'){if(window.desktopAPI){try{const added=await window.localFiles.choose(id,null);if(added){attachments.push(added.record);render();notify('文件已保存到电脑本地目录');}}catch(error){notify(`添加文件失败：${error.message}`);}}else{fileTarget={materialId:id};document.getElementById('material-file').click();}}
  else if(action==='replace-file'){const file=attachments.find(x=>x.id===id);if(file){if(window.desktopAPI){try{const added=await window.localFiles.choose(file.materialId,id);if(added){attachments=attachments.filter(x=>x.id!==id).concat(added.record);render();notify('文件已更换');}}catch(error){notify(`更换文件失败：${error.message}`);}}else{fileTarget={materialId:file.materialId,replaceId:id};document.getElementById('material-file').click();}}}
  else if(action==='download-file'){const file=attachments.find(x=>x.id===id);if(file){if(window.desktopAPI){try{if(await window.localFiles.download(id))notify('文件已另存到所选位置');}catch(error){notify(`另存失败：${error.message}`);}}else{const url=URL.createObjectURL(file.blob);const link=document.createElement('a');link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}}}
  else if(action==='close'||action==='close-backdrop')closeModal();
  else if(action==='delete-project')openModal({kind:'confirm-delete',id});
  else if(action==='confirm-delete-project'){state.projects=state.projects.filter(x=>x.id!==id);const saved=persist();closeModal();notify(saved?'项目已删除':'项目已从当前页面移除，但浏览器无法保存');}
  else if(action==='delete-material')openModal({kind:'confirm-material-delete',id});
  else if(action==='confirm-delete-material'){try{await window.localFiles.removeForMaterial(id);attachments=attachments.filter(x=>x.materialId!==id);state.materials=state.materials.filter(x=>x.id!==id);persist();closeModal();notify('材料条目及文件已删除');}catch(error){notify(`删除失败：${error.message}`);}}
  else if(action==='delete-file')openModal({kind:'confirm-file-delete',id});
  else if(action==='confirm-delete-file'){try{await window.localFiles.remove(id);attachments=attachments.filter(x=>x.id!==id);closeModal();notify('文件已删除');}catch(error){notify(`删除失败：${error.message}`);}}
  else if(action==='clear'){if(confirm('清空项目、材料条目、提醒、咨询资料、API 配置及所有上传文件？此操作无法撤销。')){try{await window.localFiles.clearAll();attachments=[];await clearAllConsult();}catch(error){notify(`无法清理本机数据：${error.message}`);return;}state={version:1,demo:false,projects:[],materials:DEFAULT_MATERIALS.map(m=>({...m})),reminders:[]};persist();page='dashboard';render();notify('本机数据已清空');}}
  else if(action==='export')exportData();
  else if(action==='import')document.getElementById('import-file').click();
});
document.addEventListener('submit',e=>{
  if(e.target.id==='project-form'){e.preventDefault();const data=new FormData(e.target),name=String(data.get('name')||'').trim();if(!name)return;const current=modal.id?state.projects.find(x=>x.id===modal.id):null;const record={id:current?.id||uid(),name,status:String(data.get('status')),type:String(data.get('type')),deadline:String(data.get('deadline')||''),notes:String(data.get('notes')||'').trim()};if(current)Object.assign(current,record);else state.projects.push(record);const saved=persist();query='';closeModal();notify(saved?(current?'项目已更新':'项目已添加，已显示在看板中'):'浏览器无法保存项目；请立即导出备份');}
  if(e.target.id==='material-form'){e.preventDefault();const name=String(new FormData(e.target).get('name')||'').trim();if(!name)return;const current=modal.id?state.materials.find(x=>x.id===modal.id):null;if(current)current.name=name;else state.materials.push({id:uid(),name,done:false});const saved=persist();closeModal();notify(saved?(current?'材料名称已修改':'材料条目已添加'):'浏览器无法保存清单；请导出备份');}
  if(e.target.id==='reminder-form'){e.preventDefault();const data=new FormData(e.target),title=String(data.get('title')||'').trim(),whenValue=String(data.get('when')||'');const when=new Date(whenValue);if(!title||!Number.isFinite(when.getTime())){notify('请填写有效的提醒事项和时间');return;}const current=modal.id?state.reminders.find(x=>x.id===modal.id):null;const record={id:current?.id||uid(),title,when:when.toISOString(),notes:String(data.get('notes')||'').trim(),done:false,notifiedAt:''};if(current)Object.assign(current,record);else state.reminders.push(record);persist();closeModal();notify(current?'提醒已更新':'提醒已保存');}
});
document.addEventListener('change',async e=>{
  if(e.target.id==='auto-launch'){
    try{const enabled=await window.desktopAPI.setAutoLaunch(e.target.checked);desktopInfo.autoLaunch=enabled;render();notify(enabled?'已设置开机启动':'已关闭开机启动');}
    catch(error){render();notify(`开机启动设置失败：${error.message}`);}
    return;
  }
  const moveId=e.target.dataset.moveProject;
  if(moveId){const p=state.projects.find(x=>x.id===moveId),status=e.target.value;if(p && STATUSES[status]){p.status=status;const saved=persist();render();notify(saved?`已移到“${STATUSES[status]}”`:'阶段已在当前页面变化，但浏览器无法保存');}return;}
  const id=e.target.dataset.materialId;if(!id)return;const m=state.materials.find(x=>x.id===id);if(m){m.done=e.target.checked;persist();render();}
});
document.addEventListener('input',e=>{if(handleConsultInput(e))return;if(e.target.id!=='search')return;query=e.target.value;const start=e.target.selectionStart;render();const input=document.getElementById('search');input.focus();input.setSelectionRange(start,start);});
document.addEventListener('keydown',e=>{if(e.key==='Escape' && modal)closeModal();});
function exportData(){const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString(),attachmentsExcluded:true},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`保研工作台-清单-${datePlus(0)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('清单已下载；上传文件不包含在 JSON 中');}
document.getElementById('import-file').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;if(file.size>2*1024*1024){notify('文件超过 2 MB，未导入');return;}try{const incoming=normalize(JSON.parse(await file.text()));if(!confirm(`导入 ${incoming.projects.length} 个项目和 ${incoming.materials.length} 条材料？当前清单和上传文件将被删除。请先下载重要文件。`))return;await window.localFiles.clearAll();attachments=[];incoming.demo=false;state=incoming;if(persist()){page='dashboard';render();notify('清单已导入；JSON 不包含上传文件');}}catch(err){notify(`导入失败：${err.message}`);}});
document.getElementById('material-file').addEventListener('change',async e=>{
  const file=e.target.files?.[0],target=fileTarget;
  e.target.value='';fileTarget=null;
  if(!file||!target)return;
  if(!state.materials.some(m=>m.id===target.materialId)){notify('材料条目已不存在');return;}
  const record={id:target.replaceId||uid(),materialId:target.materialId,name:file.name,type:file.type||'application/octet-stream',size:file.size,updatedAt:new Date().toISOString(),blob:file};
  try{await window.localFiles.put(record);attachments=attachments.filter(x=>x.id!==record.id).concat(record);render();notify(target.replaceId?'文件已更换并保存在本机':'文件已上传到本机浏览器');}
  catch(error){notify(`文件保存失败：${error.message}。请检查浏览器存储空间。`);}
});
async function initialize(){
  if(window.desktopAPI){
    try{const saved=await window.desktopAPI.loadState();state=saved?normalize(saved):demoState();}
    catch(error){loadError=`无法读取本机清单：${error.message}。请先检查数据目录，避免覆盖原文件。`;state=demoState();}
    try{desktopInfo=await window.desktopAPI.getInfo();}
    catch(error){desktopInfo={dataPath:'读取失败',platform:'unknown',notificationsSupported:false,autoLaunch:false};console.error(error);}
    window.desktopAPI.onRemindersUpdated(reminders=>{state.reminders=reminders;if(!modal)render();});
    window.desktopAPI.onNavigate(destination=>{if(destination==='calendar'){page='calendar';render();}});
  }else state=readState();
  await initializeConsult();
  render();
  await refreshAttachments();
}
initialize();
