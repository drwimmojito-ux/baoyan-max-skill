const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ConsultStore } = require('../desktop/consult.cjs');

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'baoyan-consult-smoke-'));
  const secureStorage = {
    isEncryptionAvailable: () => true,
    encryptString: value => Buffer.from(value, 'utf8'),
    decryptString: value => value.toString('utf8')
  };
  const requests = [];
  const request = async (url, options) => {
    requests.push({ url, options });
    if (String(url).startsWith('https://search.brave.com/search')) {
      return {
        ok: true,
        status: 200,
        text: async () => '<div class="snippet" data-type="web"><div class="result-content"><a href="http://www.moe.gov.cn/notice"><div class="title search-snippet-title">官方通知</div></a><div class="generic-snippet"><div class="content desktop-default-regular">招生通知摘要</div></div></div></div>'
      };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: '测试回答' } }] }) };
  };
  try {
    const store = new ConsultStore(root, secureStorage, request);
    await store.init();
    await store.saveProfile('# 本机资料');
    await store.saveApiConfig({ baseUrl: 'https://example.org/v1', model: 'test-model', apiKey: 'secret-key' });
    const reloaded = new ConsultStore(root, secureStorage, request);
    await reloaded.init();
    assert.equal(reloaded.publicData().profile, '# 本机资料');
    assert.equal(reloaded.publicData().hasKey, true);
    assert.equal(JSON.stringify(reloaded.publicData()).includes('secret-key'), false);
    assert.equal((await fs.readFile(path.join(root, 'consult.json'), 'utf8')).includes('secret-key'), false);
    const history = [
      { id: 'user-1', role: 'user', content: '上一轮问题', createdAt: new Date().toISOString() },
      { id: 'assistant-1', role: 'assistant', content: '上一轮回答', createdAt: new Date().toISOString() }
    ];
    await reloaded.saveConversations([{ id: 'conversation-1', title: '上一轮问题', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: history }], 'conversation-1');
    assert.equal(reloaded.publicData().conversations[0].messages.length, 2);
    const progress = [];
    assert.equal(await reloaded.ask({ question: '测试问题', profile: '# 本机资料', includeProfile: false, sourceContext: '来源链接索引', history }, item => progress.push(item)), '测试回答');
    assert.equal(requests.length, 2);
    assert.match(requests[0].url, /^https:\/\/search\.brave\.com\/search\?q=/);
    assert.equal(progress[0].stage, 'searching');
    assert.equal(progress[1].stage, 'generating');
    assert.equal(progress[1].sources[0].url, 'http://www.moe.gov.cn/notice');
    assert.equal(progress[1].sources[0].title, '官方通知');
    assert.equal(requests[1].url, 'https://example.org/v1/chat/completions');
    const firstPayload = JSON.parse(requests[1].options.body);
    assert.equal(JSON.stringify(firstPayload).includes('本机资料'), false);
    assert.deepEqual(firstPayload.messages.slice(1).map(message => message.role), ['user', 'assistant', 'user']);
    assert.equal(firstPayload.messages[1].content, '上一轮问题');
    assert.equal(firstPayload.messages[2].content, '上一轮回答');
    assert.equal(await reloaded.ask({ question: '测试问题', profile: '# 本机资料', includeProfile: true, sourceContext: '来源链接索引' }), '测试回答');
    assert.equal(requests.length, 4);
    assert.equal(JSON.stringify(JSON.parse(requests[3].options.body)).includes('本机资料'), true);
    await reloaded.clearAll();
    assert.equal(reloaded.publicData().hasKey, false);
    assert.equal(reloaded.publicData().profile, '');
    assert.equal(reloaded.publicData().conversations.length, 0);
    console.log('PASS: 配置、资料和对话历史重启保留；Key 不返回给页面；个人资料仅勾选时发送');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
