const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { LocalStore } = require('../desktop/storage.cjs');

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'baoyan-storage-smoke-'));
  const first = path.join(root, 'source-a.txt');
  const second = path.join(root, 'source-b.txt');
  await fs.writeFile(first, 'version one');
  await fs.writeFile(second, 'version two');
  try {
    const store = new LocalStore(path.join(root, 'app-data'));
    await store.init();
    const state = { version: 1, demo: false, projects: [{ id: 'p', name: '测试项目', status: 'research' }], materials: [{ id: 'm', name: '测试材料', done: false }], reminders: [] };
    await store.saveState(state);
    const added = await store.addAttachment(first, 'm', null);
    assert.equal(await fs.readFile(store.filePath(added.record.id), 'utf8'), 'version one');
    const replaced = await store.addAttachment(second, 'm', added.record.id);
    assert.equal(store.listAttachments().length, 1);
    assert.equal(await fs.readFile(store.filePath(replaced.record.id), 'utf8'), 'version two');
    await assert.rejects(fs.stat(store.filePath(added.record.id)), { code: 'ENOENT' });
    const reloaded = new LocalStore(store.root);
    await reloaded.init();
    assert.equal(reloaded.getState().projects[0].name, '测试项目');
    assert.equal(reloaded.listAttachments()[0].id, replaced.record.id);
    await reloaded.removeForMaterial('m');
    assert.equal(reloaded.listAttachments().length, 0);
    await assert.rejects(fs.stat(reloaded.filePath(replaced.record.id)), { code: 'ENOENT' });
    console.log('PASS: 本机状态重启保留；附件添加、更换、删除均写入磁盘');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
