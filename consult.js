/* 保研咨询：手册链接目录、本机资料和使用者主动发起的模型请求。 */
const PROFILE_KEY = 'baoyan-workbench-profile-markdown-v1';
const API_CONFIG_KEY = 'baoyan-workbench-api-config-v1';
const HISTORY_KEY = 'baoyan-workbench-consult-history-v1';
const HANDBOOKS_FILE = './skills/baoyan-advisor/references/handbooks.json';
const PROFILE_TEMPLATE = `# 保研人员信息\n\n## 基本背景\n- 本科学校与专业：\n- 年级／预计推免年份：\n- 成绩或排名及统计口径：\n- 英语或其他语言能力：\n- 科研、竞赛、项目与本人贡献：\n\n## 申请目标\n- 国内推免／海外申请／两者比较：\n- 目标学科、方向与地区：\n- 意向院校、学院或导师：\n- 学位类型与偏好：\n- 时间、经费或其他约束：\n\n## 当前进度与问题\n- 已确认的资格与官方通知链接：\n- 已准备的材料和申请节点：\n- 最希望解决的问题：\n- 尚不确定、需要核查的事项：`;

let profileDraft = '';
let consultQuestion = '';
let sourceQuery = '';
let handoffText = '';
let consultAnswer = '';
let consultSources = [];
let consultProgress = '';
let conversations = [];
let activeConversationId = '';
let historyOpen = false;
let profileOpen = false;
let apiBusy = false;
let includeProfile = false;
let apiConfig = {};
let handbookSources = [];
let handbookLoadError = '';

function apiEndpoint(baseUrl) {
  const url = new URL(String(baseUrl || '').trim());
  if (url.username || url.password || url.search || url.hash) throw new Error('API 地址不能包含账号、密钥、查询参数或片段');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('API 地址须使用 HTTPS；本机服务可以使用 localhost');
  }
  if (!/\/chat\/completions\/?$/i.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\/+$/, '');
    url.pathname = /\/v\d+$/i.test(url.pathname) ? `${url.pathname}/chat/completions` : `${url.pathname}/v1/chat/completions`;
  }
  return url.toString();
}

function sourceStatus(source) {
  return source.status === 'verified' ? '入口与主题已核查' : source.status === 'limited' ? '目录已核查，正文受限' : '候选，待核查';
}

function sourceCards() {
  if (!handbookSources.length) return `<p>${handbookLoadError ? esc(handbookLoadError) : '正在载入手册索引…'}</p>`;
  const q = sourceQuery.trim().toLocaleLowerCase();
  const matched = q ? handbookSources.filter(source => [source.institution, source.name, source.tier, source.type, source.scope, source.status].some(value => String(value || '').toLocaleLowerCase().includes(q))) : handbookSources;
  return `<p class="source-count">显示 ${matched.length} / ${handbookSources.length} 个入口。目录只提供链接与范围说明，不代表已经读取正文。</p><div class="source-grid">${matched.map(source => {
    let url;
    try { url = new URL(source.url); } catch { return ''; }
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return `<a class="source-card" href="${esc(url.toString())}" target="_blank" rel="noopener noreferrer"><strong>${esc(source.institution)} · ${esc(source.name)}</strong><span>${esc(source.tier)} · ${esc(source.type)} · ${sourceStatus(source)}</span><small>${esc(source.scope)}</small></a>`;
  }).join('')}</div>${matched.length ? '' : '<p>没有匹配的入口，请换个关键词。</p>'}`;
}

function formatSourceContext() {
  return handbookSources.map(source => `- ${source.institution}｜${source.name}｜${source.tier}｜${source.type}｜${sourceStatus(source)}｜${source.url}｜范围：${source.scope}｜边界：${source.limit}`).join('\n');
}

function activeConversation() {
  return conversations.find(conversation => conversation.id === activeConversationId) || null;
}

function makeConversation() {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title: '新对话', createdAt: now, updatedAt: now, messages: [] };
}

async function saveConversationHistory() {
  conversations = conversations.slice(-30).map(conversation => ({ ...conversation, messages: conversation.messages.slice(-40) }));
  if (window.desktopAPI?.saveConsultHistory) {
    const saved = await window.desktopAPI.saveConsultHistory(conversations, activeConversationId);
    conversations = saved.conversations || conversations;
    activeConversationId = saved.activeConversationId || activeConversationId;
  } else {
    localStorage.setItem(HISTORY_KEY, JSON.stringify({ conversations, activeConversationId }));
  }
}

