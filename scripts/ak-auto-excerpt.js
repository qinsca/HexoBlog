/* global hexo */

'use strict';

/**
 * 魔改点 2：首页摘要自动生成（还原 NexT 时期的自动摘要体验）。
 *
 * 背景：Hexo 只有在文章里出现 `<!-- more -->` 时才会截断并填充 `post.more`；
 * 而 hexo-theme-arknights 的首页卡片是用 `post.more` 渲染摘要的
 * （见 layout/includes/recent-posts.pug 的 `if post.excerpt.length > 0`），
 * 两者相遇的结果就是首页卡片只剩标题和日期、没有摘要。
 *
 * 这里在 after_post_render 阶段（Hexo 自带 excerpt 过滤器之前，靠注册顺序生效）：
 *   - 作者手动写了 `<!-- more -->` 的文章：完全不动；
 *   - 其余文章：截取正文开头一小段作为首页摘要。
 * 截断点只落在块级标签的收尾处，保证 HTML 结构完整。
 *
 * 想改摘要长度：调整下面的 MAX_CHARS，或在环境变量里设 AK_EXCERPT_CHARS。
 */
const MAX_CHARS = parseInt(process.env.AK_EXCERPT_CHARS || '220', 10);

// 可以作为截断点的块级元素收尾标签
const BREAK_TAGS = ['</p>', '</blockquote>', '</h2>', '</h3>', '</ol>', '</ul>', '</pre>', '</table>'];

const MORE_RE = /<!-- ?more ?-->/i;

function truncate(html) {
  if (typeof html !== 'string' || html.length === 0) return '';

  // 纯文字已经比上限短：整篇当摘要
  if (html.replace(/<[^>]+>/g, '').length <= MAX_CHARS) return html;

  // 标签也占长度，放宽到 2 倍再往前找块级断点
  const head = html.slice(0, MAX_CHARS * 2);

  let best = -1;
  for (const tag of BREAK_TAGS) {
    const at = head.lastIndexOf(tag);
    if (at > best) best = at + tag.length;
  }
  if (best > 0) return head.slice(0, best);

  // 没有块级断点：按可见文字数安全截断，且不切在标签中间
  let visible = 0;
  let i = 0;
  let inTag = false;
  for (; i < html.length && visible < MAX_CHARS; i++) {
    const ch = html[i];
    if (ch === '<') inTag = true;
    else if (ch === '>') inTag = false;
    else if (!inTag) visible++;
  }
  return html.slice(0, i);
}

hexo.extend.filter.register('after_post_render', function (data) {
  // 只处理文章，跳过 page（about / tags / categories 等）
  if (data.layout !== 'post') return data;
  if (typeof data.content !== 'string' || data.content.length === 0) return data;

  // 作者手动写了 <!-- more -->：交回 Hexo 自带的 excerpt 过滤器处理
  if (MORE_RE.test(data.content)) return data;

  const summary = truncate(data.content);
  if (summary) data.more = summary;

  return data;
}, { priority: 20 });
// priority 20 > Hexo 内置 after_post_render 过滤器的默认值 10，
// 因此这里能覆盖内置 excerpt 过滤器为「无 <!-- more --> 文章」填进去的整篇正文。
