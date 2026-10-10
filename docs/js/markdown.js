// Escape-first Markdown renderer — XSS-safe. v2: زرار تشغيل لأكواد HTML/SVG.
const MD = (() => {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const KW = {
    javascript: 'const let var function return if else for while do class new import export from async await try catch finally throw typeof instanceof default switch case break continue this super null undefined true false yield of in delete void static get set',
    python: 'def return if elif else for while class import from as try except finally with lambda None True False and or not in is pass raise yield global nonlocal assert del async await',
    json: 'true false null',
    bash: 'echo cd ls export if then fi for do done sudo apt npm git curl mkdir rm cat',
    sql: 'select from where insert into update delete join on group by order limit create table'
  };
  KW.js = KW.javascript; KW.py = KW.python; KW.sh = KW.bash;
  function plain(seg, lang) {
    let s = esc(seg);
    if (lang === 'html' || lang === 'xml' || lang === 'svg')
      s = s.replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="tok-t">$2</span>');
    const kws = KW[lang];
    if (kws) s = s.replace(new RegExp('\\b(' + kws.split(' ').join('|') + ')\\b', 'g'), '<span class="tok-k">$1</span>');
    return s;
  }
  function hl(code, lang) {
    lang = (lang || '').toLowerCase();
    const re = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|(?:^|\s)#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)/g;
    let out = '', last = 0, m;
    while ((m = re.exec(code))) {
      out += plain(code.slice(last, m.index), lang);
      if (m[1]) out += '<span class="tok-c">' + esc(m[1]) + '</span>';
      else if (m[2]) out += '<span class="tok-s">' + esc(m[2]) + '</span>';
      else out += '<span class="tok-n">' + esc(m[3]) + '</span>';
      last = re.lastIndex;
    }
    return out + plain(code.slice(last), lang);
  }
  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, (m, c) => '<code class="md-inline">' + c + '</code>');
    s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(>])\*([^*\n]+)\*(?=[\s).,<;:!?"'\]]|$)/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (m, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
    return s;
  }
  function codeHtml(c) {
    const lang = c.lang || '';
    const canRun = ['html', 'svg', 'htm', 'xhtml'].includes(lang.toLowerCase());
    return `<div class="code-block"><div class="code-head"><span class="code-lang">${esc(lang || 'code')}</span>` +
      (canRun ? `<button type="button" class="code-copy run" data-code-run title="${Lang.t('run_code')}">${UI.icon('zap', 14)}</button>` : '') +
      `<button type="button" class="code-copy" data-code-copy aria-label="${Lang.t('copy_code')}">${UI.icon('copy', 14)}</button></div>` +
      `<pre dir="ltr"><code>${hl(c.code, lang)}</code></pre></div>`;
  }
  function render(src) {
    if (!src) return '';
    const codes = [];
    let text = src.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (m, info, code) => {
      codes.push({ lang: info.trim().split(/\s+/)[0], code: code.replace(/\n$/, '') });
      return '\u0001' + (codes.length - 1) + '\u0001';
    });
    text = text.replace(/```([^\n`]*)\n([\s\S]*)$/, (m, info, code) => {
      codes.push({ lang: info.trim().split(/\s+/)[0], code });
      return '\u0001' + (codes.length - 1) + '\u0001';
    });
    const lines = text.split('\n');
    let html = '', i = 0, p = [];
    const flushP = () => { if (p.length) html += '<p>' + p.map(inline).join('<br>') + '</p>'; p = []; };
    while (i < lines.length) {
      const line = lines[i];
      let m = line.match(/^\u0001(\d+)\u0001\s*$/);
      if (m) { flushP(); html += codeHtml(codes[+m[1]]); i++; continue; }
      m = line.match(/^(#{1,6})\s+(.*)/);
      if (m) { flushP(); const l = m[1].length; html += `<h${l}>` + inline(m[2]) + `</h${l}>`; i++; continue; }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flushP(); html += '<hr>'; i++; continue; }
      if (/^>\s?/.test(line)) {
        flushP(); const q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
        html += '<blockquote>' + q.map(inline).join('<br>') + '</blockquote>'; continue;
      }
      if (/^\s*[-*]\s+/.test(line)) {
        flushP(); const items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++; }
        html += '<ul>' + items.map(x => '<li>' + inline(x) + '</li>').join('') + '</ul>'; continue;
      }
      if (/^\s*\d+[.)]\s+/.test(line)) {
        flushP(); const items = [];
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++; }
        html += '<ol>' + items.map(x => '<li>' + inline(x) + '</li>').join('') + '</ol>'; continue;
      }
      if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && lines[i + 1].includes('-') && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
        flushP();
        const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const head = cells(line); i += 2; const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
        html += '<div class="md-table-wrap"><table><thead><tr>' + head.map(c => '<th>' + inline(c) + '</th>').join('') +
          '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') +
          '</tbody></table></div>'; continue;
      }
      if (!line.trim()) { flushP(); i++; continue; }
      p.push(line); i++;
    }
    flushP();
    return html.replace(/\u0001\d+\u0001/g, '');
  }
  function plain2(src) { return esc(src).replace(/\n/g, '<br>'); }
  return { render, plain: plain2 };
})();