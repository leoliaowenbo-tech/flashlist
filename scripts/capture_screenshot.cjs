const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const outputPath = process.argv[2] || 'screenshot.png';
const width = parseInt(process.argv[3] || '1024', 10);
const height = parseInt(process.argv[4] || '717', 10);
const targetView = process.argv[5] || 'weekly-report';

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: width,
    height: height,
    show: false,
    webPreferences: {
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  await win.loadURL('http://localhost:4173/');

  // Wait for React to render and click weekly report if requested
  await new Promise((r) => setTimeout(r, 1200));

  if (targetView === 'weekly-report') {
    await win.webContents.executeJavaScript(`
      // Look for the "导出周报" button and click it
      const btns = Array.from(document.querySelectorAll('button'));
      const reportBtn = btns.find(b => b.textContent && b.textContent.includes('导出周报'));
      if (reportBtn) {
        reportBtn.click();
      }
    `);
    await new Promise((r) => setTimeout(r, 1000));
  }

  const image = await win.webContents.capturePage();
  fs.writeFileSync(outputPath, image.toPNG());
  console.log(`Saved screenshot to ${outputPath} (${width}x${height})`);
  app.quit();
});
