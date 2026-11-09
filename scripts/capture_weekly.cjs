const { app, BrowserWindow } = require('electron');
const fs = require('fs');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 717,
    show: false,
    webPreferences: {
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Console] ${message}`);
  });

  await win.loadURL('http://localhost:4173/');
  await new Promise((r) => setTimeout(r, 1200));

  // Switch to weekly report view
  await win.webContents.executeJavaScript(`
    try {
      const topBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('导出周报'));
      if (topBtn) {
        topBtn.click();
      }
    } catch (e) {
      console.error(e);
    }
  `);

  await new Promise((r) => setTimeout(r, 1000));

  // Click load example template
  await win.webContents.executeJavaScript(`
    try {
      const allBtns = Array.from(document.querySelectorAll('button'));
      const exampleBtn = allBtns.find(b => b.textContent && b.textContent.includes('模板示例'));
      if (exampleBtn) {
        exampleBtn.click();
      }
    } catch (e) {
      console.error(e);
    }
  `);

  await new Promise((r) => setTimeout(r, 1000));

  const img = await win.webContents.capturePage();
  fs.writeFileSync('shot_weekly_example.png', img.toPNG());
  console.log('Successfully saved shot_weekly_example.png');
  app.quit();
});
