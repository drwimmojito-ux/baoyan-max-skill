/* 保研工作台：全部个人数据仅由当前浏览器保存。 */
const STORAGE_KEY = 'baoyan-workbench-v1';
const STATUSES = { research: '待调研', preparing: '准备中', submitted: '已提交', interview: '待面试' };
const NAV = [
  ['dashboard', '工作台', 'home'], ['schools', '院校项目', 'building'],
  ['board', '申请看板', 'columns'], ['materials', '材料库', 'file'],
  ['calendar', '日程提醒', 'calendar'], ['interviews', '面试准备', 'users'],
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
  return {version:1,demo:true,projects:names.map((name,i)=>({id:uid(),name,status:statuses[i],type:i%3===0?'夏令营':'推免',deadline:offsets[i]===null?'':datePlus(offsets[i]),notes:''})),materials:DEFAULT_MATERIALS.map((m,i)=>({...m,done:i<2 || i===3}))};
}
let loadError = '';
function readState(){try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return demoState();return normalize(JSON.parse(raw));}catch{loadError='浏览器中已有的数据无法读取。请先在设置中导出备份，避免覆盖原始数据。';return demoState();}}
function normalize(value){
  if(!value || !Array.isArray(value.projects) || !Array.isArray(value.materials)) throw new Error('文件缺少项目或材料列表');
  if(value.projects.length>1000 || value.materials.length>500) throw new Error('数据条目过多');
  return {version:1,demo:!!value.demo,projects:value.projects.map(p=>({id:String(p.id||uid()),name:String(p.name||'').slice(0,120),status:STATUSES[p.status]?p.status:'research',type:String(p.type||'推免').slice(0,30),deadline:/^\d{4}-\d{2}-\d{2}$/.test(String(p.deadline||''))?String(p.deadline):'',notes:String(p.notes||'').slice(0,3000)})).filter(p=>p.name),materials:value.materials.map(m=>({id:String(m.id||uid()),name:String(m.name||'').slice(0,100),done:!!m.done})).filter(m=>m.name)};
}
let state=readState(), page='dashboard', query='', modal=null, toastTimer;
const app=document.getElementById('app');
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch{notify('浏览器无法保存数据。请检查存储权限并及时导出备份。');return false;}}
function notify(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3600);}
function projects(){const q=query.trim().toLocaleLowerCase();return q?state.projects.filter(p=>[p.name,p.type,p.notes].some(v=>v.toLocaleLowerCase().includes(q))):state.projects;}
function upcoming(){return state.projects.filter(p=>p.deadline && p.status!=='submitted').sort((a,b)=>a.deadline.localeCompare(b.deadline));}
function fmtDate(value){if(!value)return '暂无日期';const [y,m,d]=value.split('-');return `${m}-${d}`;}
function render(){
  app.innerHTML=`<div class="app"><aside class="sidebar" id="sidebar"><div class="brand"><img class="brand-mark" src="./assets/logo.png" alt="" /><span>保研工作台</span></div><nav class="nav" aria-label="主导航">${NAV.map(([id,label,ic])=>`<button type="button" class="nav-btn ${page===id?'active':''}" data-action="nav" data-page="${id}">${icon(ic)}<span>${label}</span></button>`).join('')}</nav><div class="sidebar-bottom"><div class="privacy-note">${icon('lock')}<strong>只存于当前浏览器</strong>你的项目和材料状态保存在本机浏览器中。换设备前请在设置中导出备份。</div></div></aside><main class="main"><header class="topbar"><button type="button" class="icon-button mobile-menu" aria-label="打开导航" data-action="menu">${icon('menu')}</button><div class="top-search">${icon('search')}<input id="search" type="search" placeholder="搜索院校、项目或备注…" value="${esc(query)}" aria-label="搜索项目" /></div><div class="user-pill"><span class="avatar">我</span><span>本地使用者</span></div></header><div class="content">${loadError?`<div class="demo-banner">${esc(loadError)}</div>`:''}${state.demo?`<div class="demo-banner"><span>当前显示演示数据，院校名称和日期均为示例。</span><button type="button" data-action="start">开始我的规划 →</button></div>`:''}${renderPage()}<div class="footer-note">本应用不设账号，也不向服务器提交个人数据。浏览器清理站点数据可能删除记录，请定期导出备份。</div></div></main></div>${modal?renderModal():''}`;
  const search=document.getElementById('search');if(search && document.activeElement?.id==='search')search.focus();
}
function header(title,subtitle,actions=''){return `<div class="page-header"><div class="page-title"><h1>${title}</h1><p>${subtitle}</p></div><div class="header-actions">${actions}</div></div>`;}
function addButton(){return `<button class="btn btn-primary" type="button" data-action="add-project">${icon('plus')} 添加项目</button>`;}
function renderPage(){switch(page){case 'schools':return renderSchools();case 'board':return renderBoardPage();case 'materials':return renderMaterials();case 'calendar':return renderCalendar();case 'interviews':return renderInterviews();case 'settings':return renderSettings();default:return renderDashboard();}}
function renderDashboard(){const soon=upcoming().filter(p=>p.deadline>=datePlus(0)&&p.deadline<=datePlus(7)).length;const pending=state.materials.filter(m=>!m.done).length;return `${header('申请总览','整理节奏，聚焦重点，及时处理下一步。',addButton())}<div class="dashboard-layout"><div class="primary-column"><div class="stats"><div class="stat-card"><span class="stat-icon mint">${icon('bookmark')}</span><div><div class="stat-label">关注项目</div><div class="stat-value">${state.projects.length}</div><div class="stat-hint">当前浏览器中的项目</div></div></div><div class="stat-card"><span class="stat-icon rose">${icon('calendar')}</span><div><div class="stat-label">未来 7 天截止</div><div class="stat-value">${soon}</div><div class="stat-hint">根据已填写日期计算</div></div></div><div class="stat-card"><span class="stat-icon peach">${icon('file')}</span><div><div class="stat-label">材料待完善</div><div class="stat-value">${pending}</div><div class="stat-hint">按清单状态统计</div></div></div></div>${boardPanel()}</div><div class="side-stack"><section class="panel"><div class="panel-header"><h2 class="panel-title">近期节点</h2><button class="panel-link" data-action="nav" data-page="calendar">查看全部</button></div>${timeline()}</section><section class="panel"><div class="panel-header"><h2 class="panel-title">材料清单</h2><button class="panel-link" data-action="nav" data-page="materials">查看全部</button></div>${materialRows()}</section></div></div>`;}
function boardPanel(){return `<section class="panel"><div class="panel-header"><h2 class="panel-title">申请进度看板</h2><div class="panel-tools"><button type="button" class="btn" data-action="nav" data-page="board">打开看板 ${icon('arrow')}</button></div></div>${kanban()}</section>`;}
function kanban(){const list=projects();return `<div class="kanban">${Object.entries(STATUSES).map(([key,label])=>{const items=list.filter(p=>p.status===key);return `<div class="lane" data-status="${key}"><div class="lane-title">${label} <span class="lane-count">${items.length}</span></div>${items.map(projectCard).join('')}${items.length===0?'<div class="empty">暂无项目</div>':''}<button class="lane-add" data-action="add-project" data-status="${key}">＋ 添加项目</button></div>`;}).join('')}</div>`;}
function projectCard(p){return `<article class="project-card"><div class="project-name">${esc(p.name)}</div><div class="project-meta"><span class="badge">${esc(p.type)}</span><span class="badge status">${STATUSES[p.status]}</span></div><div class="project-date">${icon('calendar')} ${p.deadline?`截止：${esc(p.deadline)}`:'暂无截止时间'}</div><div class="project-actions"><button data-action="edit-project" data-id="${esc(p.id)}">编辑</button>${p.status!=='interview'?`<button data-action="advance" data-id="${esc(p.id)}">下一阶段 →</button>`:''}</div></article>`;}
function timeline(){const list=upcoming().slice(0,5);return list.length?`<div class="timeline">${list.map(p=>`<div class="timeline-item"><div class="timeline-date">${fmtDate(p.deadline)}</div><div class="timeline-text">${esc(p.name)}</div><div class="timeline-sub">${STATUSES[p.status]} · 截止日期</div></div>`).join('')}</div>`:'<div class="empty">暂无已设置日期的项目</div>';}
function materialRows(){return `<div class="material-list">${state.materials.slice(0,6).map(m=>`<label class="material-row"><span class="material-icon">${icon('file')}</span><span class="material-name">${esc(m.name)}</span><span class="material-state ${m.done?'done':''}">${m.done?'已完成':'待完善'}</span><input class="material-check" type="checkbox" data-material-id="${esc(m.id)}" ${m.done?'checked':''} aria-label="${esc(m.name)}已完成" /></label>`).join('')}</div>`;}
function renderSchools(){return `${header('院校项目','记录关注的申请项目；招生信息请以各院校官方通知为准。',addButton())}<div class="list-grid">${projects().map(p=>`<article class="panel list-card"><h3>${esc(p.name)}</h3><p>${p.notes?esc(p.notes):'尚未填写备注，可记录申请要求、链接或沟通事项。'}</p><div class="row"><span class="badge">${esc(p.type)}</span><span class="badge status">${STATUSES[p.status]}</span></div><div class="date">${p.deadline?`截止：${esc(p.deadline)}`:'尚未设置截止日期'}</div><div class="row"><button class="btn" data-action="edit-project" data-id="${esc(p.id)}">${icon('pencil')} 编辑</button><button class="btn btn-danger" data-action="delete-project" data-id="${esc(p.id)}">${icon('trash')} 删除</button></div></article>`).join('')||'<div class="panel empty">暂无项目。点击“添加项目”建立自己的清单。</div>'}</div>`;}
function renderBoardPage(){return `${header('申请看板','按阶段管理项目；“下一阶段”可快速推进状态。',addButton())}${boardPanel()}`;}
function renderMaterials(){return `${header('材料库','勾选准备进度；请勿在此存放证件扫描件等敏感文件。',`<button class="btn btn-primary" data-action="add-material">${icon('plus')} 添加材料</button>`)}<div class="check-grid">${state.materials.map(m=>`<div class="panel check-card"><input type="checkbox" data-material-id="${esc(m.id)}" ${m.done?'checked':''} aria-label="${esc(m.name)}已完成" /><div><strong>${esc(m.name)}</strong><small>${m.done?'已完成':'待完善'}</small></div><button class="icon-button delete" data-action="delete-material" data-id="${esc(m.id)}" aria-label="删除${esc(m.name)}">${icon('trash')}</button></div>`).join('')||'<div class="panel empty">暂无材料条目。</div>'}</div>`;}
function renderCalendar(){return `${header('日程提醒','按截止日期查看申请项目。当前版本仅提供页面内时间线。',addButton())}<section class="panel"><div class="panel-header"><h2 class="panel-title">时间线</h2></div><div class="calendar-list">${upcoming().map(p=>`<div class="calendar-row"><div class="calendar-day">${p.deadline.slice(8)}<small>${p.deadline.slice(0,7)}</small></div><div><strong>${esc(p.name)}</strong><p>${STATUSES[p.status]} · ${esc(p.type)}</p></div><button class="btn" data-action="edit-project" data-id="${esc(p.id)}">编辑</button></div>`).join('')||'<div class="empty">暂无已设置截止日期的项目。</div>'}</div></section>`;}
function renderInterviews(){const list=state.projects.filter(p=>p.status==='interview');return `${header('面试准备','集中查看进入面试阶段的项目。',addButton())}<div class="list-grid">${list.map(p=>`<article class="panel list-card"><h3>${esc(p.name)}</h3><p>${p.notes?esc(p.notes):'可在项目备注中记录面试形式、准备事项和待确认的问题。'}</p><div class="date">${p.deadline?`记录日期：${esc(p.deadline)}`:'尚未设置日期'}</div><button class="btn" data-action="edit-project" data-id="${esc(p.id)}">${icon('pencil')} 编辑准备笔记</button></article>`).join('')||'<div class="panel empty">暂无待面试项目。可在申请看板中调整项目阶段。</div>'}</div><section class="panel" style="margin-top:15px"><div class="panel-header"><h2 class="panel-title">通用准备清单</h2></div><div class="interview-tips"><div class="tip"><strong>项目梳理</strong><p>列出研究背景、本人贡献、方法、结果和局限。</p></div><div class="tip"><strong>材料复核</strong><p>核对简历与提交材料中的日期、成绩和项目描述。</p></div><div class="tip"><strong>问题记录</strong><p>把需要向院校确认的事项写入对应项目备注。</p></div></div></section>`;}
function renderSettings(){return `${header('设置与数据','所有项目数据保存在此设备的当前浏览器站点存储中。')}<div class="settings-grid"><section class="panel settings-card"><h3>导出备份</h3><p>下载 JSON 文件，用于自己保存或迁移到另一个设备。导出文件可能包含个人备注，请妥善保管。</p><button class="btn" data-action="export">${icon('download')} 导出 JSON</button></section><section class="panel settings-card"><h3>导入备份</h3><p>选择此前导出的 JSON 文件。导入会替换当前浏览器中的全部工作台数据。</p><button class="btn" data-action="import">${icon('upload')} 选择文件</button></section><section class="panel settings-card"><h3>清空本机数据</h3><p>删除当前浏览器保存的项目和材料状态。此操作不能撤销；建议先导出备份。</p><button class="btn btn-danger" data-action="clear">${icon('trash')} 清空数据</button></section><section class="panel settings-card"><h3>隐私与适用范围</h3><p>本版本无登录、后端、分析脚本或远程同步。不同设备、不同浏览器配置文件的数据相互独立。公开部署只分发网页文件。</p></section></div>`;}
function renderModal(){if(modal.kind==='project'){const p=modal.id?state.projects.find(x=>x.id===modal.id):null;return `<div class="modal-backdrop" data-action="close-backdrop"><form class="modal" id="project-form"><h2>${p?'编辑项目':'添加项目'}</h2><div class="field"><label for="project-name">院校 / 项目名称 *</label><input id="project-name" name="name" maxlength="120" required value="${esc(p?.name||'')}" placeholder="例如：某大学 · 某学院" autofocus /></div><div class="field"><label for="project-type">申请类型</label><select id="project-type" name="type">${['推免','夏令营','预推免','其他'].map(t=>`<option ${p?.type===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="field"><label for="project-status">当前阶段</label><select id="project-status" name="status">${Object.entries(STATUSES).map(([k,v])=>`<option value="${k}" ${(p?.status||modal.status||'research')===k?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label for="project-deadline">截止或提醒日期</label><input id="project-deadline" name="deadline" type="date" value="${esc(p?.deadline||'')}" /></div><div class="field"><label for="project-notes">备注</label><textarea id="project-notes" name="notes" maxlength="3000" placeholder="记录待办、要求或官方通知链接">${esc(p?.notes||'')}</textarea></div><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button type="submit" class="btn btn-primary">保存项目</button></div></form></div>`;}return `<div class="modal-backdrop" data-action="close-backdrop"><form class="modal" id="material-form"><h2>添加材料</h2><div class="field"><label for="material-name">材料名称 *</label><input id="material-name" name="name" maxlength="100" required placeholder="例如：英语成绩证明" autofocus /></div><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button type="submit" class="btn btn-primary">添加</button></div></form></div>`;}
function openModal(value){modal=value;render();document.querySelector('.modal [autofocus]')?.focus();}
function closeModal(){modal=null;render();}
document.addEventListener('click',e=>{
  const button=e.target.closest('[data-action]');if(!button)return;const action=button.dataset.action,id=button.dataset.id;
  if(action==='close-backdrop' && e.target!==button)return;
  if(action==='nav'){page=button.dataset.page;document.getElementById('sidebar')?.classList.remove('open');render();window.scrollTo(0,0);}
  else if(action==='menu')document.getElementById('sidebar')?.classList.toggle('open');
  else if(action==='start'){if(loadError && !confirm('现有数据无法读取。建立新工作台会覆盖浏览器中原有的数据，确定继续？'))return;loadError='';state={version:1,demo:false,projects:[],materials:DEFAULT_MATERIALS.map(m=>({...m}))};persist();render();notify('已建立空白工作台');}
  else if(action==='add-project')openModal({kind:'project',status:button.dataset.status||'research'});
  else if(action==='edit-project')openModal({kind:'project',id});
  else if(action==='add-material')openModal({kind:'material'});
  else if(action==='close'||action==='close-backdrop')closeModal();
  else if(action==='advance'){const p=state.projects.find(x=>x.id===id);if(p){const keys=Object.keys(STATUSES);p.status=keys[Math.min(keys.indexOf(p.status)+1,keys.length-1)];persist();render();notify('项目阶段已更新');}}
  else if(action==='delete-project'){if(confirm('删除这个项目？此操作无法撤销。')){state.projects=state.projects.filter(x=>x.id!==id);persist();render();notify('项目已删除');}}
  else if(action==='delete-material'){if(confirm('删除这条材料？')){state.materials=state.materials.filter(x=>x.id!==id);persist();render();notify('材料已删除');}}
  else if(action==='clear'){if(confirm('清空当前浏览器保存的全部项目与材料数据？此操作无法撤销。')){state={version:1,demo:false,projects:[],materials:DEFAULT_MATERIALS.map(m=>({...m}))};persist();page='dashboard';render();notify('本机数据已清空');}}
  else if(action==='export')exportData();
  else if(action==='import')document.getElementById('import-file').click();
});
document.addEventListener('submit',e=>{
  if(e.target.id==='project-form'){e.preventDefault();const data=new FormData(e.target),name=String(data.get('name')||'').trim();if(!name)return;const current=modal.id?state.projects.find(x=>x.id===modal.id):null;const record={id:current?.id||uid(),name,status:String(data.get('status')),type:String(data.get('type')),deadline:String(data.get('deadline')||''),notes:String(data.get('notes')||'').trim()};if(current)Object.assign(current,record);else state.projects.push(record);persist();closeModal();notify(current?'项目已更新':'项目已添加');}
  if(e.target.id==='material-form'){e.preventDefault();const name=String(new FormData(e.target).get('name')||'').trim();if(!name)return;state.materials.push({id:uid(),name,done:false});persist();closeModal();notify('材料已添加');}
});
document.addEventListener('change',e=>{const id=e.target.dataset.materialId;if(!id)return;const m=state.materials.find(x=>x.id===id);if(m){m.done=e.target.checked;persist();render();}});
document.addEventListener('input',e=>{if(e.target.id!=='search')return;query=e.target.value;const start=e.target.selectionStart;render();const input=document.getElementById('search');input.focus();input.setSelectionRange(start,start);});
document.addEventListener('keydown',e=>{if(e.key==='Escape' && modal)closeModal();});
function exportData(){const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`保研工作台-备份-${datePlus(0)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('备份已下载到本机');}
document.getElementById('import-file').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;if(file.size>2*1024*1024){notify('文件超过 2 MB，未导入');return;}try{const incoming=normalize(JSON.parse(await file.text()));if(!confirm(`导入 ${incoming.projects.length} 个项目和 ${incoming.materials.length} 条材料？当前数据将被替换。`))return;incoming.demo=false;state=incoming;if(persist()){page='dashboard';render();notify('备份已导入');}}catch(err){notify(`导入失败：${err.message}`);}});
render();
