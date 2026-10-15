const fs = require('fs');
for (const [p, label] of [['public/tags/index.html', 'TAGS'], ['public/categories/index.html', 'CATEGORIES']]) {
  const h = fs.readFileSync(p, 'utf8');
  const s = h.indexOf('<article>');
  const e = h.indexOf('</article>');
  const art = h.slice(s, e);
  const heads = [...art.matchAll(/<h([12])[^>]*>([\s\S]*?)<\/h\1>/g)]
    .map((m) => `h${m[1]}="${m[2].replace(/<[^>]+>/g, '').trim()}"`);
  const terms = [...art.matchAll(/class="ak-term-title"[^>]*>([^<]*)</g)].map((m) => m[1]);
  const counts = [...art.matchAll(/class="ak-term-count">(\d+)</g)].map((m) => m[1]);
  console.log(`=== ${label} ===`);
  console.log('  标题序列 :', heads.join(' '));
  console.log('  标签数   :', terms.length, '->', terms.join(','));
  console.log('  计数     :', counts.join(','));
  console.log('  提示行   :', (art.match(/class="ak-terms-hint">([^<]*)</) || [, '(无)'])[1]);
  // 侧边导航在 <article> 之外的 <aside> 里，要在整页范围找
  console.log('  侧边导航 :', /id="navigation"/.test(h) ? 'ok' : '缺失');
  console.log('  #post-bg :', /id="post-bg"/.test(art) ? '有(错误：用了 post 布局)' : '无(correct)');
}
