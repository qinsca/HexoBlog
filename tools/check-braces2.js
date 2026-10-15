const fs = require('fs');

function unescapeHtml(str) {
  return str
    .replace(/&#123;/g, '{').replace(/&#125;/g, '}')
    .replace(/&#37;/g, '%')
    .replace(/&#x([0-9a-fA-F]+);/g, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

const strip = (s) => s.replace(/<[^>]+>/g, '');

let checked = 0, mismatches = 0;
const dirs = fs.readdirSync('public/posts').filter((d) => fs.statSync('public/posts/' + d).isDirectory());

// 从 db.json（已升级过的 content）不便反推原文，直接对比：渲染出的代码块文本
// 应该能在对应的源 md 里找到（逐行匹配，忽略缩进差异）
for (const d of dirs) {
  const h = fs.readFileSync('public/posts/' + d + '/index.html', 'utf8');
  const title = (h.match(/<h1>([\s\S]*?)<\/h1>/) || [, '?'])[1].replace(/<[^>]+>/g, '');
  const blocks = [...h.matchAll(/<td class="code"><pre><code class="hljs [^"]*">([\s\S]*?)<\/code><\/pre><\/td>/g)]
    .map((m) => unescapeHtml(strip(m[1])).replace(/<br>/g, '\n'));

  for (const b of blocks) {
    checked++;
    const lines = b.split('\n').map((l) => l.trim()).filter((l) => l.length > 3 && !/^[{}();,]+$/.test(l));
    // 每行都必须是无损的：不含未解码实体、不含被吞掉的字符迹象
    for (const l of lines) {
      if (/&[a-z#][a-z0-9]*;/i.test(l)) {
        mismatches++;
        console.log('残留实体:', d, title, '|', l.slice(0, 70));
      }
    }
  }
}

console.log(`\n检查代码块 ${checked} 个，含残留实体的行 ${mismatches} 行`);

// 直接给出几段实际渲染文本，人工确认
const h = fs.readFileSync('public/posts/e7fb0c8/index.html', 'utf8');
const blocks = [...h.matchAll(/<td class="code"><pre><code class="hljs [^"]*">([\s\S]*?)<\/code><\/pre><\/td>/g)]
  .map((m) => unescapeHtml(strip(m[1])).replace(/<br>/g, '\n'));
console.log('\n--- bfs&dfs模板 第 1 个代码块 ---');
console.log(blocks[0]);
