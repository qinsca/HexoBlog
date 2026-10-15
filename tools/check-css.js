const fs = require('fs');

const css = fs.readFileSync('source/css/ak-custom.css', 'utf8');
let depth = 0, line = 1, bad = null;
for (const ch of css) {
  if (ch === '\n') line++;
  if (ch === '{') depth++;
  if (ch === '}') { depth--; if (depth < 0 && !bad) bad = line; }
}
console.log('ak-custom.css  braces balanced:', depth === 0 && !bad, '| final depth =', depth, bad ? '(unexpected } at line ' + bad + ')' : '');

const html = fs.readFileSync('public/index.html', 'utf8');
const refs = [...html.matchAll(/(?:href|src)="(\/[^"]+)"/g)].map((m) => m[1]);
const unique = [...new Set(refs)];
console.log('index.html 引用资源数:', unique.length);
console.log(unique.filter((u) => u.startsWith('/css') || u.startsWith('/js')).join('\n'));

// 确认主题脚本顺序：ak-color-mode-init 在 arknights.css 之后、正文之前
const iCss = html.indexOf('/css/arknights.css');
const iInit = html.indexOf('ak-color-mode-init');
const iBody = html.indexOf('<body');
console.log('\narknights.css @', iCss, '| init script @', iInit, '| <body> @', iBody);
console.log('顺序正确:', iCss !== -1 && iInit > iCss && iInit < iBody);
