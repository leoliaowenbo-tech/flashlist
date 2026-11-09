const { app, BrowserWindow } = require('electron');

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

  await win.webContents.executeJavaScript(`
    const btns = Array.from(document.querySelectorAll('button'));
    const reportBtn = btns.find(b => b.textContent && b.textContent.includes('导出周报'));
    if (reportBtn) reportBtn.click();
  `);

  await new Promise((r) => setTimeout(r, 1000));

  const debugInfo = await win.webContents.executeJavaScript(`
    (() => {
      const results = [];
      const appRoot = document.getElementById('root');
      const header = document.querySelector('header');
      const main = document.querySelector('main');
      const aside = document.querySelector('aside');
      
      function getBox(el, name) {
        if (!el) return { name, exists: false };
        const rect = el.getBoundingClientRect();
        return {
          name,
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          overflowY: window.getComputedStyle(el).overflowY,
          className: el.className
        };
      }

      results.push({ windowInnerHeight: window.innerHeight, windowInnerWidth: window.innerWidth });
      results.push(getBox(appRoot, 'root'));
      results.push(getBox(document.querySelector('.flex.flex-col.h-screen'), 'appContainer'));
      results.push(getBox(header, 'topHeader'));
      results.push(getBox(main, 'main'));
      results.push(getBox(aside, 'sidebar'));
      
      const weeklyView = main.querySelector('.flex-1.flex.flex-col');
      results.push(getBox(weeklyView, 'weeklyReportViewWrapper'));
      
      const reportHeader = weeklyView ? weeklyView.querySelector('header') : null;
      results.push(getBox(reportHeader, 'reportHeader'));
      
      const reportWorkArea = weeklyView ? weeklyView.querySelector('.flex-1.flex.overflow-hidden') : null;
      results.push(getBox(reportWorkArea, 'reportWorkArea'));

      if (reportWorkArea) {
        const leftCol = reportWorkArea.children[0];
        const rightCol = reportWorkArea.children[1];
        results.push(getBox(leftCol, 'leftCol'));
        results.push(getBox(rightCol, 'rightCol'));
        
        if (rightCol) {
          const rightScrollArea = rightCol.querySelector('.flex-1.p-4');
          results.push(getBox(rightScrollArea, 'rightScrollArea'));
          if (rightScrollArea) {
            results.push(getBox(rightScrollArea.firstElementChild, 'rightInnerChild'));
          }
        }
      }

      return results;
    })()
  `);

  console.log(JSON.stringify(debugInfo, null, 2));
  app.quit();
});
