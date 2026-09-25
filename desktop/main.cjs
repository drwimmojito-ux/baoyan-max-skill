const path = require('node:path');
const fs = require('node:fs/promises');
const { app, BrowserWindow, Tray, Menu, Notification, dialog, ipcMain, shell, powerMonitor, safeStorage, net } = require('electron');
const { LocalStore } = require('./storage.cjs');
const { ConsultStore } = require('./consult.cjs');

const APP_ID = 'org.baoyan.workbench';
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

let mainWindow;
let tray;
let quitting = false;
let store;
let consultStore;
let reminderTimer;

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function showNotification(title, body) {
  if (!Notification.isSupported()) return false;
  const notification = new Notification({ title, body, icon: path.join(__dirname, '..', 'assets', 'logo.png') });
  notification.on('click', () => {
    showWindow();
    mainWindow?.webContents.send('desktop:navigate', 'calendar');
  });
  notification.show();
  return true;
}

async function checkReminders() {
  if (!Notification.isSupported() || !store) return;
  try {
    const due = await store.consumeDueReminders();
    if (!due.length) return;
    if (due.length > 3) showNotification('保研工作台提醒', `有 ${due.length} 条提醒已到时间，打开工作台查看。`);
    else due.forEach(reminder => showNotification('保研工作台提醒', reminder.title));
    mainWindow?.webContents.send('reminders:updated', store.getState().reminders);
  } catch (error) { console.error('提醒检查失败：', error); }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 960,
    minWidth: 900,
    minHeight: 620,
    show: false,
    title: '保研工作台',
    icon: path.join(__dirname, '..', 'assets', 'logo.ico'),
    backgroundColor: '#f6f9fd',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.webContents.on('did-finish-load', () => showWindow());
  mainWindow.webContents.on('did-fail-load', (_, code, description) => console.error('界面加载失败：', code, description));
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html')).catch(error => console.error('无法加载界面：', error));
  mainWindow.once('ready-to-show', () => showWindow());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      if (['https:', 'http:'].includes(target.protocol) && !target.username && !target.password) shell.openExternal(target.toString());
    } catch { /* 不是可打开的外部链接 */ }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', event => event.preventDefault());
  mainWindow.on('close', event => {
    if (!quitting) { event.preventDefault(); mainWindow.hide(); }
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, '..', 'assets', 'logo.ico'));
  tray.setToolTip('保研工作台 · 提醒后台运行中');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开工作台', click: showWindow },
    { label: '检查提醒', click: checkReminders },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on('double-click', showWindow);
}

function loginOptions() {
  if (app.isPackaged) return { path: process.execPath };
  return { path: process.execPath, args: [app.getAppPath()] };
}

function registerIpc() {
  ipcMain.handle('consult:load', () => consultStore.publicData());
  ipcMain.handle('consult:sources', async () => JSON.parse(await fs.readFile(path.join(__dirname, '..', 'skills', 'baoyan-advisor', 'references', 'handbooks.json'), 'utf8')));
  ipcMain.handle('consult:save-profile', (_, profile) => consultStore.saveProfile(profile));
  ipcMain.handle('consult:save-history', (_, conversations, activeId) => consultStore.saveConversations(conversations, activeId));
  ipcMain.handle('consult:save-api', (_, config) => consultStore.saveApiConfig(config));
  ipcMain.handle('consult:clear-api', () => consultStore.clearApiConfig());
  ipcMain.handle('consult:clear-all', () => consultStore.clearAll());
  ipcMain.handle('consult:ask', (event, request) => consultStore.ask(request, progress => {
    if (!event.sender.isDestroyed()) event.sender.send('consult:progress', progress);
  }));
  ipcMain.handle('state:load', () => store.getState());
  ipcMain.handle('state:save', async (_, state) => {
    await store.saveState(state);
    await checkReminders();
    return true;
  });
  ipcMain.handle('files:list', () => store.listAttachments());
  ipcMain.handle('files:read-text', (_, id) => store.readAttachmentText(id));
  ipcMain.handle('files:choose', async (_, materialId, replaceId) => {
    const choice = await dialog.showOpenDialog(mainWindow, { title: replaceId ? '选择替换文件' : '添加材料文件', properties: ['openFile'] });
    if (choice.canceled || !choice.filePaths.length) return null;
    return store.addAttachment(choice.filePaths[0], materialId, replaceId || null);
  });
  ipcMain.handle('files:save-as', async (_, id) => {
    const record = store.getAttachment(id);
    const choice = await dialog.showSaveDialog(mainWindow, { title: '另存材料文件', defaultPath: record.name });
    if (choice.canceled || !choice.filePath) return false;
    await fs.copyFile(store.filePath(id), choice.filePath);
    return true;
  });
  ipcMain.handle('files:remove', (_, id) => store.removeAttachment(id));
  ipcMain.handle('files:remove-for-material', (_, materialId) => store.removeForMaterial(materialId));
  ipcMain.handle('files:clear', () => store.clearAttachments());
  ipcMain.handle('reminders:test', () => showNotification('保研工作台测试提醒', '系统通知已连接。应用运行时会按设定时间提醒。'));
  ipcMain.handle('reminders:check', () => checkReminders());
  ipcMain.handle('app:info', () => ({
    dataPath: store.root,
    packaged: app.isPackaged,
    platform: process.platform,
    notificationsSupported: Notification.isSupported(),
    autoLaunch: app.getLoginItemSettings(loginOptions()).openAtLogin
  }));
  ipcMain.handle('app:set-auto-launch', (_, enabled) => {
    if (!['win32', 'darwin'].includes(process.platform)) throw new Error('当前系统尚未实现开机启动设置');
    app.setLoginItemSettings({ openAtLogin: !!enabled, ...loginOptions() });
    return app.getLoginItemSettings(loginOptions()).openAtLogin;
  });
  ipcMain.handle('app:open-data-directory', async () => {
    const error = await shell.openPath(store.root);
    if (error) throw new Error(error);
    return true;
  });
}

app.on('before-quit', () => { quitting = true; if (reminderTimer) clearInterval(reminderTimer); });
app.on('activate', () => { if (mainWindow) showWindow(); else createWindow(); });
app.on('window-all-closed', () => { /* 托盘继续运行，直到用户明确退出。 */ });

app.whenReady().then(async () => {
  try {
    store = new LocalStore(app.getPath('userData'));
    await store.init();
    consultStore = new ConsultStore(store.root, safeStorage, (...args) => net.fetch(...args));
    await consultStore.init();
    registerIpc();
    createWindow();
    createTray();
    await checkReminders();
    reminderTimer = setInterval(checkReminders, 30_000);
    powerMonitor.on('resume', checkReminders);
  } catch (error) {
    dialog.showErrorBox('保研工作台无法启动', `本地数据未被覆盖。\n${error.message}`);
    app.quit();
  }
});
