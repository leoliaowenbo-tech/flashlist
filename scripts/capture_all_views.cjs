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

  await win.loadURL('http://localhost:4173/');
  await new Promise((r) => setTimeout(r, 1000));

  // 1. Capture today / default task list view
  let img = await win.webContents.capturePage();
  fs.writeFileSync('shot_today.png', img.toPNG());
  console.log('Saved shot_today.png');

  // 2. Click Calendar view
  await win.webContents.executeJavaScript(`
    const btns = Array.from(document.querySelectorAll('button'));
    const calBtn = btns.find(b => b.textContent && b.textContent.includes('日历视图'));
    if (calBtn) calBtn.click();
  `);
  await new Promise((r) => setTimeout(r, 800));
  img = await win.webContents.capturePage();
  fs.writeFileSync('shot_calendar.png', img.toPNG());
  console.log('Saved shot_calendar.png');

  // 3. Click Weekly report view
  await win.webContents.executeJavaScript(`
    const btns = Array.from(document.querySelectorAll('button'));
    const reportBtn = btns.find(b => b.textContent && b.textContent.includes('周报导出'));
    if (reportBtn) reportBtn.click();
  `);
  await new Promise((r) => setTimeout(r, 800));

  // In weekly report view, click "载入模板示例" so we see full data like the user has
  await win.webContents.executeJavaScript(`
    const btns = Array.from(document.querySelectorAll('button'));
    const exBtn = btns.find(b => b.textContent && (b.textContent.includes('载入模板示例') || b.textContent.includes('模板示例')));
    if (exBtn) exBtn.click();
  `);
  await new Promise((r) => setTimeout(r, 800));

  img = await win.webContents.capturePage();
  fs.writeFileSync('shot_weekly_example.png', img.toPNG());
  console.log('Saved shot_weekly_example.png');

  app.quit();
});
