import React, { useMemo } from 'react';
import { marked } from 'marked';

/**
 * Render a markdown string as HTML, using the `marked` library (also
 * used by the Teacher Tutorial modal). Pure: no state, no editing.
 *
 * Content here is **author-controlled** in every caller — challenge
 * notes are authored by the teacher who built the book — so we do not
 * sanitise. If a future caller ever renders untrusted markdown,
 * sanitise via DOMPurify before passing it in.
 */
export default function MarkdownView({ markdown }) {
  const html = useMemo(() => marked.parse(String(markdown ?? '')), [markdown]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
