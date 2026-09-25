const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const JSZip = require('jszip');
const { LocalStore } = require('../desktop/storage.cjs');

async function createDocx(filePath) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>DOCX PROFILE TEXT</w:t></w:r></w:p></w:body></w:document>');
  await fs.writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer' }));
}

async function createPdf(filePath) {
  const stream = 'BT /F1 18 Tf 20 80 Td (PDF PROFILE TEXT) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  await fs.writeFile(filePath, pdf);
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'baoyan-storage-smoke-'));
  const first = path.join(root, 'source-a.txt');
  const second = path.join(root, 'source-b.txt');
  const docxPath = path.join(root, 'profile.docx');
  const pdfPath = path.join(root, 'profile.pdf');
  await fs.writeFile(first, 'version one');
  await fs.writeFile(second, 'version two');
  await createDocx(docxPath);
  await createPdf(pdfPath);
  try {
    const store = new LocalStore(path.join(root, 'app-data'));
    await store.init();
    const state = { version: 1, demo: false, projects: [{ id: 'p', name: '测试项目', status: 'research' }], materials: [{ id: 'm', name: '测试材料', done: false }], reminders: [] };
    await store.saveState(state);
    const added = await store.addAttachment(first, 'm', null);
    assert.equal(await fs.readFile(store.filePath(added.record.id), 'utf8'), 'version one');
    assert.equal(await store.readAttachmentText(added.record.id), 'version one');
    const replaced = await store.addAttachment(second, 'm', added.record.id);
    assert.equal(store.listAttachments().length, 1);
    assert.equal(await fs.readFile(store.filePath(replaced.record.id), 'utf8'), 'version two');
    const docx = await store.addAttachment(docxPath, 'm', null);
    assert.match(await store.readAttachmentText(docx.record.id), /DOCX PROFILE TEXT/);
    const pdf = await store.addAttachment(pdfPath, 'm', null);
    assert.match(await store.readAttachmentText(pdf.record.id), /PDF PROFILE TEXT/);
    await assert.rejects(fs.stat(store.filePath(added.record.id)), { code: 'ENOENT' });
    const reloaded = new LocalStore(store.root);
    await reloaded.init();
    assert.equal(reloaded.getState().projects[0].name, '测试项目');
    assert.equal(reloaded.listAttachments().length, 3);
    assert.equal(reloaded.listAttachments().find(item => item.name === 'source-b.txt').id, replaced.record.id);
    await reloaded.removeForMaterial('m');
    assert.equal(reloaded.listAttachments().length, 0);
    await assert.rejects(fs.stat(reloaded.filePath(replaced.record.id)), { code: 'ENOENT' });
    console.log('PASS: 本机状态重启保留；附件添加、更换、删除均写入磁盘；TXT、DOCX、PDF 均可本地提取文本');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
