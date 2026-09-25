/* 保研工作台：全部个人数据仅由当前浏览器保存。 */
const STORAGE_KEY = 'baoyan-workbench-v1';
const PROFILE_KEY = 'baoyan-workbench-profile-markdown-v1';
const API_CONFIG_KEY = 'baoyan-workbench-api-config-v1';
const HANDBOOKS_FILE = './skills/baoyan-advisor/references/handbooks.json';
const PROFILE_TEMPLATE = `# 保研人员信息\n\n## 基本背景\n- 本科学校与专业：\n- 年级／预计推免年份：\n- 成绩或排名及统计口径：\n- 英语或其他语言能力：\n- 科研、竞赛、项目与本人贡献：\n\n## 申请目标\n- 国内推免／海外申请／两者比较：\n- 目标学科、方向与地区：\n- 意向院校、学院或导师：\n- 学位类型与偏好：\n- 时间、经费或其他约束：\n\n## 当前进度与问题\n- 已确认的资格与官方通知链接：\n- 已准备的材料和申请节点：\n- 最希望解决的问题：\n- 尚不确定、需要核查的事项：`;
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
  return {version:1,demo:true,projects:names.map((name,i)=>({id:uid(),name,status:statuses[i],type:i%3===0?'夏令营':'推免',deadline:offsets[i]===null?'':datePlus(offsets[i]),notes:''})),materials:DEFAULT_MATERIALS.map((m,i)=>({...m,done:i<2 || i===3}))};
}
let loadError = '';
function readState(){try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return demoState();return normalize(JSON.parse(raw));}catch{loadError='浏览器中已有的数据无法读取。请先在设置中导出备份，避免覆盖原始数据。';return demoState();}}
function readApiConfig(){try{return JSON.parse(localStorage.getItem(API_CONFIG_KEY)||'{}')||{};}catch{return {};}}
function normalize(value){
  if(!value || !Array.isArray(value.projects) || !Array.isArray(value.materials)) throw new Error('文件缺少项目或材料列表');
  if(value.projects.length>1000 || value.materials.length>500) throw new Error('数据条目过多');
  return {version:1,demo:!!value.demo,projects:value.projects.map(p=>({id:String(p.id||uid()),name:String(p.name||'').slice(0,120),status:STATUSES[p.status]?p.status:'research',type:String(p.type||'推免').slice(0,30),deadline:/^\d{4}-\d{2}-\d{2}$/.test(String(p.deadline||''))?String(p.deadline):'',notes:String(p.notes||'').slice(0,3000)})).filter(p=>p.name),materials:value.materials.map(m=>({id:String(m.id||uid()),name:String(m.name||'').slice(0,100),done:!!m.done})).filter(m=>m.name)};
}
let state=readState(), page='dashboard', query='', modal=null, toastTimer;
let profileDraft='', consultQuestion='', handoffText='', consultAnswer='', apiBusy=false;
let apiConfig=readApiConfig(), handbookSources=[], handbookLoadError='';
try { profileDraft=localStorage.getItem(PROFILE_KEY)||''; } catch { /* 私人资料仍可在本次页面中编辑 */ }
let attachments=[], filesReady=false, fileError='', fileTarget=null;
const app=document.getElementById('app');
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch{notify('浏览器无法保存数据。请检查存储权限并及时导出备份。');return false;}}
function notify(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3600);}
function projects(){const q=query.trim().toLocaleLowerCase();return q?state.projects.filter(p=>[p.name,p.type,p.notes].some(v=>v.toLocaleLowerCase().includes(q))):state.projects;}
function upcoming(){return state.projects.filter(p=>p.deadline && p.status!=='submitted').sort((a,b)=>a.deadline.localeCompare(b.deadline));}
function fmtDate(value){if(!value)return '暂无日期';const [y,m,d]=value.split('-');return `${m}-${d}`;}
function attachedTo(materialId){return attachments.filter(file=>file.materialId===materialId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
function fmtSize(bytes){if(bytes<1024)return `${bytes} B`;if(bytes<1024*1024)return `${(bytes/1024).toFixed(1)} KB`;return `${(bytes/1024/1024).toFixed(1)} MB`;}
async function refreshAttachments(){try{attachments=await window.localFiles.list();filesReady=true;fileError='';}catch(error){filesReady=false;fileError=error.message||'无法读取本地文件';}render();}
function render(){
  app.innerHTML=`<div class="app"><aside class="sidebar" id="sidebar"><div class="brand"><img class="brand-mark" src="./assets/logo.png" alt="" /><span>保研工作台</span></div><nav class="nav" aria-label="主导航">${NAV.map(([id,label,ic])=>`<button type="button" class="nav-btn ${page===id?'active':''}" data-action="nav" data-page="${id}">${icon(ic)}<span>${label}</span></button>`).join('')}</nav><div class="sidebar-bottom"><div class="privacy-note">${icon('lock')}<strong>本地保存</strong>项目与资料保存在当前浏览器。发送 AI 咨询时，问题和附带资料会发送到你配置的 API 服务。</div></div></aside><main class="main"><header class="topbar"><button type="button" class="icon-button mobile-menu" aria-label="打开导航" data-action="menu">${icon('menu')}</button><div class="top-search">${icon('search')}<input id="search" type="search" placeholder="搜索院校、项目或备注…" value="${esc(query)}" aria-label="搜索项目" /></div><div class="user-pill"><span class="avatar">我</span><span>本地使用者</span></div></header><div class="content">${loadError?`<div class="demo-banner">${esc(loadError)}</div>`:''}${state.demo?`<div class="demo-banner"><span>当前显示演示数据，院校名称和日期均为示例。</span><button type="button" data-action="start">开始我的规划 →</button></div>`:''}${renderPage()}<div class="footer-note">项目看板不会同步到服务器。你主动发送 AI 咨询时，问题、个人资料和手册索引会发送到已配置的 API 服务商。</div></div></main></div>${modal?renderModal():''}`;
  const search=document.getElementById('search');if(search && document.activeElement?.id==='search')search.focus();
}
function header(title,subtitle,actions=''){return `<div class="page-header"><div class="page-title"><h1>${title}</h1><p>${subtitle}</p></div><div class="header-actions">${actions}</div></div>`;}
function addButton(){return `<button class="btn btn-primary" type="button" data-action="add-project">${icon('plus')} 添加项目</button>`;}
function renderPage(){let content;switch(page){case 'schools':content=renderSchools();break;case 'board':content=renderBoardPage();break;case 'materials':content=renderMaterials();break;case 'calendar':content=renderCalendar();break;case 'interviews':content=renderInterviews();break;case 'consult':content=renderConsult();break;case 'settings':content=renderSettings();break;default:content=renderDashboard();}return (['dashboard','board','schools'].includes(page)?filterNotice():'')+content;}
function filterNotice(){return query.trim()?`<div class="filter-notice"><span>正在筛选“${esc(query.trim())}”：显示 ${projects().length} / ${state.projects.length} 个项目</span><button type="button" data-action="clear-search">清除筛选</button></div>`:'';}
function renderDashboard(){const soon=upcoming().filter(p=>p.deadline>=datePlus(0)&&p.deadline<=datePlus(7)).length;const pending=state.materials.filter(m=>!m.done).length;return `${header('申请总览','整理节奏，聚焦重点，及时处理下一步。',addButton())}<div class="dashboard-layout"><div class="primary-column"><div class="stats"><div class="stat-card"><span class="stat-icon mint">${icon('bookmark')}</span><div><div class="stat-label">关注项目</div><div class="stat-value">${state.projects.length}</div><div class="stat-hint">当前浏览器中的项目</div></div></div><div class="stat-card"><span class="stat-icon rose">${icon('calendar')}</span><div><div class="stat-label">未来 7 天截止</div><div class="stat-value">${soon}</div><div class="stat-hint">根据已填写日期计算</div></div></div><div class="stat-card"><span class="stat-icon peach">${icon('file')}</span><div><div class="stat-label">材料待完善</div><div class="stat-value">${pending}</div><div class="stat-hint">按清单状态统计</div></div></div></div>${boardPanel()}</div><div class="side-stack"><section class="panel"><div class="panel-header"><h2 class="panel-title">近期节点</h2><button class="panel-link" data-action="nav" data-page="calendar">查看全部</button></div>${timeline()}</section><section class="panel"><div class="panel-header"><h2 class="panel-title">材料清单</h2><button class="panel-link" data-action="nav" data-page="materials">查看全部</button></div>${materialRows()}</section></div></div>`;}
function boardPanel(){return `<section class="panel"><div class="panel-header"><h2 class="panel-title">申请进度看板</h2><div class="panel-tools"><button type="button" class="btn" data-action="nav" data-page="board">打开看板 ${icon('arrow')}</button></div></div>${kanban()}</section>`;}
function kanban(){const list=projects();return `<div class="kanban">${Object.entries(STATUSES).map(([key,label])=>{const items=list.filter(p=>p.status===key);return `<div class="lane" data-status="${key}"><div class="lane-title">${label} <span class="lane-count">${items.length}</span></div>${items.map(projectCard).join('')}${items.length===0?'<div class="empty">暂无项目</div>':''}<button class="lane-add" data-action="add-project" data-status="${key}">＋ 添加项目</button></div>`;}).join('')}</div>`;}
function projectCard(p){return `<article class="project-card"><div class="project-name">${esc(p.name)}</div><div class="project-meta"><span class="badge">${esc(p.type)}</span><span class="badge status">${STATUSES[p.status]}</span></div><div class="project-date">${icon('calendar')} ${p.deadline?`截止：${esc(p.deadline)}`:'暂无截止时间'}</div><div class="project-actions"><button type="button" data-action="edit-project" data-id="${esc(p.id)}">编辑</button><select class="stage-select" data-move-project="${esc(p.id)}" aria-label="移动${esc(p.name)}到其他阶段"><option value="">移动到…</option>${Object.entries(STATUSES).filter(([key])=>key!==p.status).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select><button type="button" class="delete-inline" data-action="delete-project" data-id="${esc(p.id)}">删除</button></div></article>`;}
function timeline(){const list=upcoming().slice(0,5);return list.length?`<div class="timeline">${list.map(p=>`<div class="timeline-item"><div class="timeline-date">${fmtDate(p.deadline)}</div><div class="timeline-text">${esc(p.name)}</div><div class="timeline-sub">${STATUSES[p.status]} · 截止日期</div></div>`).join('')}</div>`:'<div class="empty">暂无已设置日期的项目</div>';}
function materialRows(){return `<div class="material-list">${state.materials.slice(0,6).map(m=>`<label class="material-row"><span class="material-icon">${icon('file')}</span><span class="material-name">${esc(m.name)} <small>${attachedTo(m.id).length} 个文件</small></span><span class="material-state ${m.done?'done':''}">${m.done?'已完成':'待完善'}</span><input class="material-check" type="checkbox" data-material-id="${esc(m.id)}" ${m.done?'checked':''} aria-label="${esc(m.name)}已完成" /></label>`).join('')}</div>`;}
function renderSchools(){return `${header('院校项目','记录关注的申请项目；招生信息请以各院校官方通知为准。',addButton())}<div class="list-grid">${projects().map(p=>`<article class="panel list-card"><h3>${esc(p.name)}</h3><p>${p.notes?esc(p.notes):'尚未填写备注，可记录申请要求、链接或沟通事项。'}</p><div class="row"><span class="badge">${esc(p.type)}</span><span class="badge status">${STATUSES[p.status]}</span></div><div class="date">${p.deadline?`截止：${esc(p.deadline)}`:'尚未设置截止日期'}</div><div class="row"><button class="btn" data-action="edit-project" data-id="${esc(p.id)}">${icon('pencil')} 编辑</button><button class="btn btn-danger" data-action="delete-project" data-id="${esc(p.id)}">${icon('trash')} 删除</button></div></article>`).join('')||'<div class="panel empty">暂无项目。点击“添加项目”建立自己的清单。</div>'}</div>`;}
function renderBoardPage(){return `${header('申请看板','按阶段管理项目；在卡片中选择目标阶段或删除项目。',addButton())}${boardPanel()}`;}
function renderMaterials(){return `${header('材料库','按条目管理文件和准备状态。上传文件仅保存在当前浏览器。',`<button class="btn btn-primary" data-action="add-material">${icon('plus')} 添加材料条目</button>`)}${fileError?`<div class="filter-notice">文件功能不可用：${esc(fileError)}。项目与清单仍可使用。</div>`:''}<div class="material-grid">${state.materials.map(materialCard).join('')||'<div class="panel empty">暂无材料条目。点击“添加材料条目”建立清单。</div>'}</div><p class="material-caution">预览版的文件保存在浏览器本地存储中；清理站点数据可能删除文件。设置中的 JSON 备份只包含项目与清单，不包含上传文件。</p>`;}
function materialCard(m){const files=attachedTo(m.id);return `<section class="panel material-card"><div class="material-card-head"><label class="material-check-label"><input type="checkbox" data-material-id="${esc(m.id)}" ${m.done?'checked':''} aria-label="${esc(m.name)}已完成" /><span><strong>${esc(m.name)}</strong><small>${m.done?'已完成':'待完善'} · ${files.length} 个文件</small></span></label><div class="material-card-actions"><button type="button" class="icon-button" data-action="edit-material" data-id="${esc(m.id)}" aria-label="修改${esc(m.name)}名称">${icon('pencil')}</button><button type="button" class="icon-button" data-action="delete-material" data-id="${esc(m.id)}" aria-label="删除${esc(m.name)}条目及文件">${icon('trash')}</button></div></div><div class="attachment-list">${files.map(file=>`<div class="attachment-row"><span class="attachment-icon">${icon('file')}</span><div class="attachment-info"><strong title="${esc(file.name)}">${esc(file.name)}</strong><small>${fmtSize(file.size)} · ${esc(file.updatedAt.slice(0,10))}</small></div><div class="attachment-actions"><button type="button" data-action="download-file" data-id="${esc(file.id)}">下载</button><button type="button" data-action="replace-file" data-id="${esc(file.id)}" ${filesReady?'':'disabled'}>更换</button><button type="button" data-action="delete-file" data-id="${esc(file.id)}">删除</button></div></div>`).join('')||'<div class="attachment-empty">尚未上传文件</div>'}</div><button type="button" class="btn attachment-add" data-action="add-file" data-id="${esc(m.id)}" ${filesReady?'':'disabled'}>${icon('plus')} 上传文件</button></section>`;}
function renderCalendar(){return `${header('日程提醒','按截止日期查看申请项目。当前版本仅提供页面内时间线。',addButton())}<section class="panel"><div class="panel-header"><h2 class="panel-title">时间线</h2></div><div class="calendar-list">${upcoming().map(p=>`<div class="calendar-row"><div class="calendar-day">${p.deadline.slice(8)}<small>${p.deadline.slice(0,7)}</small></div><div><strong>${esc(p.name)}</strong><p>${STATUSES[p.status]} · ${esc(p.type)}</p></div><button class="btn" data-action="edit-project" data-id="${esc(p.id)}">编辑</button></div>`).join('')||'<div class="empty">暂无已设置截止日期的项目。</div>'}</div></section>`;}
function renderInterviews(){const list=state.projects.filter(p=>p.status==='interview');return `${header('面试准备','集中查看进入面试阶段的项目。',addButton())}<div class="list-grid">${list.map(p=>`<article class="panel list-card"><h3>${esc(p.name)}</h3><p>${p.notes?esc(p.notes):'可在项目备注中记录面试形式、准备事项和待确认的问题。'}</p><div class="date">${p.deadline?`记录日期：${esc(p.deadline)}`:'尚未设置日期'}</div><button class="btn" data-action="edit-project" data-id="${esc(p.id)}">${icon('pencil')} 编辑准备笔记</button></article>`).join('')||'<div class="panel empty">暂无待面试项目。可在申请看板中调整项目阶段。</div>'}</div><section class="panel" style="margin-top:15px"><div class="panel-header"><h2 class="panel-title">通用准备清单</h2></div><div class="interview-tips"><div class="tip"><strong>项目梳理</strong><p>列出研究背景、本人贡献、方法、结果和局限。</p></div><div class="tip"><strong>材料复核</strong><p>核对简历与提交材料中的日期、成绩和项目描述。</p></div><div class="tip"><strong>问题记录</strong><p>把需要向院校确认的事项写入对应项目备注。</p></div></div></section>`;}
function sourceCards(){
  if(!handbookSources.length)return `<p>${handbookLoadError?'资料目录暂不可用，请在仓库中查看 skills/baoyan-advisor/references/handbooks.json。':'正在载入手册索引…'}</p>`;
  const statusLabel=source=>source.status==='verified'?'入口与主题已核查':source.status==='limited'?'目录已核查，正文受限':'候选，待核查';
  return `<div class="source-grid">${handbookSources.map(source=>`<a class="source-card" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer"><strong>${esc(source.institution)} · ${esc(source.name)}</strong><span>${esc(source.tier)} · ${esc(source.type)} · ${statusLabel(source)}</span><small>${esc(source.scope)}</small></a>`).join('')}</div>`;
}
function formatSourceContext(){return handbookSources.map(source=>`- ${source.institution}｜${source.name}｜${source.tier}｜${source.type}｜${source.status==='verified'?'入口与主题已核查':source.status==='limited'?'目录已核查但正文受限':'候选待核查'}｜${source.url}｜范围：${source.scope}｜边界：${source.limit}`).join('\n');}
function renderConsult(){
  const endpointLabel=apiConfig.baseUrl&&apiConfig.model?`${apiConfig.model} · ${apiConfig.baseUrl}`:'尚未配置 API，请先到“设置”填写。';
  const verifiedCount=handbookSources.filter(source=>source.status==='verified').length;
  const limitedCount=handbookSources.filter(source=>source.status==='limited').length;
  const candidateCount=handbookSources.length-verifiedCount-limitedCount;
  return `${header('AI 咨询','有两种方式：直连你配置的模型，或生成提问后交给 Codex Skill。')}<div class="consult-grid"><section class="panel consult-panel"><h2>个人资料</h2><p>可留空。只有点击“发送给 AI”时，编辑区内容才会随问题发往你配置的 API；Codex 交接内容需由你复制到 Codex。</p><label for="profile-markdown">个人资料（Markdown）</label><textarea id="profile-markdown" class="consult-textarea" placeholder="可粘贴 Markdown；不填写身份证号、手机号等不必要信息。">${esc(profileDraft)}</textarea><div class="consult-actions"><button type="button" class="btn" data-action="profile-template">填入空白模板</button><button type="button" class="btn" data-action="save-profile">保存到本浏览器</button><button type="button" class="btn" data-action="download-profile">下载 Markdown</button></div></section><section class="panel consult-panel"><h2>提出问题</h2><p>直连模型：${esc(endpointLabel)}</p><label for="consult-question">本次问题</label><textarea id="consult-question" class="consult-textarea question" placeholder="例如：根据我的背景，如何安排今年的夏令营与预推免？">${esc(consultQuestion)}</textarea><p class="api-disclosure"><strong>直连模型：</strong>只向设置中的 API 发送问题、当前 Markdown 资料、Skill 规则摘要和手册链接索引；这不会启动 Codex Skill 或 Codex Agent，也不会自动读取手册全文。<br><strong>Codex 交接：</strong>生成提问并复制到能访问本仓库的 Codex 对话后，Codex 才能按 Skill 规则检索具体页面；是否能实时联网取决于当前环境的检索工具。</p><div class="consult-actions"><button type="button" class="btn btn-primary" data-action="send-api" ${apiBusy?'disabled':''}>${apiBusy?'正在等待模型…':'发送给配置的 AI'}</button><button type="button" class="btn" data-action="build-handoff">生成 Codex Skill 提问</button>${handoffText?'<button type="button" class="btn" data-action="copy-handoff">复制 Codex 提问</button>':''}</div>${consultAnswer?`<div class="api-answer"><h3>模型回答</h3><pre>${esc(consultAnswer)}</pre></div>`:''}${handoffText?`<label for="handoff-output">交给 Codex 的内容</label><textarea id="handoff-output" class="consult-textarea output" readonly>${esc(handoffText)}</textarea>`:''}</section></div><section class="panel consult-sources"><h2>飞跃手册与保研资料索引</h2><p>共 ${handbookSources.length} 个入口：${verifiedCount} 个入口与主题已核查、${limitedCount} 个目录已核查但正文受限、${candidateCount} 个候选入口。这里只保存可点击链接和范围说明，不包含手册全文，也不构成录取统计样本。</p>${sourceCards()}</section>`;
}
function renderSettings(){return `${header('设置与数据','配置模型 API，管理本浏览器中的资料与清单。')}<section class="panel api-settings"><h2>AI API 配置（OpenAI 兼容接口）</h2><p>支持提供 OpenAI 兼容 Chat Completions 接口的服务。填写 API 基础地址、模型名称和 API Key；不要填写账户密码。Key 会保存在当前浏览器的本地存储，不会写入 Git。网页脚本可读取本地存储；使用你信任的服务商并避免在公共设备长期保存。</p><div class="api-fields"><label>API 基础地址<input id="api-base-url" type="url" autocomplete="url" placeholder="https://api.openai.com/v1" value="${esc(apiConfig.baseUrl||'')}" /></label><label>模型名称<input id="api-model" type="text" autocomplete="off" placeholder="例如 gpt-4o-mini" value="${esc(apiConfig.model||'')}" /></label><label>API Key<input id="api-key" type="password" autocomplete="new-password" placeholder="${apiConfig.apiKey?'已保存；留空保留现有 Key':'粘贴 API Key'}" /></label></div><div class="consult-actions"><button type="button" class="btn btn-primary" data-action="save-api">保存 API 配置</button><button type="button" class="btn btn-danger" data-action="clear-api">清除 API 配置</button></div><small>请求将由浏览器直接发送给该 API。服务商可能按用量计费，并会接收你在咨询页提交的问题和资料。若请求被浏览器跨域策略拦截，需使用允许网页跨域访问的 API 地址。</small></section><div class="settings-grid" style="margin-top:15px"><section class="panel settings-card"><h3>导出清单</h3><p>JSON 不含上传文件、咨询资料或 API Key。咨询资料可单独下载 Markdown。</p><button class="btn" data-action="export">${icon('download')} 导出清单 JSON</button></section><section class="panel settings-card"><h3>导入清单</h3><p>导入 JSON 会替换项目与材料清单，并删除当前浏览器中的上传文件；API 配置和咨询资料不受影响。</p><button class="btn" data-action="import">${icon('upload')} 选择 JSON</button></section><section class="panel settings-card"><h3>清空本机数据</h3><p>删除当前浏览器中的项目、材料清单、上传文件、咨询资料及 API 配置。此操作不能撤销。</p><button class="btn btn-danger" data-action="clear">${icon('trash')} 清空数据</button></section><section class="panel settings-card"><h3>隐私与适用范围</h3><p>本版本无自建后端。API Key 和个人资料保存在当前浏览器；发送咨询时会传到所选 API 服务商。</p></section></div>`;}
function renderModal(){
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
  if(modal.kind==='project'){const p=modal.id?state.projects.find(x=>x.id===modal.id):null;return `<div class="modal-backdrop" data-action="close-backdrop"><form class="modal" id="project-form"><h2>${p?'编辑项目':'添加项目'}</h2><div class="field"><label for="project-name">院校 / 项目名称 *</label><input id="project-name" name="name" maxlength="120" required value="${esc(p?.name||'')}" placeholder="例如：某大学 · 某学院" autofocus /></div><div class="field"><label for="project-type">申请类型</label><select id="project-type" name="type">${['推免','夏令营','预推免','其他'].map(t=>`<option ${p?.type===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="field"><label for="project-status">当前阶段</label><select id="project-status" name="status">${Object.entries(STATUSES).map(([k,v])=>`<option value="${k}" ${(p?.status||modal.status||'research')===k?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label for="project-deadline">截止或提醒日期</label><input id="project-deadline" name="deadline" type="date" value="${esc(p?.deadline||'')}" /></div><div class="field"><label for="project-notes">备注</label><textarea id="project-notes" name="notes" maxlength="3000" placeholder="记录待办、要求或官方通知链接">${esc(p?.notes||'')}</textarea></div><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button type="submit" class="btn btn-primary">保存项目</button></div></form></div>`;}
  const m=modal.id?state.materials.find(x=>x.id===modal.id):null;
  return `<div class="modal-backdrop" data-action="close-backdrop"><form class="modal" id="material-form"><h2>${m?'修改材料条目':'添加材料条目'}</h2><div class="field"><label for="material-name">材料名称 *</label><input id="material-name" name="name" maxlength="100" required value="${esc(m?.name||'')}" placeholder="例如：英语成绩证明" autofocus /></div><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button type="submit" class="btn btn-primary">${m?'保存修改':'添加条目'}</button></div></form></div>`;
}
function openModal(value){modal=value;render();document.querySelector('.modal [autofocus]')?.focus();}
function closeModal(){modal=null;render();}
document.addEventListener('click',async e=>{
  const button=e.target.closest('[data-action]');if(!button)return;const action=button.dataset.action,id=button.dataset.id;
  if(action==='close-backdrop' && e.target!==button)return;
  if(action==='nav'){page=button.dataset.page;document.getElementById('sidebar')?.classList.remove('open');render();window.scrollTo(0,0);}
  else if(action==='clear-search'){query='';render();notify('筛选已清除');}
  else if(action==='menu')document.getElementById('sidebar')?.classList.toggle('open');
  else if(action==='start'){if(loadError && !confirm('现有数据无法读取。建立新工作台会覆盖浏览器中原有的数据，确定继续？'))return;try{if(filesReady){await window.localFiles.clearAll();attachments=[];}}catch(error){notify(`无法清理演示文件：${error.message}`);return;}loadError='';state={version:1,demo:false,projects:[],materials:DEFAULT_MATERIALS.map(m=>({...m}))};persist();render();notify('已建立空白工作台');}
  else if(action==='add-project')openModal({kind:'project',status:button.dataset.status||'research'});
  else if(action==='edit-project')openModal({kind:'project',id});
  else if(action==='add-material')openModal({kind:'material'});
  else if(action==='edit-material')openModal({kind:'material',id});
  else if(action==='add-file'){fileTarget={materialId:id};document.getElementById('material-file').click();}
  else if(action==='replace-file'){const file=attachments.find(x=>x.id===id);if(file){fileTarget={materialId:file.materialId,replaceId:id};document.getElementById('material-file').click();}}
  else if(action==='download-file'){const file=attachments.find(x=>x.id===id);if(file){const url=URL.createObjectURL(file.blob);const link=document.createElement('a');link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}}
  else if(action==='close'||action==='close-backdrop')closeModal();
  else if(action==='delete-project')openModal({kind:'confirm-delete',id});
  else if(action==='confirm-delete-project'){state.projects=state.projects.filter(x=>x.id!==id);const saved=persist();closeModal();notify(saved?'项目已删除':'项目已从当前页面移除，但浏览器无法保存');}
  else if(action==='delete-material')openModal({kind:'confirm-material-delete',id});
  else if(action==='confirm-delete-material'){try{await window.localFiles.removeForMaterial(id);attachments=attachments.filter(x=>x.materialId!==id);state.materials=state.materials.filter(x=>x.id!==id);persist();closeModal();notify('材料条目及文件已删除');}catch(error){notify(`删除失败：${error.message}`);}}
  else if(action==='delete-file')openModal({kind:'confirm-file-delete',id});
  else if(action==='confirm-delete-file'){try{await window.localFiles.remove(id);attachments=attachments.filter(x=>x.id!==id);closeModal();notify('文件已删除');}catch(error){notify(`删除失败：${error.message}`);}}
  else if(action==='clear'){if(confirm('清空当前浏览器中的项目、材料条目、上传文件、咨询资料及 API 配置？此操作无法撤销。')){try{await window.localFiles.clearAll();attachments=[];localStorage.removeItem(PROFILE_KEY);localStorage.removeItem(API_CONFIG_KEY);}catch(error){notify(`无法清理本机数据：${error.message}`);return;}profileDraft='';consultQuestion='';handoffText='';consultAnswer='';apiConfig={};state={version:1,demo:false,projects:[],materials:DEFAULT_MATERIALS.map(m=>({...m}))};persist();page='dashboard';render();notify('本机数据已清空');}}
  else if(action==='export')exportData();
  else if(action==='import')document.getElementById('import-file').click();
  else if(action==='profile-template'){if(profileDraft.trim() && !confirm('用空白模板替换当前编辑区内容？已保存的浏览器资料不会改变。'))return;profileDraft=PROFILE_TEMPLATE;handoffText='';render();document.getElementById('profile-markdown')?.focus();}
  else if(action==='save-profile'){try{localStorage.setItem(PROFILE_KEY,profileDraft);notify('Markdown 资料已保存在当前浏览器');}catch{notify('浏览器无法保存资料，请复制或下载备份');}}
  else if(action==='download-profile'){if(profileDraft.trim())downloadText('保研人员信息.md',profileDraft,'text/markdown;charset=utf-8');else notify('请先填写或载入 Markdown 资料');}
  else if(action==='build-handoff'){if(!consultQuestion.trim()){notify('请先填写本次问题');return;}handoffText=`请读取本仓库 skills/baoyan-advisor/SKILL.md，并按其中的来源核查规则处理以下咨询。资料索引位于 skills/baoyan-advisor/references/feiyue-sources.md 和 handbooks.json。请在回答中区分官方规定、经验案例与推测；涉及当年政策时核对官方通知。\n\n## 本次问题\n\n${consultQuestion.trim()}${profileDraft.trim()?`\n\n## 我提供的个人资料（Markdown）\n\n${profileDraft.trim()}`:''}`;render();document.getElementById('handoff-output')?.focus();}
  else if(action==='copy-handoff'){try{await navigator.clipboard.writeText(handoffText);notify('交接内容已复制，可粘贴到 Codex 对话');}catch{notify('浏览器未允许自动复制，请在下方文本框手动复制');}}
  else if(action==='save-api')saveApiSettings();
  else if(action==='clear-api'){localStorage.removeItem(API_CONFIG_KEY);apiConfig={};consultAnswer='';render();notify('API 配置和已保存的 Key 已清除');}
  else if(action==='send-api')await sendConsultToApi();
});
document.addEventListener('submit',e=>{
  if(e.target.id==='project-form'){e.preventDefault();const data=new FormData(e.target),name=String(data.get('name')||'').trim();if(!name)return;const current=modal.id?state.projects.find(x=>x.id===modal.id):null;const record={id:current?.id||uid(),name,status:String(data.get('status')),type:String(data.get('type')),deadline:String(data.get('deadline')||''),notes:String(data.get('notes')||'').trim()};if(current)Object.assign(current,record);else state.projects.push(record);const saved=persist();query='';closeModal();notify(saved?(current?'项目已更新':'项目已添加，已显示在看板中'):'浏览器无法保存项目；请立即导出备份');}
  if(e.target.id==='material-form'){e.preventDefault();const name=String(new FormData(e.target).get('name')||'').trim();if(!name)return;const current=modal.id?state.materials.find(x=>x.id===modal.id):null;if(current)current.name=name;else state.materials.push({id:uid(),name,done:false});const saved=persist();closeModal();notify(saved?(current?'材料名称已修改':'材料条目已添加'):'浏览器无法保存清单；请导出备份');}
});
document.addEventListener('change',e=>{
  const moveId=e.target.dataset.moveProject;
  if(moveId){const p=state.projects.find(x=>x.id===moveId),status=e.target.value;if(p && STATUSES[status]){p.status=status;const saved=persist();render();notify(saved?`已移到“${STATUSES[status]}”`:'阶段已在当前页面变化，但浏览器无法保存');}return;}
  const id=e.target.dataset.materialId;if(!id)return;const m=state.materials.find(x=>x.id===id);if(m){m.done=e.target.checked;persist();render();}
});
document.addEventListener('input',e=>{if(e.target.id==='profile-markdown'){profileDraft=e.target.value;return;}if(e.target.id==='consult-question'){consultQuestion=e.target.value;return;}if(e.target.id!=='search')return;query=e.target.value;const start=e.target.selectionStart;render();const input=document.getElementById('search');input.focus();input.setSelectionRange(start,start);});
document.addEventListener('keydown',e=>{if(e.key==='Escape' && modal)closeModal();});
function downloadText(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function apiEndpoint(baseUrl){
  const url=new URL(baseUrl.trim());
  if(url.username||url.password||url.search||url.hash)throw new Error('API 地址中不要包含账号、密钥、查询参数或片段；请在 API Key 栏单独填写密钥。');
  if(url.protocol!=='https:' && !(url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('API 地址须使用 HTTPS；本机服务可使用 localhost。');
  if(/\/chat\/completions\/?$/i.test(url.pathname))return url.toString();
  url.pathname=url.pathname.replace(/\/+$/,'');
  url.pathname=/\/v\d+$/i.test(url.pathname)?`${url.pathname}/chat/completions`:`${url.pathname}/v1/chat/completions`;
  return url.toString();
}
function saveApiSettings(){
  const baseUrl=document.getElementById('api-base-url')?.value.trim()||'';
  const model=document.getElementById('api-model')?.value.trim()||'';
  const enteredKey=document.getElementById('api-key')?.value.trim()||'';
  if(!baseUrl||!model){notify('请填写 API 基础地址和模型名称');return;}
  try{apiEndpoint(baseUrl);}catch(error){notify(error.message);return;}
  const apiKey=enteredKey||apiConfig.apiKey||'';
  if(!apiKey){notify('请填写 API Key');return;}
  try{const nextConfig={baseUrl,model,apiKey};localStorage.setItem(API_CONFIG_KEY,JSON.stringify(nextConfig));apiConfig=nextConfig;render();notify('API 配置已保存在当前浏览器');}
  catch{notify('浏览器无法保存配置，请检查本地存储权限');}
}
async function sendConsultToApi(){
  if(apiBusy)return;
  if(!consultQuestion.trim()){notify('请先写下本次问题');return;}
  if(!apiConfig.baseUrl||!apiConfig.model||!apiConfig.apiKey){notify('请先到“设置”配置 API 地址、模型和 API Key');return;}
  let endpoint;
  try{endpoint=apiEndpoint(apiConfig.baseUrl);}catch(error){notify(error.message);return;}
  const systemPrompt=[
    '你是保研咨询助手。按下列原则回答：先判断用户问的是国内推免、海外申请还是两者比较；缺少会改变建议的背景时先询问；不得编造招生政策、录取统计、文章内容或来源。',
    '下面是带状态的来源链接索引，不是手册全文，也不表示你已经打开网页。“入口与主题已核查”只说明目录和大致主题已确认；“目录已核查但正文受限”表示没有可用的经验正文；“候选待核查”不能直接作为事实依据。若当前模型服务没有网页检索能力，明确说明未实时读到页面。涉及当年资格、名额、流程和截止日期，提醒以目标单位当年官方通知为准，并尽可能给出官方核验入口。',
    '把个人经验、官方规则、用户自述和推测区分开。不要据少量个案推算录取概率。引用目录时使用原链接并说明其适用范围和入口核查状态。',
    '可用飞跃/保研来源目录：',
    formatSourceContext()||'来源目录当前未能载入；不要声称已检查其中的页面。'
  ].join('\n\n');
  const userMessage=`## 本次问题\n\n${consultQuestion.trim()}${profileDraft.trim()?`\n\n## 用户提供的个人资料（Markdown）\n\n${profileDraft.trim()}`:''}`;
  apiBusy=true;consultAnswer='';render();
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),90000);
  try{
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiConfig.apiKey}`},body:JSON.stringify({model:apiConfig.model,messages:[{role:'system',content:systemPrompt},{role:'user',content:userMessage}]}),credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal:controller.signal});
    const raw=await response.text();
    let payload;try{payload=JSON.parse(raw);}catch{throw new Error(`API 返回的内容不是 JSON（HTTP ${response.status}）。`);}
    if(!response.ok)throw new Error(payload?.error?.message||`API 请求失败（HTTP ${response.status}）。`);
    const content=payload?.choices?.[0]?.message?.content;
    consultAnswer=Array.isArray(content)?content.map(part=>part.text||'').join(''):String(content||'');
    if(!consultAnswer)throw new Error('API 返回成功，但没有可显示的回答内容。');
  }catch(error){
    consultAnswer=error.name==='AbortError'?'请求超过 90 秒，已停止。':error instanceof TypeError?'无法连接 API。请核对地址、网络及服务商的浏览器跨域访问设置。':error.message||'API 请求失败。';
  }finally{clearTimeout(timeout);apiBusy=false;render();}
}
function exportData(){downloadText(`保研工作台-清单-${datePlus(0)}.json`,JSON.stringify({...state,exportedAt:new Date().toISOString(),attachmentsExcluded:true,profileExcluded:true,apiConfigExcluded:true},null,2),'application/json');notify('清单已下载；不包含上传文件、咨询资料或 API Key');}
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
render();
refreshAttachments();
fetch(HANDBOOKS_FILE,{cache:'no-cache'}).then(response=>{if(!response.ok)throw new Error('手册索引读取失败');return response.json();}).then(records=>{if(!Array.isArray(records))throw new Error('手册索引格式错误');handbookSources=records;if(page==='consult')render();}).catch(()=>{handbookLoadError='手册索引未能载入';if(page==='consult')render();});
