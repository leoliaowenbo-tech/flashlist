const { app, BrowserWindow } = require('electron');
const fs = require('fs');

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

const resolutions = [
  { name: '1024x717', width: 1024, height: 717 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1440x900', width: 1440, height: 900 },
];

app.whenReady().then(async () => {
  for (const res of resolutions) {
    const win = new BrowserWindow({
      width: res.width,
      height: res.height,
      show: false,
      webPreferences: {
        offscreen: true,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    await win.loadURL('http://localhost:4173/');
    await new Promise((r) => setTimeout(r, 800));

    // Switch to weekly report view
    await win.webContents.executeJavaScript(`
      const topBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('导出周报'));
      if (topBtn) topBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Click load example template
    await win.webContents.executeJavaScript(`
      const allBtns = Array.from(document.querySelectorAll('button'));
      const exampleBtn = allBtns.find(b => b.textContent && b.textContent.includes('模板示例'));
      if (exampleBtn) exampleBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 600));

    const img = await win.webContents.capturePage();
    const filename = `shot_${res.name}.png`;
    fs.writeFileSync(filename, img.toPNG());
    console.log(`Saved ${filename}`);
    win.destroy();
  }

  app.quit();
});
