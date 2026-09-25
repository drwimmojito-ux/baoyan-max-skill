/* 保研咨询：手册链接目录、本机资料和使用者主动发起的模型请求。 */
const PROFILE_KEY = 'baoyan-workbench-profile-markdown-v1';
const API_CONFIG_KEY = 'baoyan-workbench-api-config-v1';
const HANDBOOKS_FILE = './skills/baoyan-advisor/references/handbooks.json';
const PROFILE_TEMPLATE = `# 保研人员信息\n\n## 基本背景\n- 本科学校与专业：\n- 年级／预计推免年份：\n- 成绩或排名及统计口径：\n- 英语或其他语言能力：\n- 科研、竞赛、项目与本人贡献：\n\n## 申请目标\n- 国内推免／海外申请／两者比较：\n- 目标学科、方向与地区：\n- 意向院校、学院或导师：\n- 学位类型与偏好：\n- 时间、经费或其他约束：\n\n## 当前进度与问题\n- 已确认的资格与官方通知链接：\n- 已准备的材料和申请节点：\n- 最希望解决的问题：\n- 尚不确定、需要核查的事项：`;

let profileDraft = '';
let consultQuestion = '';
let sourceQuery = '';
let handoffText = '';
let consultAnswer = '';
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

function renderConsult() {
  const endpointLabel = apiConfig.baseUrl && apiConfig.model ? `${apiConfig.model} · ${apiConfig.baseUrl}` : '尚未配置 API，请先到“设置”填写。';
  const verified = handbookSources.filter(source => source.status === 'verified').length;
  const limited = handbookSources.filter(source => source.status === 'limited').length;
  return `${header('AI 咨询', '查看飞跃手册索引，或向自己配置的模型提问。')}<div class="consult-grid"><section class="panel consult-panel"><h2>个人资料</h2><p>资料仅保存在当前设备。发送给模型时，需单独勾选“附带个人资料”；生成 Codex 提问后也可在复制前检查内容。</p><label for="profile-markdown">个人资料（Markdown）</label><textarea id="profile-markdown" class="consult-textarea" placeholder="按需填写；避免身份证号、手机号等不必要信息。">${esc(profileDraft)}</textarea><div class="consult-actions"><button type="button" class="btn" data-action="profile-template">填入空白模板</button><button type="button" class="btn" data-action="save-profile">${window.desktopAPI ? '保存到本机' : '保存到本浏览器'}</button><button type="button" class="btn" data-action="download-profile">下载 Markdown</button></div></section><section class="panel consult-panel"><h2>提出问题</h2><p>直连模型：${esc(endpointLabel)}</p><label for="consult-question">本次问题</label><textarea id="consult-question" class="consult-textarea question" placeholder="例如：根据我的背景，如何安排今年的夏令营与预推免？">${esc(consultQuestion)}</textarea><label class="consult-check"><input id="include-profile" type="checkbox" ${includeProfile ? 'checked' : ''} /> 发送给模型时附带上方个人资料</label><p class="api-disclosure"><strong>直连模型：</strong>点击发送后，问题、勾选附带的资料和手册链接索引会发送到你配置的 API 服务商；不会自动联网读取手册正文，也不会启动 Codex Skill。<br><strong>Codex Skill：</strong>生成并复制提问后，粘贴到能访问本仓库的 Codex 对话中，由 Skill 按来源规则核查具体页面。</p><div class="consult-actions"><button type="button" class="btn btn-primary" data-action="send-api" ${apiBusy ? 'disabled' : ''}>${apiBusy ? '正在等待模型…' : '发送给配置的 AI'}</button><button type="button" class="btn" data-action="build-handoff">生成 Codex Skill 提问</button>${handoffText ? '<button type="button" class="btn" data-action="copy-handoff">复制 Codex 提问</button>' : ''}</div>${consultAnswer ? `<div class="api-answer"><h3>模型回答</h3><pre>${esc(consultAnswer)}</pre></div>` : ''}${handoffText ? `<label for="handoff-output">交给 Codex 的内容</label><textarea id="handoff-output" class="consult-textarea output" readonly>${esc(handoffText)}</textarea>` : ''}</section></div><section class="panel consult-sources"><h2>飞跃手册与保研资料索引</h2><p>共 ${handbookSources.length} 个入口：${verified} 个入口与主题已核查、${limited} 个目录已核查但正文受限、${handbookSources.length - verified - limited} 个候选入口。经验案例不能代替当年官方规定。</p><label for="source-query">搜索院校、手册、申请类型或方向</label><input id="source-query" type="search" value="${esc(sourceQuery)}" placeholder="例如：保研、计算机、浙江大学" /><div id="source-results">${sourceCards()}</div></section>`;
}