function profileLibraryOptions() {
  const supported = /\.(md|markdown|txt|pdf|docx)$/i;
  const files = typeof attachments !== 'undefined' && Array.isArray(attachments) ? attachments.filter(file => supported.test(file.name || '')) : [];
  if (!files.length) return '<option value="">材料库中暂无可导入的 Markdown、TXT、PDF 或 DOCX 文件</option>';
  return '<option value="">选择材料库文件…</option>' + files.map(file => {
    const material = typeof state !== 'undefined' ? state.materials?.find(item => item.id === file.materialId) : null;
    return '<option value="' + esc(file.id) + '">' + esc((material?.name ? material.name + ' · ' : '') + file.name) + '</option>';
  }).join('');
}

function renderSourcesMarkup(sources) {
  const items = (sources || []).map(source => {
    let url;
    try { url = new URL(String(source.url || '')); } catch { return ''; }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return '';
    return '<li><a href="' + esc(url.toString()) + '" target="_blank" rel="noopener noreferrer">' + esc(source.title || url.hostname) + '</a>' + (source.snippet ? '<p>' + esc(source.snippet) + '</p>' : '') + '</li>';
  }).join('');
  return items ? '<div class="consult-web-sources"><h4>本次联网来源</h4><ol>' + items + '</ol></div>' : '';
}

function renderChatMessage(message) {
  return '<article class="chat-message ' + (message.role === 'assistant' ? 'assistant' : 'user') + '"><div class="chat-message-role">' + (message.role === 'assistant' ? 'AI 咨询' : '你') + '</div><pre>' + esc(message.content) + '</pre>' + renderSourcesMarkup(message.sources) + '</article>';
}

