// Mengukur kotak layer scene dari DOM. Dipakai:
//   npx electron tools/scene-measure.js <nama-css>
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PREVIEW = path.join(DIST, '_measure.html');

const HTML = fs.readFileSync(path.join(__dirname, 'scene-shot.js'), 'utf8')
  .match(/const HTML = `([\s\S]*?)`;/)[1]
  .replace('__CSS__', process.argv[2]);

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  fs.writeFileSync(PREVIEW, HTML);
  const win = new BrowserWindow({ width: 1280, height: 720, show: false, frame: false });
  await win.loadFile(PREVIEW);
  await new Promise((r) => setTimeout(r, 900));

  const info = await win.webContents.executeJavaScript(`
    (() => {
      const out = { viewport: [innerWidth, innerHeight], layers: [] };
      for (const sel of ['.scene-root', '.scene-sky', '.scene-strip', '.scene-strip-bukit', '.scene-strip-semak', '.scene-monkey-wrap', '.scene-block', '.scene-strip-bukit', '.scene-strip-semak', '.scene-crab-wrap', '.scene-monkey-idle']) {
        document.querySelectorAll(sel).forEach((el, i) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          out.layers.push({
            sel: sel + (document.querySelectorAll(sel).length > 1 ? '#' + i : ''),
            box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
            pos: cs.position,
            bgSize: cs.backgroundSize,
            bgImage: cs.backgroundImage.slice(0, 60),
          });
        });
      }
      return out;
    })()
  `);
  console.log(JSON.stringify(info));
  app.quit();
});


