import React, { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { TUTORIAL_CHAPTERS, DEFAULT_TUTORIAL_SLUG, getTutorialChapter } from '../tutorial/index.js';

/**
 * In-app mini documentation book for teachers. Sidebar with chapter
 * list on the left; markdown-rendered content on the right.
 *
 * Chapter content is bundled at build time (via Vite's `?raw`) so the
 * modal opens instantly. Chapter-to-chapter cross-reference links use
 * the markdown syntax `[label](?tutorial=<slug>)` and are intercepted
 * here so they navigate within the modal rather than reloading.
 *
 * Open via the header button OR by booting the app with
 * `?tutorial=<slug>` in the URL.
 */
export default function TutorialModal({ initialSlug = DEFAULT_TUTORIAL_SLUG, onClose }) {
  const [slug, setSlug] = useState(initialSlug);
  const contentRef = useRef(null);

  const chapter = getTutorialChapter(slug);
  const html = useMemo(() => marked.parse(chapter.body), [chapter.body]);

  // Scroll the content pane back to top whenever the chapter changes.
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [slug]);

  // Esc closes the modal.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Intercept clicks on `[…](?tutorial=<slug>)` links so they switch
  // chapter in-place rather than triggering a page reload.
  const onContentClick = (e) => {
    const a = e.target.closest('a[href*="tutorial="]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    const match = href.match(/[?&]tutorial=([\w-]+)/);
    if (!match) return;
    const next = match[1];
    if (TUTORIAL_CHAPTERS.some(c => c.slug === next)) {
      e.preventDefault();
      setSlug(next);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal tutorial-modal" onClick={e => e.stopPropagation()}>
        <button
          className="tutorial-close"
          onClick={onClose}
          title="Close (Esc)"
          aria-label="Close tutorial"
        >✕</button>
        <aside className="tutorial-nav">
          <h3 className="tutorial-nav-title">📖 Teacher tutorial</h3>
          <ol className="tutorial-chapter-list">
            {TUTORIAL_CHAPTERS.map(c => (
              <li key={c.slug}>
                <button
                  type="button"
                  className={`tutorial-chapter-link ${c.slug === slug ? 'active' : ''}`}
                  onClick={() => setSlug(c.slug)}
                >{c.title}</button>
              </li>
            ))}
          </ol>
        </aside>
        <article className="tutorial-content" ref={contentRef} onClick={onContentClick}>
          <div className="notes-body" dangerouslySetInnerHTML={{ __html: html }} />
        </article>
      </div>
    </div>
  );
}
