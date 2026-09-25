const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');

async function main() {
  const port = process.argv[2] || '9237';
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = pages.find(item => item.type === 'page' && item.url.endsWith('/index.html'));
  assert.ok(page, '找不到桌面应用页面');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const next = ++id;
    pending.set(next, { resolve, reject });
    ws.send(JSON.stringify({ id: next, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  let apiServer;
  try {
    if (process.argv[3] === '--capture-only') {
      const path = process.argv[4];
      assert.ok(path, '需要指定截图路径');
      await evaluate(`(async () => { document.querySelector('[data-action="nav"][data-page="consult"]').click(); await new Promise(resolve => setTimeout(resolve, 100)); })()`);
      if (process.argv[5]) await evaluate(`window.scrollTo(0, ${Number(process.argv[5]) || 0})`);
      const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await fs.writeFile(path, Buffer.from(screenshot.data, 'base64'));
      console.log(`截图已保存：${path}`);
      return;
    }
    const ready = await evaluate('({ desktop: !!window.desktopAPI, files: !!window.localFiles, title: document.title })');
    assert.equal(ready.desktop, true);
    assert.equal(ready.files, true);
    const info = await evaluate('window.desktopAPI.getInfo()');
    assert.match(info.dataPath, /baoyan-smoke-[^\\/]+$/i, '测试只允许连接独立临时数据目录');
    assert.equal(await evaluate('!!document.querySelector(\'[data-action="start"]\')'), true, '测试实例必须是全新的演示状态');
    const settings = await evaluate(`(async () => {
      document.querySelector('[data-action="nav"][data-page="settings"]').click();
      await new Promise(resolve => setTimeout(resolve, 30));
      return {
        shownPath: document.querySelector('.data-path')?.textContent,
        privacyText: document.querySelector('.privacy-note')?.textContent
      };
    })()`);
    assert.equal(settings.shownPath, info.dataPath, '设置页显示的路径与实际存储路径不一致');
    assert.match(settings.privacyText, /当前系统账户/);
    const consult = await evaluate(`(async () => {
      document.querySelector('[data-action="nav"][data-page="consult"]').click();
      await new Promise(resolve => setTimeout(resolve, 30));
      const before = document.querySelectorAll('.source-card').length;
      const input = document.querySelector('#source-query');
      input.value = '保研';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const after = document.querySelectorAll('.source-card').length;
      document.querySelector('#profile-markdown').value = '# 测试资料';
      document.querySelector('#profile-markdown').dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('[data-action="save-profile"]').click();
      await new Promise(resolve => setTimeout(resolve, 150));
      return { before, after, saved: (await window.desktopAPI.loadConsult()).profile };
    })()`);
    assert.equal(consult.before, 35, '飞跃手册索引未全部加载');
    assert.ok(consult.after > 0 && consult.after < consult.before, '手册关键词查询未生效');
    assert.equal(consult.saved, '# 测试资料', '个人资料未写入本机目录');
    const received = [];
    apiServer = http.createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      received.push({ url: req.url, authorization: req.headers.authorization, body: JSON.parse(body) });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content: '本机接口测试回答' } }] }));
    });
    await new Promise(resolve => apiServer.listen(0, '127.0.0.1', resolve));
    const apiPort = apiServer.address().port;
    const apiResult = await evaluate(`(async () => {
      const config = await window.desktopAPI.saveApiConfig({ baseUrl: 'http://127.0.0.1:${apiPort}/v1', model: 'test-model', apiKey: 'local-test-key' });
      const answer = await window.desktopAPI.askConsult({ question: '测试问题', profile: '# 测试资料', includeProfile: false, sourceContext: '手册索引' });
      return { config, answer };
    })()`);
    assert.equal(apiResult.config.hasKey, true, '桌面版未安全保存 API Key');
    assert.equal(JSON.stringify(apiResult.config).includes('local-test-key'), false, 'API Key 不应返回给页面');
    assert.equal(apiResult.answer, '本机接口测试回答');
    assert.equal(received[0].url, '/v1/chat/completions');
    assert.equal(received[0].authorization, 'Bearer local-test-key');
    assert.equal(JSON.stringify(received[0].body).includes('测试资料'), false, '默认请求不应附带个人资料');
    await evaluate('window.desktopAPI.clearApiConfig()');
    await evaluate(`(async () => { document.querySelector('[data-action="nav"][data-page="dashboard"]').click(); await new Promise(resolve => setTimeout(resolve, 30)); })()`);
    await evaluate(`(async () => {
      document.querySelector('[data-action="start"]').click();
      for (let i = 0; i < 50 && document.querySelector('[data-action="start"]'); i++) await new Promise(resolve => setTimeout(resolve, 50));
      document.querySelector('[data-action="add-project"]').click();
      for (let i = 0; i < 50 && !document.querySelector('#project-name'); i++) await new Promise(resolve => setTimeout(resolve, 50));
      document.querySelector('#project-name').value = '桌面测试项目';
      document.querySelector('#project-form').requestSubmit();
      await saveQueue;
      return true;
    })()`);
    let state = await evaluate('window.desktopAPI.loadState()');
    const project = state.projects.find(item => item.name === '桌面测试项目');
    assert.ok(project, '添加项目未写入本机状态文件');
    await evaluate(`(async () => {
      document.querySelector('[data-action="nav"][data-page="board"]').click();
      await new Promise(resolve => setTimeout(resolve, 50));
      const select = [...document.querySelectorAll('[data-move-project]')].find(item => item.dataset.moveProject === '${project.id}');
      select.value = 'preparing';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await saveQueue;
      return true;
    })()`);
    state = await evaluate('window.desktopAPI.loadState()');
    assert.equal(state.projects.find(item => item.id === project.id).status, 'preparing');
    await evaluate(`(async () => {
      document.querySelector('[data-action="nav"][data-page="calendar"]').click();
      await new Promise(resolve => setTimeout(resolve, 50));
      document.querySelector('[data-action="add-reminder"]').click();
      await new Promise(resolve => setTimeout(resolve, 50));
      document.querySelector('#reminder-title').value = '桌面测试提醒';
      const date = new Date(Date.now() - 60_000);
      const pad = n => String(n).padStart(2, '0');
      document.querySelector('#reminder-when').value = date.getFullYear() + '-' + pad(date.getMonth()+1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
      document.querySelector('#reminder-form').requestSubmit();
      await saveQueue;
      return true;
    })()`);
    state = await evaluate('window.desktopAPI.loadState()');
    const reminder = state.reminders.find(item => item.title === '桌面测试提醒');
    assert.ok(reminder, '提醒未保存');
    assert.ok(reminder.notifiedAt, '到期提醒未标记为已调用系统通知');
    assert.equal(info.notificationsSupported, true, '系统通知接口不可用');
    if (process.argv[3]) {
      const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await fs.writeFile(process.argv[3], Buffer.from(screenshot.data, 'base64'));
    }
    console.log(JSON.stringify({ result: 'PASS', dataPath: info.dataPath, projectStatus: 'preparing', reminderMarked: true, notificationsSupported: info.notificationsSupported }));
  } finally { ws.close(); if (apiServer) apiServer.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
