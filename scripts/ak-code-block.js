/* global hexo */

'use strict';

/**
 * 魔改点 3：让「缩进式代码块」也获得高亮与行号。
 *
 * 问题根因（Hexo 上游行为，与主题无关）：
 *   Hexo 只在 `before_post_render` 里处理 ``` / ~~~ 围栏代码块
 *   （见 hexo/dist/plugins/filter/before_post_render/backtick_code_block.js），
 *   缩进 4 空格写法的代码块会由 marked 渲染成裸的 <pre><code>，
 *   既不套 <figure class="highlight">，也拿不到 .hljs 着色。
 *   而 hexo-theme-arknights 的代码样式、行号 gutter、复制按钮全都依赖 .highlight 结构，
 *   所以这类代码块会变成没有任何背景的纯文本，看起来就像"代码块不见了"。
 *
 * 处理方式：在 after_post_render 阶段定位裸 <pre><code>，做等价转换 ——
 *   1. 反转义实体、还原真实文本；
 *   2. 用 highlight.js 检测/着色（除非是混排的伪代码，见 looksLikeCode）；
 *   3. 生成与 Hexo 完全一致的 <figure class="highlight"><table>… 结构（含行号）。
 *
 * 围栏代码块不受影响（它们本来就已经被 Hexo 处理过了）。
 */
const hljs = require('highlight.js');

const HLJS_ALIASES = {
  'c++': 'cpp', cxx: 'cpp', cc: 'cpp', hpp: 'cpp', h: 'cpp',
  py: 'python', python3: 'python',
  js: 'javascript', ts: 'typescript', sh: 'bash', shell: 'bash', zsh: 'bash',
  yml: 'yaml', md: 'markdown', text: 'plaintext', txt: 'plaintext', plain: 'plaintext',
};