function renderConsult() {
  const endpointLabel = apiConfig.baseUrl && apiConfig.model ? apiConfig.model + ' · ' + apiConfig.baseUrl : '尚未配置 API，请先到“设置”填写。';
  const verified = handbookSources.filter(source => source.status === 'verified').length;
  const limited = handbookSources.filter(source => source.status === 'limited').length;
  let conversation = activeConversation();
  const messages = conversation?.messages || [];
  const historyItems = [...conversations].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).map(item => '<button type="button" class="consult-history-item ' + (item.id === activeConversationId ? 'active' : '') + '" data-action="open-conversation" data-id="' + esc(item.id) + '"><strong>' + esc(item.title || '新对话') + '</strong><small>' + esc(new Date(item.updatedAt || Date.now()).toLocaleString('zh-CN')) + ' · ' + (item.messages || []).length + ' 条消息</small></button>').join('');
  const searchDisclosure = window.desktopAPI
    ? '<p class="search-disclosure">桌面版会先联网检索，再把摘要与链接交给当前配置的 AI。搜索只接收本次问题；个人资料仅在侧栏勾选后发送给 AI。网页和导入文件不会另存为材料副本。</p>'
    : '<p class="search-preview-note">当前是网页预览。联网检索功能仅在桌面版运行；此处仍可直接向模型提问，但模型不会获得网页搜索结果。</p>';
  const profileDrawer = '<aside class="consult-profile-rail ' + (profileOpen ? 'is-open' : '') + '"><button type="button" class="consult-profile-trigger" data-action="profile-toggle" aria-label="展开个人资料侧栏">' + (profileOpen ? '收起资料' : '个人资料') + '</button><div class="consult-profile-drawer"><div class="consult-profile-head"><div><h2>个人资料</h2><p>资料保存在本机。导入后可继续编辑。</p></div><button type="button" class="icon-button" data-action="profile-toggle" aria-label="收起个人资料侧栏">×</button></div><label for="profile-markdown">个人资料（Markdown）</label><textarea id="profile-markdown" class="consult-textarea" placeholder="按需填写；避免身份证号、手机号等不必要信息。">' + esc(profileDraft) + '</textarea><div class="consult-profile-import"><label for="profile-import-source">从材料库导入</label><select id="profile-import-source">' + profileLibraryOptions() + '</select><button type="button" class="btn" data-action="import-profile-file" ' + (!window.desktopAPI ? 'disabled' : '') + '>导入所选文件</button><small>支持 Markdown、TXT、PDF、DOCX；长文件最多导入 90,000 字符。导入内容只填入个人资料；勾选发送后才会交给 AI。</small></div><label class="consult-check"><input id="include-profile" type="checkbox" ' + (includeProfile ? 'checked' : '') + ' /> 本次提问附带个人资料</label><div class="consult-actions"><button type="button" class="btn" data-action="profile-template">填入空白模板</button><button type="button" class="btn" data-action="save-profile">' + (window.desktopAPI ? '保存到本机' : '保存到本浏览器') + '</button><button type="button" class="btn" data-action="download-profile">下载 Markdown</button></div></div></aside>';
  const progressMarkup = apiBusy ? '<div class="consult-progress" role="status" aria-live="polite"><span class="consult-spinner" aria-hidden="true"></span><span>' + esc(consultProgress || '正在联网检索…') + '</span></div>' : '';
  const threadMarkup = messages.length ? messages.map(renderChatMessage).join('') : '<div class="chat-welcome"><span class="chat-welcome-mark">✦</span><h2>开始一段保研咨询</h2><p>提出问题后，桌面版会联网检索并把来源与回答保存在本机。</p></div>';
  const errorMarkup = consultAnswer ? '<div class="chat-error" role="alert">' + esc(consultAnswer) + renderSourcesMarkup(consultSources) + '</div>' : '';
  const historyDrawer = historyOpen ? '<div class="consult-history-drawer"><div class="consult-history-head"><strong>对话历史</strong><button type="button" class="icon-button" data-action="toggle-history" aria-label="关闭历史">×</button></div>' + (historyItems || '<p class="consult-history-empty">还没有保存的对话</p>') + '</div>' : '';
  const handoffMarkup = handoffText ? '<label for="handoff-output">交给 Codex 的内容</label><textarea id="handoff-output" class="consult-textarea output" readonly>' + esc(handoffText) + '</textarea>' : '';
  return header('AI 咨询', '桌面版联网检索；对话记录只保存在当前设备。', '<button type="button" class="btn" data-action="toggle-history">对话历史</button><button type="button" class="btn btn-primary" data-action="new-conversation">新建对话</button>') +
    '<div class="consult-chat-layout">' + profileDrawer + historyDrawer + '<main class="consult-chat-main"><div class="consult-chat-meta"><span>' + esc(conversation?.title || '新对话') + '</span><small>' + esc(endpointLabel) + '</small></div><div id="consult-thread" class="consult-thread">' + threadMarkup + progressMarkup + errorMarkup + '</div><form id="consult-form" class="consult-composer"><label for="consult-question">提出问题</label><textarea id="consult-question" class="consult-textarea question" placeholder="例如：根据我的背景，如何安排今年的夏令营与预推免？" ' + (apiBusy ? 'disabled' : '') + '>' + esc(consultQuestion) + '</textarea><div class="consult-composer-footer">' + searchDisclosure + '<div class="consult-composer-actions"><button type="button" class="btn" data-action="build-handoff">生成 Codex Skill 提问</button>' + (handoffText ? '<button type="button" class="btn" data-action="copy-handoff">复制 Codex 提问</button>' : '') + '<button type="submit" class="btn btn-primary" data-action="send-api" ' + (apiBusy ? 'disabled' : '') + '>' + (apiBusy ? '处理中…' : (window.desktopAPI ? '发送并联网检索' : '发送给配置的 AI（预览不联网）')) + '</button></div></div>' + handoffMarkup + '</form></main></div>' +
    '<details class="panel consult-sources"><summary>飞跃手册与保研资料索引（' + handbookSources.length + ' 个入口）</summary><p>其中 ' + verified + ' 个入口与主题已核查、' + limited + ' 个目录已核查但正文受限、' + (handbookSources.length - verified - limited) + ' 个候选入口。</p><label for="source-query">搜索院校、手册、申请类型或方向</label><input id="source-query" type="search" value="' + esc(sourceQuery) + '" placeholder="例如：保研、计算机、浙江大学" /><div id="source-results">' + sourceCards() + '</div></details>';
}

