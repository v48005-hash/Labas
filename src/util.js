'use strict';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Very small, safe "markdown-lite" renderer for instruction text.
// Supports: ## headings, - bullet lists, blank-line paragraphs, **bold**.
function renderText(input) {
  const text = escapeHtml(input || '').replace(/\r\n/g, '\n');
  const blocks = text.split(/\n{2,}/);
  const html = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      const items = lines.map((l) => '<li>' + inline(l.replace(/^\s*[-*]\s+/, '')) + '</li>').join('');
      html.push('<ul>' + items + '</ul>');
    } else if (/^\s*#{1,3}\s+/.test(lines[0]) && lines.length === 1) {
      const level = (lines[0].match(/^#+/) || ['#'])[0].length;
      const tag = 'h' + Math.min(level + 1, 4);
      html.push('<' + tag + '>' + inline(lines[0].replace(/^\s*#{1,3}\s+/, '')) + '</' + tag + '>');
    } else {
      html.push('<p>' + lines.map(inline).join('<br>') + '</p>');
    }
  }
  return html.join('\n');
}

function inline(s) {
  return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('lt-LT', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

module.exports = { escapeHtml, renderText, formatDate };
