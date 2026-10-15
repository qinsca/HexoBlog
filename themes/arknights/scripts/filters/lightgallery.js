/* global hexo */

'use strict';

/**
 * hexo-theme-arknights 的 lightgallery 适配（魔改修复版）
 *
 * 原实现会把 `<p><img ...></p>` 改写成 `<p class='item-img' data-src='...'><img ...></p>`，
 * 这段标记本身就是残缺的（标签的 `>` 被挤到属性后面），而且 class 加在 `<p>` 上，
 * 导致 lightGallery 的 `selector: '.item-img'` 选不中图片、点击大图失效。
 *
 * 这里改为把正文图片包进 `<a class="item-img" href="原图">`，
 * lightGallery 以该 `<a>` 作为可点击项，既保留原有结构又能正常放大预览。
 */
function wrapImg(content) {
  if (typeof content !== 'string' || content.indexOf('<img') === -1) return content;

  return content.replace(/<img\b[^>]*?>/g, (img, offset, whole) => {
    // 已经处于 <a> 内部的图片：给出提示，不改动结构（避免 a 嵌套 a）
    const before = whole.slice(0, offset);
    const lastOpenA = before.lastIndexOf('<a ');
    const lastCloseA = before.lastIndexOf('</a>');
    if (lastOpenA > lastCloseA) return img;

    const src =
      (img.match(/\bsrc=(["'])(.*?)\1/) || [])[2] ||
      (img.match(/\bsrc=([^\s"'>]+)/) || [])[1];
    if (!src) return img;

    return `<a class="item-img" href="${src}">${img}</a>`;
  });
}

hexo.extend.filter.register('after_post_render', (data) => {
  data.content = wrapImg(data.content);
  data.more = wrapImg(data.more);
  return data;
});
