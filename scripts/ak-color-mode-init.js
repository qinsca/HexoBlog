/* global hexo */

'use strict';

/**
 * 站点级 HTML 注入
 *
 * 1) 修复主题的「默认颜色模式 = auto」实现（见下方说明）
 * 2) 评论区光标覆盖层（内联版）
 *
 * 为什么光标逻辑要内联：
 *   原先放在 /js/ak-custom.js 里，但线上出现 `akCursorDiag is not defined`
 *   —— 说明那个外部脚本根本没执行（缓存 / 404 / 被拦截都可能）。
 *   把这块内联进 HTML 后，它随文档一起到达，不受外部资源加载影响。
 */

/* ------------------------------------------------------------------ */
/* 1. 颜色模式初始化                                                   */
/* ------------------------------------------------------------------ */
/* hexo-theme-arknights 的 meta-data.pug 在 theme.color === 'auto' 时
 * 拼出的 JS 语法是坏的（if 的条件和方法调用都没闭合），浏览器直接丢弃，
 * 于是 auto 模式永远走 html 标签上写死的默认值。这里补一段正确的。
 */
const FIX = `<script id="ak-color-mode-init">
(function () {
  var doc = document.documentElement;
  try {
    var saved = window.localStorage.getItem('theme-mode');
    var media = window.matchMedia('(prefers-color-scheme: dark)');
    var mode = ('light' === saved || 'dark' === saved)
      ? saved
      : (media.matches ? 'dark' : 'light');
    if (doc.getAttribute('theme-mode') !== mode) {
      doc.setAttribute('theme-mode', mode);
    }
  } catch (e) {
    if (doc.getAttribute('theme-mode') === 'auto') {
      doc.setAttribute('theme-mode', 'dark');
    }
  }
})();
</script>`;

/* ------------------------------------------------------------------ */
/* 2. 评论区光标覆盖层（内联）                                         */
/* ------------------------------------------------------------------ */
/* giscus 是 giscus.app 的跨域 iframe，父页面 CSS 进不到它内部文档，
 * 评论区内只能显示系统光标。这里在 iframe 上方画一个主题同款光标。
 *
 * 安全策略：默认不隐藏原生光标；只有当覆盖层已经定位并显示出来后，
 * 才给评论区加 .ak-cursor-hidden。这样最坏情况只是"还是系统光标"。
 *
 * 诊断：控制台执行 akCursorDiag()，或地址加 #akcursor-debug 看红框。
 */
