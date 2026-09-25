const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

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

class ConsultStore {
  constructor(root, secureStorage, request = fetch) {
    this.file = path.join(root, 'consult.json');
    this.secureStorage = secureStorage;
    this.request = request;
    this.data = { profile: '', baseUrl: '', model: '', encryptedKey: '' };
    this.queue = Promise.resolve();
  }

  async init() {
    try {
      const saved = JSON.parse(await fs.readFile(this.file, 'utf8'));
      if (!saved || typeof saved !== 'object') throw new Error('咨询配置格式错误');
      this.data = {
        profile: String(saved.profile || ''),
        baseUrl: String(saved.baseUrl || ''),
        model: String(saved.model || ''),
        encryptedKey: String(saved.encryptedKey || '')
      };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  publicData() {
    const { profile, baseUrl, model, encryptedKey } = this.data;
    return { profile, baseUrl, model, hasKey: !!encryptedKey };
  }

  enqueue(work) {
    const result = this.queue.then(work);
    this.queue = result.catch(() => {});
    return result;
  }

  async write(next) {
    const temp = `${this.file}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temp, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 });
      try { await fs.rename(temp, this.file); }
      catch { await fs.copyFile(temp, this.file); }
      this.data = next;
    } finally { await fs.rm(temp, { force: true }).catch(() => {}); }
  }

  saveProfile(profile) {
    if (typeof profile !== 'string' || profile.length > 100_000) throw new Error('个人资料过长');
    return this.enqueue(async () => { await this.write({ ...this.data, profile }); return this.publicData(); });
  }

  saveApiConfig({ baseUrl, model, apiKey }) {
    if (typeof baseUrl !== 'string' || baseUrl.length > 2_000) throw new Error('API 地址无效');
    if (typeof model !== 'string' || !model.trim() || model.length > 150) throw new Error('模型名称无效');
    apiEndpoint(baseUrl);
    if (!this.secureStorage.isEncryptionAvailable()) throw new Error('系统安全存储不可用，未保存 API Key');
    return this.enqueue(async () => {
      const key = String(apiKey || '').trim();
      const encryptedKey = key ? this.secureStorage.encryptString(key).toString('base64') : this.data.encryptedKey;
      if (!encryptedKey) throw new Error('请填写 API Key');
      await this.write({ ...this.data, baseUrl: baseUrl.trim(), model: model.trim(), encryptedKey });
      return this.publicData();
    });
  }

  clearApiConfig() {
    return this.enqueue(async () => {
      await this.write({ ...this.data, baseUrl: '', model: '', encryptedKey: '' });
      return this.publicData();
    });
  }

  clearAll() {
    return this.enqueue(async () => {
      await this.write({ profile: '', baseUrl: '', model: '', encryptedKey: '' });
      return this.publicData();
    });
  }

  async ask({ question, profile = '', includeProfile = false, sourceContext = '' }) {
    if (typeof question !== 'string' || !question.trim() || question.length > 10_000) throw new Error('问题为空或过长');
    if (typeof profile !== 'string' || profile.length > 100_000) throw new Error('个人资料过长');
    if (typeof sourceContext !== 'string' || sourceContext.length > 100_000) throw new Error('来源目录过长');
    const { baseUrl, model, encryptedKey } = this.data;
    if (!baseUrl || !model || !encryptedKey) throw new Error('请先配置 API 地址、模型和 API Key');
    const key = this.secureStorage.decryptString(Buffer.from(encryptedKey, 'base64'));
    const systemPrompt = [
      '你是保研咨询助手。先辨别国内推免、海外申请或两者比较；缺少关键背景时先询问。不得编造招生政策、录取统计、文章内容或来源。',
      '下面只是来源链接索引，不代表已读到手册正文。若没有实际网页检索能力，明确说明未实时核查页面；当年资格、名额、流程和截止日期要以目标单位当年官方通知为准。',
      '区分官方规定、个人经验、用户自述和推测。候选来源不能作为事实依据，不据少量个案推算录取概率。',
      `来源索引：\n${sourceContext || '当前没有可用索引。'}`
    ].join('\n\n');
    const userMessage = `## 本次问题\n\n${question.trim()}${includeProfile && profile.trim() ? `\n\n## 用户主动附带的资料\n\n${profile.trim()}` : ''}`;
    const response = await this.request(apiEndpoint(baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }] }),
      signal: AbortSignal.timeout(90_000)
    });
    const raw = await response.text();
    let payload;
    try { payload = JSON.parse(raw); } catch { throw new Error(`API 返回的内容不是 JSON（HTTP ${response.status}）`); }
    if (!response.ok) throw new Error(String(payload?.error?.message || `API 请求失败（HTTP ${response.status}）`).slice(0, 400));
    const content = payload?.choices?.[0]?.message?.content;
    const answer = Array.isArray(content) ? content.map(part => part.text || '').join('') : String(content || '');
    if (!answer) throw new Error('API 返回成功，但没有可显示的回答');
    return answer;
  }
}

module.exports = { ConsultStore, apiEndpoint };