function renderApiSettings() {
  const desktop = !!window.desktopAPI;
  return `<section class="panel api-settings"><h2>AI API 配置（OpenAI 兼容接口）</h2><p>填写你选择的服务商 API 地址、模型名称和 API Key。${desktop ? '桌面版在当前系统账户下加密保存 Key，请求由本机应用直接发送。' : '网页预览会把 Key 保存在当前浏览器；该网页的脚本可以读取它。'}发送咨询时，服务商会收到本次问题、手册索引及你选择附带的资料，可能按用量收费。</p><div class="api-fields"><label>API 基础地址<input id="api-base-url" type="url" autocomplete="url" placeholder="https://api.openai.com/v1" value="${esc(apiConfig.baseUrl || '')}" /></label><label>模型名称<input id="api-model" type="text" autocomplete="off" placeholder="例如 gpt-4o-mini" value="${esc(apiConfig.model || '')}" /></label><label>API Key<input id="api-key" type="password" autocomplete="new-password" placeholder="${apiConfig.hasKey || apiConfig.apiKey ? '已保存；留空保留现有 Key' : '粘贴 API Key'}" /></label></div><div class="consult-actions"><button type="button" class="btn btn-primary" data-action="save-api">保存 API 配置</button><button type="button" class="btn btn-danger" data-action="clear-api">清除 API 配置</button></div></section>`;
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
  if (!consultQuestion.trim()) { notify('请先填写本次问题'); return; }
  if (!apiConfig.baseUrl || !apiConfig.model || !(apiConfig.hasKey || apiConfig.apiKey)) { notify('请先到“设置”配置 API'); return; }
  apiBusy = true;
  consultAnswer = '';
  render();
  try {
    const request = { question: consultQuestion, profile: profileDraft, includeProfile, sourceContext: formatSourceContext() };
    if (window.desktopAPI) consultAnswer = await window.desktopAPI.askConsult(request);
    else {
      const systemPrompt = '你是保研咨询助手。下面提供的是来源链接索引，不代表已阅读正文。不得编造招生政策、录取统计或文章内容；涉及当年资格、名额和截止日期，应核对官方通知。区分官方规定、个人经验、用户自述和推测。\n\n来源索引：\n' + request.sourceContext;
      const userMessage = `## 本次问题\n\n${consultQuestion.trim()}${includeProfile && profileDraft.trim() ? `\n\n## 用户主动附带的资料\n\n${profileDraft.trim()}` : ''}`;
      const response = await fetch(apiEndpoint(apiConfig.baseUrl), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiConfig.apiKey}` }, body: JSON.stringify({ model: apiConfig.model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }), credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', signal: AbortSignal.timeout(90_000) });
      const payload = await response.json();
      if (!response.ok) throw new Error(String(payload?.error?.message || `API 请求失败（HTTP ${response.status}）`).slice(0, 400));
      const content = payload?.choices?.[0]?.message?.content;
      consultAnswer = Array.isArray(content) ? content.map(part => part.text || '').join('') : String(content || '');
      if (!consultAnswer) throw new Error('API 返回成功，但没有可显示的回答');
    }
  } catch (error) { consultAnswer = error.name === 'TimeoutError' ? '请求超过 90 秒，已停止。' : `请求失败：${error.message}`; }
  finally { apiBusy = false; render(); }
}

async function clearAllConsult() {
  if (window.desktopAPI) await window.desktopAPI.clearConsult();
  else { localStorage.removeItem(PROFILE_KEY); localStorage.removeItem(API_CONFIG_KEY); }
  profileDraft = '';
  consultQuestion = '';
  handoffText = '';
  consultAnswer = '';
  apiConfig = {};
}

async function handleConsultAction(action) {
  if (action === 'profile-template') {
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
      handbookSources = await window.desktopAPI.loadSources();
    } else {
      profileDraft = localStorage.getItem(PROFILE_KEY) || '';
      apiConfig = JSON.parse(localStorage.getItem(API_CONFIG_KEY) || '{}') || {};
      const response = await fetch(HANDBOOKS_FILE, { cache: 'no-cache' });
      if (!response.ok) throw new Error('手册索引读取失败');
      handbookSources = await response.json();
    }
    if (!Array.isArray(handbookSources)) throw new Error('手册索引格式错误');
  } catch (error) { handbookLoadError = `手册索引或咨询资料暂不可用：${error.message}`; }
}
