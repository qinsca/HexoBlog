/* global hexo */

'use strict';

/**
 * 魔改点 1：修复主题的「默认颜色模式 = auto」实现。
 *
 * hexo-theme-arknights 的 layout/includes/meta-data.pug 里根据 theme.color 拼一段
 * 初始化脚本，但 `color: auto` 这一支拼出来的 JS 在语法/语义上都是坏的：
 *
 *   if (window.localStorage.getItem('theme-mode') === 'light'
 *     || window.matchMedia('(prefers-color-scheme:light)').matches
 *   )
 *
 * （`if` 后面的条件与方法调用都没有闭合，结果是整段被浏览器当作语法错误丢弃，
 *   于是 auto 模式下永远只走 html 标签上写死的默认值。）
 *
 * 这里用 after_render:html 过滤器在生成的 HTML 里注入一段正确的初始化脚本，
 * 位置紧随主题那段坏脚本之后，index.html / 分页 / 文章页都生效。
 * 不改动主题的 pug 模板，升级主题时也不会被覆盖。
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
/* 2. Vercount 统计兜底                                                */
/* ------------------------------------------------------------------ */
/* 主题从 https://vercount.one/js 取访问量，脚本本身或它的接口在某些网络下
 * 拿不到数据，占位文字 "加载中..." 就会永远停在那里（侧边栏"总访问量/访客数"，
 * 文章页的"页面浏览"）。
 *
 * 这里只在"数据确实没回来"时把这些条目收起来，避免一直显示假的加载状态：
 *   - 脚本正常返回时，vercount 会把 span 的文字换掉，此时什么都不做；
 *   - 超过 8 秒仍是占位文字，就隐藏对应的条目容器。
 * 想恢复数字显示，等网络可用时无需改代码，这段逻辑不会干扰。
 */
const VERCUNT_FALLBACK = `<script id="ak-vercount-fallback">
(function () {
  var LOADING = /加载中|loading/i;
  var TIMEOUT = 8000;

  function hideStale() {
    // 所有 vercount 的数值节点 id 都是 vercount_value_*
    var nodes = document.querySelectorAll('[id^="vercount_value_"]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!LOADING.test(el.textContent || '')) continue;

      // 侧边栏：两个数值包在同一个 #total-view 里，整块收起
      var box = el.closest('#total-view');
      // 文章页：单个 "页面浏览: x" 的容器
      if (!box) box = el.closest('[id^="vercount_container_"]');
      if (!box) box = el.parentElement;
      if (box) box.style.display = 'none';
    }

    // 侧边栏那条 <br> 也会留下空隙，一并处理
    var view = document.querySelector('#total-view');
    if (view && view.style.display === 'none') {
      var prev = view.previousElementSibling;
      if (prev && prev.tagName === 'BR') prev.style.display = 'none';
    }
  }

  // 等外部脚本有机会执行完再看
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(hideStale, TIMEOUT);
    });
  } else {
    setTimeout(hideStale, TIMEOUT);
  }

  // pjax 换页后主题会重新插入 vercount 脚本，这里也重新计时
  document.addEventListener('pjax:success', function () {
    setTimeout(hideStale, TIMEOUT);
  });
})();
</script>`;

/* ------------------------------------------------------------------ */
/* 3. 把卡住会拖垮整页的外部脚本改成动态加载                            */
/* ------------------------------------------------------------------ */
/**
 * 背景：主题用 `defer` / `async` 直接内联引入外部脚本
 *   <script defer src="https://vercount.one/js">
 *   <script async src="//unpkg.com/lightgallery@2.7.1/lightgallery.min.js">
 *
 * defer 和 async 的脚本**都会**把 window 的 `load` 事件往后拖，直到它们
 * 加载完成或失败。而主题偏偏是在 `window.addEventListener('load', ...)`
 * 里初始化 pjax 的（见 layout/includes/js-data.pug:154）。
 *
 * 于是只要 vercount.one / unpkg.com 在国内网络下卡住（不是快速失败，而是
 * 长时间无响应），load 就一直不来 → pjax 不初始化 → 首次进入时侧边栏布局
 * 异常、"总访问量/访客数"永远停在"加载中"。
 *
 * 动态 createElement 插入的脚本不受这个限制（不参与 load 事件的等待），
 * 所以这里把它们换成动态加载。失败也不影响页面其余部分。
 */