function renderApiSettings() {
  const desktop = !!window.desktopAPI;
  return `<section class="panel api-settings"><h2>AI API 配置（OpenAI 兼容接口）</h2><p>填写你选择的服务商 API 地址、模型名称和 API Key。${desktop ? '桌面版在当前系统账户下加密保存 Key，请求由本机应用直接发送。' : '网页预览会把 Key 保存在当前浏览器；该网页的脚本可以读取它。'}发送咨询时，服务商会收到本次问题、当前对话中此前的问题与回答、手册索引及本次勾选附带的资料；是否联网检索由桌面版在本机先完成，可能按用量收费。</p><div class="api-fields"><label>API 基础地址<input id="api-base-url" type="url" autocomplete="url" placeholder="https://api.openai.com/v1" value="${esc(apiConfig.baseUrl || '')}" /></label><label>模型名称<input id="api-model" type="text" autocomplete="off" placeholder="例如 gpt-4o-mini" value="${esc(apiConfig.model || '')}" /></label><label>API Key<input id="api-key" type="password" autocomplete="new-password" placeholder="${apiConfig.hasKey || apiConfig.apiKey ? '已保存；留空保留现有 Key' : '粘贴 API Key'}" /></label></div><div class="consult-actions"><button type="button" class="btn btn-primary" data-action="save-api">保存 API 配置</button><button type="button" class="btn btn-danger" data-action="clear-api">清除 API 配置</button></div></section>`;
}

