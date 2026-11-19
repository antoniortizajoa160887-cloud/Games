// Renders tools/icon.html and writes the Android launcher icons and splash screens.
// Needs `npx vite --port 5199` running in the project root, plus Playwright and Python Pillow.
const { chromium } = require('playwright');
const fs = require('fs');
const { execFileSync } = require('child_process');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:5199/tools/icon.html');
  await p.waitForFunction(() => window.done);
  for (const id of ['icon', 'fg', 'splash']) {
    const data = await p.evaluate(i => document.getElementById(i).toDataURL('image/png'), id);
    fs.writeFileSync(`tools/out-${id}.png`, Buffer.from(data.split(',')[1], 'base64'));
  }
  await b.close();
  execFileSync('python3', ['tools/resize-icons.py'], { stdio: 'inherit' });
})();
