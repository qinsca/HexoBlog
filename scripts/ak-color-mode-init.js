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

hexo.extend.filter.register('after_render:html', function (str, data) {
  // 只处理主题渲染出来的页面（含 <head> 的完整文档）
  if (!str || str.indexOf('theme-mode') === -1) return str;
  if (str.indexOf('ak-color-mode-init') !== -1) return str;

  const anchor = '<link rel="stylesheet" href="/css/arknights.css">';
  if (str.indexOf(anchor) !== -1) {
    return str.replace(anchor, anchor + '\n' + FIX);
  }

  // 兜底：插到 </head> 之前
  const headEnd = str.indexOf('</head>');
  if (headEnd !== -1) {
    return str.slice(0, headEnd) + FIX + '\n' + str.slice(headEnd);
  }
  return str;
});