function downloadText(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function handleConsultInput(event) {
  if (event.target.id === 'profile-markdown') { profileDraft = event.target.value; return true; }
  if (event.target.id === 'consult-question') { consultQuestion = event.target.value; return true; }
  if (event.target.id === 'source-query') {
    sourceQuery = event.target.value;
    document.getElementById('source-results').innerHTML = sourceCards();
    return true;
  }
  return false;
}

document.addEventListener('change', event => {
  if (event.target.id === 'include-profile') includeProfile = event.target.checked;
});

async function saveApiSettings() {
  const baseUrl = document.getElementById('api-base-url')?.value.trim() || '';
  const model = document.getElementById('api-model')?.value.trim() || '';
  const apiKey = document.getElementById('api-key')?.value.trim() || '';
  if (!baseUrl || !model) { notify('请填写 API 基础地址和模型名称'); return; }
  try { apiEndpoint(baseUrl); } catch (error) { notify(error.message); return; }
  try {
    if (window.desktopAPI) apiConfig = await window.desktopAPI.saveApiConfig({ baseUrl, model, apiKey });
    else {
      const savedKey = apiKey || apiConfig.apiKey || '';
      if (!savedKey) throw new Error('请填写 API Key');
      apiConfig = { baseUrl, model, apiKey: savedKey };
      localStorage.setItem(API_CONFIG_KEY, JSON.stringify(apiConfig));
    }
    render();
    notify('API 配置已保存在当前设备');
  } catch (error) { notify(`保存失败：${error.message}`); }
}

async function sendConsultToApi() {
  if (apiBusy) return;
  const question = consultQuestion.trim();
  if (!question) { notify('请先填写本次问题'); return; }
  if (!apiConfig.baseUrl || !apiConfig.model || !(apiConfig.hasKey || apiConfig.apiKey)) { notify('请先到“设置”配置 API'); return; }
  if (!activeConversation()) {
    const conversation = makeConversation();
    conversations.push(conversation);
    activeConversationId = conversation.id;
  }
  let conversation = activeConversation();
  const priorMessages = conversation.messages.map(message => ({
    role: message.role,
    content: message.role === 'assistant' && message.sources?.length
      ? message.content + '\n\n此前回答对应的来源：\n' + message.sources.map((source, index) => '[' + (index + 1) + '] ' + source.title + ' — ' + source.url).join('\n')
      : message.content
  }));
  const now = new Date().toISOString();
  conversation.messages.push({ id: crypto.randomUUID(), role: 'user', content: question, sources: [], createdAt: now });
  if (conversation.title === '新对话') conversation.title = question.slice(0, 48);
  conversation.updatedAt = now;
  apiBusy = true;
  consultAnswer = '';
  consultSources = [];
  consultProgress = window.desktopAPI ? '正在联网检索相关网页…' : '网页预览不执行联网检索，正在等待模型…';
  consultQuestion = '';
  render();
  try {
    await saveConversationHistory();
    conversation = activeConversation();
    const request = { question, profile: profileDraft, includeProfile, sourceContext: formatSourceContext(), history: priorMessages };
    if (window.desktopAPI) {
      const result = await window.desktopAPI.askConsult(request);
      const answer = typeof result === 'string' ? result : String(result?.answer || '');
      if (Array.isArray(result?.sources)) consultSources = result.sources;
      if (!answer) throw new Error('API 返回成功，但没有可显示的回答');
      conversation.messages.push({ id: crypto.randomUUID(), role: 'assistant', content: answer, sources: consultSources, createdAt: new Date().toISOString() });
    } else {
      const systemPrompt = '你是保研咨询助手。网页预览没有联网搜索能力；不能声称刚刚搜索或核验了网页。下面提供的是来源链接索引，不代表已阅读正文。不得编造招生政策、录取统计或文章内容；涉及当年资格、名额和截止日期，应核对官方通知。区分官方规定、个人经验、用户自述和推测。\n\n来源索引：\n' + request.sourceContext;
      const userMessage = '## 本次问题\n\n' + question + (includeProfile && profileDraft.trim() ? '\n\n## 用户主动附带的资料\n\n' + profileDraft.trim() : '');
      const response = await fetch(apiEndpoint(apiConfig.baseUrl), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiConfig.apiKey }, body: JSON.stringify({ model: apiConfig.model, messages: [{ role: 'system', content: systemPrompt }, ...priorMessages, { role: 'user', content: userMessage }] }), credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', signal: AbortSignal.timeout(90_000) });
      const payload = await response.json();
      if (!response.ok) throw new Error(String(payload?.error?.message || 'API 请求失败（HTTP ' + response.status + ')').slice(0, 400));
      const content = payload?.choices?.[0]?.message?.content;
      const answer = Array.isArray(content) ? content.map(part => part.text || '').join('') : String(content || '');
      if (!answer) throw new Error('API 返回成功，但没有可显示的回答');
      conversation.messages.push({ id: crypto.randomUUID(), role: 'assistant', content: answer, sources: [], createdAt: new Date().toISOString() });
    }
    conversation.updatedAt = new Date().toISOString();
    await saveConversationHistory();
  } catch (error) { consultAnswer = error.name === 'TimeoutError' ? '请求超过 90 秒，已停止。' : '请求失败：' + error.message; }
  finally { apiBusy = false; consultProgress = ''; render(); }
}
async function clearAllConsult() {
  if (window.desktopAPI) await window.desktopAPI.clearConsult();
  else { localStorage.removeItem(PROFILE_KEY); localStorage.removeItem(API_CONFIG_KEY); localStorage.removeItem(HISTORY_KEY); }
  profileDraft = '';
  consultQuestion = '';
  handoffText = '';
  consultAnswer = '';
  consultSources = [];
  consultProgress = '';
  conversations = [];
  activeConversationId = '';
  historyOpen = false;
  profileOpen = false;
  apiConfig = {};
}

async function importProfileFile() {
  if (!window.localFiles?.readText) { notify('请在桌面版从材料库导入 PDF 或 DOCX'); return; }
  const id = document.getElementById('profile-import-source')?.value;
  if (!id) { notify('请先选择材料库文件'); return; }
  const file = (typeof attachments !== 'undefined' ? attachments : []).find(item => item.id === id);
  if (!file) { notify('材料库文件不存在，请刷新后重试'); return; }
  try {
    const text = await window.localFiles.readText(id);
    const section = '## 材料库导入：' + file.name + '\n\n' + text.trim();
    const profile = profileDraft.trim() ? profileDraft.trim() + '\n\n' + section : section;
    if (profile.length > 100_000) throw new Error('导入后个人资料超过 100,000 字符，请先精简资料');
    profileDraft = profile;
    await window.desktopAPI.saveProfile(profileDraft);
    render();
    notify('已从材料库导入并保存个人资料');
  } catch (error) { notify('导入失败：' + error.message); }
}

async function handleConsultAction(action, element) {
  if (action === 'new-conversation') {
    if (apiBusy) return true;
    const conversation = makeConversation();
    conversations.push(conversation);
    activeConversationId = conversation.id;
    consultQuestion = '';
    consultAnswer = '';
    consultSources = [];
    handoffText = '';
    historyOpen = false;
    try { await saveConversationHistory(); } catch (error) { notify('对话记录保存失败：' + error.message); }
    render();
  } else if (action === 'toggle-history') {
    historyOpen = !historyOpen;
    profileOpen = false;
    render();
  } else if (action === 'open-conversation') {
    if (apiBusy) return true;
    activeConversationId = conversations.find(item => item.id === element?.dataset?.id)?.id || activeConversationId;
    consultQuestion = '';
    consultAnswer = '';
    consultSources = [];
    historyOpen = false;
    render();
  } else if (action === 'profile-toggle') {
    profileOpen = !profileOpen;
    historyOpen = false;
    render();
  } else if (action === 'import-profile-file') {
    await importProfileFile();
  } else if (action === 'profile-template') {
    if (profileDraft.trim() && !confirm('用空白模板替换当前编辑区内容？已保存的资料不会改变。')) return true;
    profileDraft = PROFILE_TEMPLATE;
    handoffText = '';
    render();
    document.getElementById('profile-markdown')?.focus();
  } else if (action === 'save-profile') {
    try {
      if (window.desktopAPI) await window.desktopAPI.saveProfile(profileDraft);
      else localStorage.setItem(PROFILE_KEY, profileDraft);
      notify('个人资料已保存在当前设备');
    } catch (error) { notify(`保存资料失败：${error.message}`); }
  } else if (action === 'download-profile') {
    if (profileDraft.trim()) downloadText('保研人员信息.md', profileDraft, 'text/markdown;charset=utf-8');
    else notify('请先填写个人资料');
  } else if (action === 'build-handoff') {
    if (!consultQuestion.trim()) { notify('请先填写本次问题'); return true; }
    handoffText = `请读取本仓库 skills/baoyan-advisor/SKILL.md，并按其中的来源核查规则处理以下咨询。资料索引位于 skills/baoyan-advisor/references/feiyue-sources.md 和 handbooks.json。请区分官方规定、经验案例与推测；涉及当年政策时核对官方通知。\n\n## 本次问题\n\n${consultQuestion.trim()}${profileDraft.trim() ? `\n\n## 我提供的个人资料（Markdown）\n\n${profileDraft.trim()}` : ''}`;
    render();
    document.getElementById('handoff-output')?.focus();
  } else if (action === 'copy-handoff') {
    try { await navigator.clipboard.writeText(handoffText); notify('已复制，可以粘贴到能访问本仓库的 Codex 对话'); }
    catch { notify('自动复制失败，请从下方文本框手动复制'); }
  } else if (action === 'save-api') await saveApiSettings();
  else if (action === 'clear-api') {
    try {
      if (window.desktopAPI) apiConfig = await window.desktopAPI.clearApiConfig();
      else { localStorage.removeItem(API_CONFIG_KEY); apiConfig = {}; }
      consultAnswer = '';
      render();
      notify('API 配置已清除');
    } catch (error) { notify(`清除失败：${error.message}`); }
  } else if (action === 'send-api') await sendConsultToApi();
  else return false;
  return true;
}

async function initializeConsult() {
  try {
    if (window.desktopAPI) {
      const saved = await window.desktopAPI.loadConsult();
      profileDraft = saved.profile || '';
      apiConfig = saved;
      conversations = Array.isArray(saved.conversations) ? saved.conversations : [];
      activeConversationId = saved.activeConversationId || conversations.at(-1)?.id || '';
      handbookSources = await window.desktopAPI.loadSources();
    } else {
      profileDraft = localStorage.getItem(PROFILE_KEY) || '';
      apiConfig = JSON.parse(localStorage.getItem(API_CONFIG_KEY) || '{}') || {};
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}') || {};
      conversations = Array.isArray(history.conversations) ? history.conversations.slice(-30) : [];
      activeConversationId = history.activeConversationId || conversations.at(-1)?.id || '';
      const response = await fetch(HANDBOOKS_FILE, { cache: 'no-cache' });
      if (!response.ok) throw new Error('手册索引读取失败');
      handbookSources = await response.json();
    }
    if (!conversations.some(conversation => conversation.id === activeConversationId)) activeConversationId = conversations.at(-1)?.id || '';
    if (!Array.isArray(handbookSources)) throw new Error('手册索引格式错误');
    if (window.desktopAPI?.onConsultProgress) window.desktopAPI.onConsultProgress(progress => {
      consultProgress = String(progress?.label || '正在处理…');
      if (Array.isArray(progress?.sources)) consultSources = progress.sources;
      render();
    });
  } catch (error) { handbookLoadError = `手册索引或咨询资料暂不可用：${error.message}`; }
}

document.addEventListener('submit', event => {
  if (event.target.id !== 'consult-form') return;
  event.preventDefault();
  void sendConsultToApi();
});

document.addEventListener('keydown', event => {
  if (event.target.id === 'consult-question' && event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    void sendConsultToApi();
  }
});