function unescapeHtml(str) {
  return str
    // Hexo 在 backtick_code_block 里用 escapeSwigTag 把花括号转义掉，
    // 这里必须先还原，否则再 escape 一次会变成 &amp;#123;（页面显示字面量 &#123;）
    .replace(/&#123;/g, '{')
    .replace(/&#125;/g, '}')
    .replace(/&#37;/g, '%')
    // 数字实体（&#x2F; / &#39; 等）
    .replace(/&#x([0-9a-fA-F]+);/g, (m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    // 命名实体（&amp; 必须最后处理）
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** 只转义 HTML 语法字符；花括号在 Hexo 里是安全的，保持原样 */
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 判断这段裸代码块是不是"真代码"。
 * 作者很多笔记是「一行代码 + 一行说明」的随手记，缩进出来的块里混着中文句子，
 * 这种不做语法着色（着出来只会一片红），但仍然套上 .highlight 让它有代码块的样式。
 */
function looksLikeCode(text) {
  const t = text.trim();
  if (!t) return false;
  const cjk = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  if (cjk / t.length > 0.25) return false;              // 中文占比过高
  if (!/[A-Za-z_$]/.test(t)) return false;              // 没有标识符字符
  return /[=(){}\[\];]|::|->|#\s*\w|\b(if|for|while|return|def|class|import|from|print|int|void|char|struct|using|const)\b/.test(t);
}

/**
 * 这些笔记大多是"代码片段 + 中文说明"的随手记，片段很短（几行），
 * highlight.js 的 highlightAuto 在这类输入上极不可靠
 * （实测会把 Python 判成 stylus / ini、把 C++ 判成 stan）。
 * 所以这里按真实语法特征打分，判不准就退回 plaintext（不着色，至少不变色）。
 */
const LANG_HINTS = [
  ['cpp', [
    [/^\s*#\s*include\s*[<"]/m, 10],
    [/\bstd::|using\s+namespace\s+std\b/, 6],
    [/\b(cout|cin|endl|vector|string|struct|template|printf|scanf|queue|stack|map|set|pair)\b/, 3],
    [/\b(int|void|char|long|double|float|bool|unsigned|size_t)\s+[A-Za-z_]\w*\s*[;=([]/, 3],
    [/\b(const|static|inline|nullptr|new|delete|typedef|namespace)\b/, 2],
    [/->|::|<<|>>/, 1],
  ]],
  ['python', [
    [/^\s*(from\s+[\w.]+\s+)?import\s+\w+/m, 8],
    [/\bdef\s+\w+\s*\(/, 6],
    [/\b(print|len|range|enumerate|isqrt|bytes\.fromhex|long_to_bytes|process|sendline|recvline)\s*\(/, 4],
    [/\b(if|elif|else|for|while|try|except|with|class)\b[^\n]*:\s*$/m, 4],
    [/\b(self|None|True|False|lambda|elif)\b/, 3],
  ]],
  ['javascript', [
    [/\b(const|let|var)\s+\w+\s*=/, 4],
    [/=>|console\.log|function\s*\(|require\(/, 4],
    [/\b(document|window|module\.exports|JSON\.)\b/, 3],
  ]],
  ['bash', [
    [/^\s*(#!\/bin\/(ba)?sh|sudo\s|\$\s+\w|python3?\s+\w+\.py|\.\/\w+)/m, 7],
    [/\b(echo|chmod|chown|apt|pip|gcc|gdb|cat\s|ls\s|cd\s|mkdir|export|nc\s|checksec)\b/, 3],
    [/\|\s*(grep|awk|sed|xargs)\b/, 4],
  ]],
  ['asm', [
    [/^\s*(mov|lea|pop|push|ret|call|jmp|nop|xor|add|sub|cmp|int\s+0x80)\b/m, 6],
    [/\b(eax|ebx|ecx|edx|esi|edi|esp|ebp|rax|rbx|rcx|rdx|rsi|rdi|rsp|rbp)\b/, 5],
  ]],
  ['sql', [
    [/\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|UNION|WHERE|ORDER\s+BY)\b/i, 6],
    [/\bFROM\s+\w+|\bAND\b|\bOR\b/i, 2],
  ]],
  ['yaml', [
    [/^\s*[\w-]+:\s*$/m, 3],
    [/^\s*-\s+\w+/m, 2],
    [/^\s*[\w-]+:\s+\S+/m, 2],
  ]],
];

function guessLanguage(text) {
  const scores = {};
  for (const [lang, rules] of LANG_HINTS) {
    let s = 0;
    for (const [re, w] of rules) if (re.test(text)) s += w;
    if (s) scores[lang] = s;
  }
  const ranked = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
  if (!ranked.length) return 'plaintext';
  const best = ranked[0];
  const second = ranked[1];
  // 分数太低、或与第二名咬得太紧 => 判不准，干脆不着色（不着色也不会难看）
  if (scores[best] < 3) return 'plaintext';
  if (second && scores[best] - scores[second] < 1) return 'plaintext';
  return best;
}

/** 优先采用作者声明的语言，否则按语法特征猜 */
function pickLanguage(text, declared) {
  if (declared) {
    const alias = HLJS_ALIASES[declared] || declared;
    if (hljs.getLanguage(alias)) return alias;
  }
  return guessLanguage(text);
}

function makeFigure(code, lang) {
  const lines = code.replace(/\n+$/, '').split('\n');
  const gutter = lines
    .map((_, i) => `<span class="line">${i + 1}</span>`)
    .join('<br>');

  let highlighted;
  if (lang === 'plaintext') {
    highlighted = escapeHtml(code.replace(/\n+$/, ''));
  } else {
    try {
      highlighted = hljs.highlight(code.replace(/\n+$/, ''), {
        language: lang,
        ignoreIllegals: true,
      }).value;
    } catch (e) {
      highlighted = escapeHtml(code.replace(/\n+$/, ''));
      lang = 'plaintext';
    }
  }

  return (
    `<figure class="highlight ${lang}">` +
    '<table><tr>' +
    `<td class="gutter"><pre>${gutter}<br></pre></td>` +
    `<td class="code"><pre><code class="hljs ${lang}">${highlighted}<br></code></pre></td>` +
    '</tr></table></figure>'
  );
}

function upgradeBareCodeBlocks(html) {
  if (typeof html !== 'string' || html.indexOf('<pre><code') === -1) return html;

  return html.replace(
    /<pre><code(?:\s+class="([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g,
    (match, cls, body) => {
      if (/hljs/.test(cls || '')) return match;             // 已经高亮过
      if (/&#123;&#123;|&#37;|hexoPostRenderCodeBlock/.test(body)) return match; // tag plugin 产物

      const code = unescapeHtml(body);
      const declared = (cls || '').replace(/^language-/, '').trim().toLowerCase();
      const lang = looksLikeCode(code) ? pickLanguage(code, declared) : 'plaintext';
      return makeFigure(code, lang);
    }
  );
}

hexo.extend.filter.register('after_post_render', function (data) {
  data.content = upgradeBareCodeBlocks(data.content);
  if (typeof data.more === 'string') data.more = upgradeBareCodeBlocks(data.more);
  return data;
}, { priority: 40 });
// priority 40：排在 Hexo 内置 excerpt(10) 与本仓库的自动摘要(20) 之后，
// 保证截断出来的 more 也是已经修好的 HTML。
