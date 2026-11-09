const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

// 设置 Windows 任务栏应用标识与分组 (App User Model ID)
app.setAppUserModelId('com.flashlist.desktop');

// 单实例锁：确保不会重复启动多个应用窗口
const gotTheLock = app.requestSingleInstanceLock();
let mainWindow = null;

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.ico');

  mainWindow = new BrowserWindow({
    width: 1150,
    height: 780,
    minWidth: 860,
    minHeight: 560,
    title: '闪念清单 · FlashList',
    icon: iconPath,
    show: false, // 等待页面加载完毕后再优雅显示，避免白屏闪烁
    backgroundColor: '#f8fafc',
    autoHideMenuBar: true, // 现代化极简顶栏（按 Alt 键可调出菜单）
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  // 创建原生窗口菜单（支持快捷键撤销/剪切/复制/粘贴/刷新/缩放）
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '退出', accelerator: 'Ctrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'Ctrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'Ctrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'Ctrl+X', role: 'cut' },
        { label: '复制', accelerator: 'Ctrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'Ctrl+V', role: 'paste' },
        { label: '全选', accelerator: 'Ctrl+A', role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '刷新', accelerator: 'Ctrl+R', role: 'reload' },
        { label: '强制刷新', accelerator: 'Ctrl+Shift+R', role: 'forceReload' },
        { type: 'separator' },
        { label: '放大', accelerator: 'Ctrl+Plus', role: 'zoomIn' },
        { label: '缩小', accelerator: 'Ctrl+-', role: 'zoomOut' },
        { label: '重置缩放', accelerator: 'Ctrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: '全屏', accelerator: 'F11', role: 'togglefullscreen' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // 加载本地打包文件
  const indexPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadFile(indexPath);

  // 页面就绪后展示窗口
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 拦截外部超链接，使用系统默认浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('window-all-closed', () => {
  // Windows 下所有窗口关闭后退出应用
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