// 依次加载（lightgallery 必须先于它的插件）
const DYNAMIC_LOADER = `<script id="ak-dynamic-scripts">
(function () {
  /* 占位函数：主题的 reset() 直接引用 lightGallery / lgZoom / lgThumbnail
     这几个全局变量（见 layout/includes/js-data.pug:150）。脚本还没到达时
     引用会抛 ReferenceError，先放空函数占位，避免打断 pjax 初始化。
     真正的脚本加载后会覆盖掉它们。 */
  if (typeof window.lightGallery === 'undefined') window.lightGallery = function () {};
  if (typeof window.lgZoom === 'undefined') window.lgZoom = function () {};
  if (typeof window.lgThumbnail === 'undefined') window.lgThumbnail = function () {};

  function load(src, next) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = s.onerror = function () { if (next) next(); };
    document.head.appendChild(s);
  }

  function chain(list, done) {
    var i = 0;
    (function step() {
      if (i >= list.length) return done && done();
      load(list[i++], step);
    })();
  }

  // 访问量统计：独立加载，失败就交给 ak-vercount-fallback 收起占位
  load('https://vercount.one/js');

  // 图表：主题原本在 head 里同步加载，会阻塞整页解析；改成动态后即使
  // unpkg 不可达，也只会让图表不渲染，不影响页面其他部分。
  load('https://unpkg.com/mermaid@11.12.2/dist/mermaid.min.js');

  // 图片灯箱：按顺序加载，全部到位后重新初始化一次
  chain([
    'https://unpkg.com/lightgallery@2.7.1/lightgallery.min.js',
    'https://unpkg.com/lightgallery@2.7.1/plugins/zoom/lg-zoom.min.js',
    'https://unpkg.com/lightgallery@2.7.1/plugins/thumbnail/lg-thumbnail.min.js'
  ], function () {
    // 真实脚本已就位，重新跑一次 reset() 让正文图片可以点击放大
    try {
      if (typeof window.reset === 'function') window.reset();
    } catch (e) {}
  });
})();
</script>`;

/** 从 HTML 里摘掉那些会阻塞 load 的外部脚本标签 */
function stripBlockingScripts(str) {
  return str
    .replace(/<script[^>]*src="https:\/\/vercount\.one\/js"[^>]*><\/script>\s*/g, '')
    .replace(/<script[^>]*src="\/\/unpkg\.com\/lightgallery@[^"]*"[^>]*><\/script>\s*/g, '')
    // mermaid 是 head 里的**同步**脚本，会阻塞整个页面解析，最致命
    .replace(/<script[^>]*src="\/\/unpkg\.com\/mermaid@[^"]*"[^>]*><\/script>\s*/g, '');
}

/**
 * 把 unpkg 的样式表改成非阻塞加载。
 *
 * 这三张 lightgallery 的 CSS 是**渲染阻塞**的：浏览器在拿到它们（或超时）之前
 * 不会绘制页面。unpkg 在国内常不可达，结果是首次打开时整页空白、侧边栏不出现。
 *
 * media="print" + onload 切回 all 是标准的异步 CSS 写法：先不阻塞渲染，
 * 加载完成后应用。灯箱用不到时也完全无副作用。
 */
function deferExternalStyles(str) {
  return str.replace(
    /<link([^>]*?)href="(\/\/unpkg\.com\/[^"]+\.css)"([^>]*?)>/g,
    (match, before, href, after) => {
      // 已经处理过就跳过
      if (/media="print"/.test(match)) return match;
      // 去掉原本可能存在的 media 属性，避免重复
      const cleaned = (before + after).replace(/\s*media="[^"]*"/g, '');
      return `<link${cleaned} href="${href}" media="print" onload="this.media='all'">`;
    }
  );
}

hexo.extend.filter.register('after_render:html', function (str, data) {
  // 只处理主题渲染出来的页面（含 <head> 的完整文档）
  if (!str || str.indexOf('theme-mode') === -1) return str;

  if (str.indexOf('ak-color-mode-init') === -1) {
    const anchor = '<link rel="stylesheet" href="/css/arknights.css">';
    if (str.indexOf(anchor) !== -1) {
      str = str.replace(anchor, anchor + '\n' + FIX);
    } else {
      const headEnd = str.indexOf('</head>');
      if (headEnd !== -1) str = str.slice(0, headEnd) + FIX + '\n' + str.slice(headEnd);
    }
  }

  // 去掉会阻塞 load 的外部脚本，改用动态加载
  if (str.indexOf('ak-dynamic-scripts') === -1) {
    str = stripBlockingScripts(str);
  }

  // 外部样式表改非阻塞，避免首次渲染被 unpkg 卡住
  str = deferExternalStyles(str);

  const bodyEnd = str.lastIndexOf('</body>');
  if (bodyEnd !== -1) {
    let inject = '';
    if (str.indexOf('ak-dynamic-scripts') === -1) inject += DYNAMIC_LOADER + '\n';
    if (str.indexOf('ak-vercount-fallback') === -1) inject += VERCUNT_FALLBACK + '\n';
    if (inject) str = str.slice(0, bodyEnd) + inject + str.slice(bodyEnd);
  }

  return str;
});
