const fs = require('fs');

const pages = ['public/index.html', 'public/about/index.html', 'public/archives/index.html', 'public/posts/e04c41db/index.html'];
let bad = 0;
for (const p of pages) {
  const h = fs.readFileSync(p, 'utf8');
  const aside = (h.match(/<aside[\s\S]*?<\/aside>/) || [''])[0];
  const footer = (aside.match(/<footer[\s\S]*?<\/footer>/) || [''])[0];
  const text = footer.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const hasArknights = /Arknights|Yue_plus|使用主题|主题作者/.test(footer);
  if (hasArknights) bad++;
  console.log(p.padEnd(36), '| footer:', JSON.stringify(text));
}
console.log('\n仍含主题署名的页面数:', bad);
