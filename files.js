/* 桌面版附件写入本机目录；网页预览写入当前浏览器的 IndexedDB。 */
(() => {
  if (window.desktopAPI) {
    window.localFiles = {
      list: () => window.desktopAPI.listFiles(),
      readText: id => window.desktopAPI.readFileText(id),
      choose: (materialId, replaceId) => window.desktopAPI.chooseFile(materialId, replaceId),
      download: id => window.desktopAPI.saveFileAs(id),
      remove: id => window.desktopAPI.removeFile(id),
      removeForMaterial: materialId => window.desktopAPI.removeFilesForMaterial(materialId),
      clearAll: () => window.desktopAPI.clearFiles()
    };
    return;
  }
  const DB_NAME = 'baoyan-workbench-files-v1';
  const STORE = 'attachments';
  let dbPromise;

  function open() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('当前浏览器不支持本地文件存储'));
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE)) {
            const store = db.createObjectStore(STORE, { keyPath: 'id' });
            store.createIndex('materialId', 'materialId');
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('无法打开本地文件存储'));
        request.onblocked = () => reject(new Error('本地文件存储正在被其他页面占用'));
      }).catch(error => { dbPromise = undefined; throw error; });
    }
    return dbPromise;
  }

  async function transact(mode, operation) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let result;
      try { result = operation(store); } catch (error) { tx.abort(); reject(error); return; }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error('本地文件操作失败'));
      tx.onabort = () => reject(tx.error || new Error('本地文件操作已取消'));
    });
  }

  async function list() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('无法读取材料文件'));
    });
  }

  async function put(record) {
    await transact('readwrite', store => store.put(record));
    return record;
  }

  async function remove(id) { await transact('readwrite', store => store.delete(id)); }

  async function removeForMaterial(materialId) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const index = tx.objectStore(STORE).index('materialId');
      const request = index.openKeyCursor(IDBKeyRange.only(materialId));
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) { tx.objectStore(STORE).delete(cursor.primaryKey); cursor.continue(); }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('无法删除材料文件'));
    });
  }

  async function clearAll() { await transact('readwrite', store => store.clear()); }

  window.localFiles = { list, put, remove, removeForMaterial, clearAll };
})();
