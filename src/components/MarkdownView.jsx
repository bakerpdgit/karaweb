import React from 'react';

function parseInline(text) {
  const parts = [];
  const regex = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      parts.push(<strong key={m.index}>{m[1]}</strong>);
    } else {
      parts.push(<em key={m.index}>{m[2]}</em>);
    }
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function MarkdownView({ markdown }) {
  const blocks = markdown.split(/\n\n+/);

  return (
    <div>
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        if (trimmed === '---') return <hr key={i} />;

        const hMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
        if (hMatch) {
          const level = hMatch[1].length;
          const Tag = `h${level}`;
          return <Tag key={i}>{parseInline(hMatch[2])}</Tag>;
        }

        const lines = trimmed.split('\n');
        if (lines.every(l => l.trimStart().startsWith('- '))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{parseInline(l.trimStart().slice(2))}</li>
              ))}
            </ul>
          );
        }

        return <p key={i}>{parseInline(trimmed)}</p>;
      })}
    </div>
  );
}
