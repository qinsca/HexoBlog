const fs = require('fs');
const h = fs.readFileSync('public/index.html', 'utf8');

const tests = {
  '构建自 (zh footer.publish)': h.includes('构建自'),
  'Published with (en)': h.includes('Published with'),
  '文章 (zh menu.archive.plural)': h.includes('文章'),
  'Archives (en)': />Archives</.test(h),
  '阅读文章 + (zh page.readMore)': h.includes('阅读文章'),
  'READ MORE (en)': h.includes('READ MORE'),
  '数据检索 (zh search.blurHolder)': h.includes('数据检索'),
  '切换主题 (zh btn.colorMode)': h.includes('切换主题'),
};

for (const k in tests) console.log(String(k).padEnd(34), tests[k]);

// 直接把相关片段打印出来（用 JSON 转义，确保中文不被控制台吃掉）
const i = h.indexOf('<footer');
console.log('\nfooter raw:', JSON.stringify(h.slice(i, i + 320)));
const j = h.indexOf('read-more');
console.log('\nread-more raw:', JSON.stringify(h.slice(j - 60, j + 60)));
const k = h.indexOf('search-input');
console.log('\nsearch raw:', JSON.stringify(h.slice(k - 120, k + 80)));
