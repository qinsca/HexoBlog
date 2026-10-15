const http = require('http');

const urls = [
  '/',
  '/page/2/',
  '/about/',
  '/archives/',
  '/tags/',
  '/categories/',
  '/posts/9d440e51/',   // pwn学习记录（其三）— 原先被 其二 覆盖
  '/posts/f2f9ee35/',   // pwn学习记录（其七）— 原先被 其一 覆盖
  '/posts/e04c41db/',   // pwn学习记录（其一）
  '/posts/d05aad03/',   // pwn学习记录（其二）
  '/css/ak-custom.css',
  '/js/ak-custom.js',
  '/images/qsc-avatar.png',
  '/img/bg.jpg',   // 白天背景（主题自带）
  '/img/bk.jpg',   // 夜间背景（主题自带）
  '/images/pwn1/checksec.png',
  '/search.json',
  '/404.html',
];

function get(path) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: 4173, path, timeout: 8000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { if (body.length < 400000) body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', (e) => resolve({ status: 'ERR ' + e.message, body: '' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'TIMEOUT', body: '' }); });
  });
}

(async () => {
  for (const u of urls) {
    const r = await get(u);
    let extra = '';
    if (u.startsWith('/posts/')) {
      const t = (r.body.match(/<h1>([\s\S]*?)<\/h1>/) || [, '?'])[1];
      extra = '  title=' + t;
    }
    if (/ak-custom|custom\.js$/.test(u)) extra = '  bytes=' + r.body.length;
    console.log(`${u.padEnd(30)} ${String(r.status).padEnd(8)}${extra}`);
  }
})();