const CURSOR = `<script id="ak-comment-cursor">
(function () {
  /* 判定区：既包含容器，也包含 giscus 注入的 iframe 本身。
     只依赖容器尺寸是不够的 —— iframe 由 giscus 异步注入，容器可能先于它
     有尺寸，或者比它小，导致边缘几像素判不进。 */
  var ZONE = '#comments, #giscus, #utterances, ' +
    '#comments iframe, #giscus iframe, #utterances iframe, ' +
    '.giscus-frame, .utterances-frame';
  var DEBUG = /akcursor-debug/.test(window.location.hash || '');
  var layer = null;
  var shown = false;

  function ensureLayer() {
    if (layer && layer.isConnected) return layer;
    layer = document.createElement('div');
    layer.id = 'ak-iframe-cursor';
    if (DEBUG) layer.className = 'ak-debug';
    document.body.appendChild(layer);
    return layer;
  }

  function inZone(x, y) {
    var nodes = document.querySelectorAll(ZONE);
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect();
      if (r.width < 16 || r.height < 16) continue;
      if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) return true;
    }
    return false;
  }

  function containers() {
    return document.querySelectorAll('#comments, #giscus, #utterances');
  }

  function place(el, x, y) {
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }

  function show(on, x, y) {
    var el = ensureLayer();
    var cs = containers();
    var i;

    if (on) {
      // 定位先于显示，避免首帧出现在旧坐标
      place(el, x, y);
      if (!shown) {
        shown = true;
        el.classList.add('on');
        for (i = 0; i < cs.length; i++) cs[i].classList.add('ak-cursor-hidden');
      }
    } else {
      if (shown) {
        shown = false;
        el.classList.remove('on');
        for (i = 0; i < cs.length; i++) cs[i].classList.remove('ak-cursor-hidden');
      }
    }
  }

  function track(ev) {
    if (ev.pointerType && ev.pointerType !== 'mouse') return show(false, 0, 0);
    var x = ev.clientX;
    var y = ev.clientY;
    var hit = inZone(x, y);
    show(hit, x, y);
  }

  document.addEventListener('pointermove', track, { passive: true });
  document.addEventListener('mousemove', track, { passive: true });
  document.addEventListener('pointerleave', function () { show(false, 0, 0); }, { passive: true });
  window.addEventListener('blur', function () { show(false, 0, 0); });
  document.addEventListener('pjax:success', function () { show(false, 0, 0); });

  /* 注意：这里【不能】监听 scroll。
     鼠标在 giscus iframe 内部滚动时 scroll 会不断触发，把覆盖层反复关掉，
     表现就是"边缘有框、进不去内部"。 */

  // 自检入口：控制台执行 akCursorDiag()
  window.akCursorDiag = function (x, y) {
    var el = document.getElementById('ak-iframe-cursor');
    var cs = el ? window.getComputedStyle(el) : {};
    var out = {
      jsVersion: 'inline-cursor/2',
      debugHash: DEBUG,
      layerExists: !!el,
      layerClass: el ? el.className : null,
      layerStyle: el ? (el.style.left + ',' + el.style.top) : null,
      computed: {
        position: cs.position,
        zIndex: cs.zIndex,
        visibility: cs.visibility,
        opacity: cs.opacity,
        backgroundImage: String(cs.backgroundImage || '').slice(0, 60)
      },
      containers: [],
      cursorData: String(
        window.getComputedStyle(document.documentElement)
          .getPropertyValue('--cursor-data')
      ).slice(0, 40)
    };
    var nodes = document.querySelectorAll(ZONE);
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect();
      out.containers.push({
        sel: nodes[i].id || nodes[i].className || nodes[i].tagName,
        x: Math.round(r.left),
        y: Math.round(r.top),
        w: Math.round(r.width),
        h: Math.round(r.height),
        hidden: nodes[i].classList.contains('ak-cursor-hidden')
      });
    }
    // akCursorDiag(x, y) 可指定坐标做命中测试，方便不开鼠标也验证判定
    if (typeof x === 'number' && typeof y === 'number') {
      out.testPoint = { x: x, y: y, inZone: inZone(x, y) };
    }
    if (window.console) console.log('[akCursorDiag]', out);
    return out;
  };
})();
</script>`;

hexo.extend.filter.register('after_render:html', function (str, data) {
  // 只处理主题渲染出来的页面（含 <head> 的完整文档）
  if (!str || str.indexOf('theme-mode') === -1) return str;

  // 1. 颜色模式修复：插在 arknights.css 之后
  if (str.indexOf('ak-color-mode-init') === -1) {
    const anchor = '<link rel="stylesheet" href="/css/arknights.css">';
    if (str.indexOf(anchor) !== -1) {
      str = str.replace(anchor, anchor + '\n' + FIX);
    } else {
      const headEnd = str.indexOf('</head>');
      if (headEnd !== -1) str = str.slice(0, headEnd) + FIX + '\n' + str.slice(headEnd);
    }
  }

  // 2. 评论区光标：插在 </body> 之前
  if (str.indexOf('ak-comment-cursor') === -1) {
    const bodyEnd = str.lastIndexOf('</body>');
    if (bodyEnd !== -1) {
      str = str.slice(0, bodyEnd) + CURSOR + '\n' + str.slice(bodyEnd);
    }
  }

  return str;
});
