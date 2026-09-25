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
    await reloaded.ask({ question: '测试问题', profile: '# 本机资料', includeProfile: false, sourceContext: '来源链接索引' });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'https://example.org/v1/chat/completions');
    assert.equal(JSON.stringify(JSON.parse(requests[0].options.body)).includes('本机资料'), false);
    await reloaded.ask({ question: '测试问题', profile: '# 本机资料', includeProfile: true, sourceContext: '来源链接索引' });
    assert.equal(JSON.stringify(JSON.parse(requests[1].options.body)).includes('本机资料'), true);
    await reloaded.clearAll();
    assert.equal(reloaded.publicData().hasKey, false);
    assert.equal(reloaded.publicData().profile, '');
    console.log('PASS: 配置和资料重启保留；Key 不返回给页面；个人资料仅勾选时发送');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
