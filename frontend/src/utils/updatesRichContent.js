/** Parse changelog / system-update markdown into renderable blocks. */

function inlineFormat(str) {
  const parts = [];
  let idx = 0;
  const boldRe = /\*\*(.+?)\*\*/g;
  let match;
  let lastIdx = 0;
  while ((match = boldRe.exec(str)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ text: str.slice(lastIdx, match.index), bold: false, key: idx++ });
    }
    parts.push({ text: match[1], bold: true, key: idx++ });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < str.length) {
    parts.push({ text: str.slice(lastIdx), bold: false, key: idx++ });
  }
  return parts.length > 0 ? parts : [{ text: str, bold: false, key: 0 }];
}

export function parseRichContent(text) {
  if (!text) return [];
  const lines = String(text).split('\n');
  const elements = [];
  let listItems = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push({ type: 'list', items: [...listItems], key: `list-${elements.length}` });
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push({ type: 'h2', text: trimmed.slice(3), key: `h2-${i}` });
    } else if (trimmed.startsWith('### ')) {
      flushList();
      elements.push({ type: 'h3', text: trimmed.slice(4), key: `h3-${i}` });
    } else if (trimmed.startsWith('---')) {
      flushList();
      elements.push({ type: 'hr', key: `hr-${i}` });
    } else if (/^[-•●]\s/.test(trimmed)) {
      const indent = line.length - trimmed.length;
      listItems.push({
        text: trimmed.slice(2),
        indent: Math.floor(indent / 2),
        key: `li-${i}`,
        parts: inlineFormat(trimmed.slice(2)),
      });
    } else if (/^\d+\.\s/.test(trimmed)) {
      const indent = line.length - trimmed.length;
      const num = trimmed.match(/^(\d+)\./)[1];
      listItems.push({
        text: trimmed.replace(/^\d+\.\s/, ''),
        indent: Math.floor(indent / 2),
        num,
        key: `oli-${i}`,
        parts: inlineFormat(trimmed.replace(/^\d+\.\s/, '')),
      });
    } else if (trimmed.startsWith('> ')) {
      flushList();
      elements.push({
        type: 'callout',
        text: trimmed.slice(2),
        key: `call-${i}`,
        parts: inlineFormat(trimmed.slice(2)),
      });
    } else if (trimmed === '') {
      flushList();
      elements.push({ type: 'spacer', key: `sp-${i}` });
    } else {
      flushList();
      elements.push({
        type: 'p',
        text: trimmed,
        key: `p-${i}`,
        parts: inlineFormat(trimmed),
      });
    }
  }
  flushList();
  return elements;
}
