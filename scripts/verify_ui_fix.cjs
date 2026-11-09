const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1040,
    height: 750,
    show: false,
    webPreferences: {
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const indexPath = path.join(__dirname, '../dist/index.html');
  await win.loadFile(indexPath);
  await new Promise((r) => setTimeout(r, 1000));

  // Click on "导出周报" in topbar or sidebar
  await win.webContents.executeJavaScript(`
    (() => {
      const allButtons = Array.from(document.querySelectorAll('button'));
      const weeklyBtn = allButtons.find(b => b.textContent && b.textContent.includes('周报导出') || b.textContent.includes('导出周报'));
      if (weeklyBtn) weeklyBtn.click();
    })();
  `);

  // Click "载入模版示例" to populate all sections
  await win.webContents.executeJavaScript(`
    (() => {
      const allButtons = Array.from(document.querySelectorAll('button'));
      const exampleBtn = allButtons.find(b => b.textContent && b.textContent.includes('模板示例'));
      if (exampleBtn) exampleBtn.click();
    })();
  `);

  await new Promise((r) => setTimeout(r, 1200));

  await new Promise((r) => setTimeout(r, 1200));

  const img = await win.webContents.capturePage();
  const buffer = img.toPNG();
  
  const targetPath1 = path.join(__dirname, '../verified_fixed_ui.png');
  const targetPath2 = '/Users/wenbo/.gemini/antigravity/brain/7cb9f940-d80c-4ab9-8123-90fba39196ec/verified_fixed_ui.png';

  fs.writeFileSync(targetPath1, buffer);
  fs.writeFileSync(targetPath2, buffer);
  console.log('Successfully captured screenshot to:', targetPath1, 'and', targetPath2);

  app.quit();
});
