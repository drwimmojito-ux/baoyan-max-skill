const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

class LocalStore {
  constructor(root) {
    this.root = root;
    this.filesDir = path.join(root, 'materials');
    this.statePath = path.join(root, 'state.json');
    this.indexPath = path.join(root, 'materials.json');
    this.state = null;
    this.attachments = [];
    this.queue = Promise.resolve();
  }

  async init() {
    await fs.mkdir(this.filesDir, { recursive: true });
    this.state = await this.readJson(this.statePath, null);
    this.attachments = await this.readJson(this.indexPath, []);
    if (!Array.isArray(this.attachments)) throw new Error('材料文件索引损坏');
  }

  async readJson(file, fallback) {
    try { return JSON.parse(await fs.readFile(file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
  }

  async writeJson(file, value) {
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
      try { await fs.rename(temporary, file); }
      catch { await fs.copyFile(temporary, file); }
    } finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
  }

  enqueue(work) {
    const result = this.queue.then(work);
    this.queue = result.catch(() => {});
    return result;
  }

  getState() { return this.state ? structuredClone(this.state) : null; }

  saveState(incoming) {
    return this.enqueue(async () => {
      if (!incoming || !Array.isArray(incoming.projects) || !Array.isArray(incoming.materials) || !Array.isArray(incoming.reminders)) {
        throw new Error('清单数据格式不正确');
      }
      const previous = new Map((this.state?.reminders || []).map(reminder => [reminder.id, reminder]));
      const merged = structuredClone(incoming);
      merged.reminders = merged.reminders.map(reminder => {
        const old = previous.get(reminder.id);
        if (old?.notifiedAt && old.when === reminder.when && !reminder.notifiedAt) reminder.notifiedAt = old.notifiedAt;
        return reminder;
      });
      await this.writeJson(this.statePath, merged);
      this.state = merged;
      return true;
    });
  }

  consumeDueReminders(now = new Date()) {
    return this.enqueue(async () => {
      const due = (this.state?.reminders || []).filter(reminder => !reminder.done && !reminder.notifiedAt && Number.isFinite(Date.parse(reminder.when)) && Date.parse(reminder.when) <= now.getTime());
      if (!due.length) return [];
      const next = structuredClone(this.state);
      const ids = new Set(due.map(reminder => reminder.id));
      next.reminders.forEach(reminder => { if (ids.has(reminder.id)) reminder.notifiedAt = now.toISOString(); });
      await this.writeJson(this.statePath, next);
      this.state = next;
      return due;
    });
  }

  listAttachments() { return structuredClone(this.attachments); }

  filePath(id) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error('文件标识无效');
    return path.join(this.filesDir, id);
  }

  getAttachment(id) {
    const record = this.attachments.find(item => item.id === id);
    if (!record) throw new Error('文件不存在');
    return record;
  }

  async readAttachmentText(id) {
    const record = this.getAttachment(id);
    const extension = path.extname(record.name).toLowerCase();
    if (!['.md', '.markdown', '.txt', '.pdf', '.docx'].includes(extension)) {
      throw new Error('目前支持 Markdown、TXT、PDF 和 DOCX 文件');
    }
    if (!Number.isFinite(record.size) || record.size > 25 * 1024 * 1024) {
      throw new Error('文件超过 25 MB，未读取');
    }
    const buffer = await fs.readFile(this.filePath(id));
    let text;
    if (extension === '.pdf') {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try { text = (await parser.getText()).text; }
      finally { await parser.destroy(); }
    } else if (extension === '.docx') {
      const mammoth = require('mammoth');
      text = (await mammoth.extractRawText({ buffer })).value;
    } else {
      text = buffer.toString('utf8');
    }
    text = String(text || '').replace(/\u0000/g, '').trim();
    if (!text) throw new Error('文件中没有可导入的文本');
    if (text.length > 90_000) return text.slice(0, 90_000) + '\n\n[文件较长，已截取前 90,000 个字符]';
    return text;
  }

  addAttachment(sourcePath, materialId, replaceId) {
    return this.enqueue(async () => {
      if (typeof materialId !== 'string' || !materialId || materialId.length > 100) throw new Error('材料条目标识无效');
      const old = replaceId ? this.getAttachment(replaceId) : null;
      if (old && old.materialId !== materialId) throw new Error('文件不属于此材料条目');
      const stat = await fs.stat(sourcePath);
      if (!stat.isFile()) throw new Error('只能添加普通文件');
      const id = randomUUID();
      const destination = this.filePath(id);
      await fs.copyFile(sourcePath, destination);
      const record = { id, materialId, name: path.basename(sourcePath), type: '', size: stat.size, updatedAt: new Date().toISOString() };
      const next = this.attachments.filter(item => item.id !== replaceId).concat(record);
      try { await this.writeJson(this.indexPath, next); }
      catch (error) { await fs.rm(destination, { force: true }); throw error; }
      this.attachments = next;
      if (old) await fs.rm(this.filePath(old.id), { force: true }).catch(() => {});
      return { record, replacedId: replaceId || null };
    });
  }

  removeAttachment(id) {
    return this.enqueue(async () => {
      this.getAttachment(id);
      const next = this.attachments.filter(item => item.id !== id);
      await this.writeJson(this.indexPath, next);
      this.attachments = next;
      await fs.rm(this.filePath(id), { force: true }).catch(() => {});
      return true;
    });
  }

  removeForMaterial(materialId) {
    return this.enqueue(async () => {
      const removed = this.attachments.filter(item => item.materialId === materialId);
      const next = this.attachments.filter(item => item.materialId !== materialId);
      await this.writeJson(this.indexPath, next);
      this.attachments = next;
      await Promise.all(removed.map(item => fs.rm(this.filePath(item.id), { force: true }).catch(() => {})));
      return true;
    });
  }

  clearAttachments() {
    return this.enqueue(async () => {
      const old = this.attachments;
      await this.writeJson(this.indexPath, []);
      this.attachments = [];
      await Promise.all(old.map(item => fs.rm(this.filePath(item.id), { force: true }).catch(() => {})));
      return true;
    });
  }
}

module.exports = { LocalStore };
