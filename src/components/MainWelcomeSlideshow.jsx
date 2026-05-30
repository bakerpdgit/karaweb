import React, { useState } from 'react';

/**
 * First-visit welcome slideshow for everyone landing on the main site.
 *
 * Four short colourful slides covering what KaraWeb is, the three
 * programming modes, the world editor, and challenges. The "don't
 * show again" tick-box defaults to TICKED — most visitors only ever
 * need to see this once.
 *
 * onClose(dontShowAgain) is invoked when the user dismisses the
 * slideshow (close button, Got it on the last slide, or click-out).
 */
export default function MainWelcomeSlideshow({ onClose, onOpenTutorial }) {
  const [i, setI] = useState(0);
  const [dontShow, setDontShow] = useState(true);   // default ticked
  const slide = SLIDES[i];
  const isFirst = i === 0;
  const isLast  = i === SLIDES.length - 1;

  const close = () => onClose?.(dontShow);

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal welcome-modal" onClick={e => e.stopPropagation()}>
        <header className="welcome-header">
          <div className="welcome-dots" role="tablist" aria-label="Welcome slides">
            {SLIDES.map((s, k) => (
              <button
                key={k}
                role="tab"
                aria-selected={k === i}
                aria-label={`Slide ${k + 1}: ${s.title}`}
                className={`welcome-dot ${k === i ? 'active' : ''} ${k < i ? 'past' : ''}`}
                onClick={() => setI(k)}
              />
            ))}
          </div>
          <button className="welcome-close" onClick={close} title="Close" aria-label="Close">✕</button>
        </header>

        <div className={`welcome-slide welcome-slide-${slide.theme}`}>
          <div className="welcome-icon">{slide.icon}</div>
          <h2 className="welcome-title">{slide.title}</h2>
          {slide.tagline && <p className="welcome-tagline">{slide.tagline}</p>}
          <div className="welcome-body">
            {slide.body}
          </div>
        </div>

        <footer className="welcome-footer">
          <label className="welcome-dontshow" title="When ticked, this slideshow won't pop again on this device. Re-enable from Settings.">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={e => setDontShow(e.target.checked)}
            />
            Don't show this again on this device
          </label>
          <div className="welcome-nav">
            <button
              className="btn-secondary"
              disabled={isFirst}
              onClick={() => setI(n => Math.max(0, n - 1))}
            >← Previous</button>
            {isLast ? (
              <button className="btn-primary" onClick={close}>Got it ✓</button>
            ) : (
              <button className="btn-primary" onClick={() => setI(n => Math.min(SLIDES.length - 1, n + 1))}>Next →</button>
            )}
          </div>
        </footer>
        {isLast && onOpenTutorial && (
          <div className="welcome-teacher-note">
            👩‍🏫 Teacher? Read the{' '}
            <button type="button" className="cs-link" onClick={onOpenTutorial}>
              Teacher tutorial
            </button>{' '}
            for a full walkthrough.
          </div>
        )}
      </div>
    </div>
  );
}

const SLIDES = [
  {
    theme: 'welcome',
    icon: '🐞',
    title: 'Meet Kara the Ladybug',
    tagline: 'Program a friendly ladybug to crawl around a grid world, picking up leaves and dodging trees.',
    body: (
      <ul className="welcome-bullets">
        <li>🌳 Trees block her path · 🍃 leaves can be picked up or dropped · 🍄 mushrooms can be pushed around.</li>
        <li>🎮 Move her with code — turn, step, sense what's in front, repeat.</li>
        <li>🆓 No accounts, no installs — everything runs in your browser.</li>
      </ul>
    ),
  },
  {
    theme: 'ways',
    icon: '🧩',
    title: 'Three ways to write the program',
    tagline: 'Pick whichever fits where you are on your coding journey.',
    body: (
      <ol className="welcome-bullets welcome-numbered">
        <li><strong>🟦 FSM</strong> — a visual finite-state machine; draw bubbles for states and arrows for transitions.</li>
        <li><strong>🧱 Blocks</strong> — drag &amp; drop Blockly snippets, just like Scratch.</li>
        <li><strong>🐍 Python</strong> — write real Python in a Monaco editor; the same one VS Code uses.</li>
      </ol>
    ),
  },
  {
    theme: 'build',
    icon: '🎨',
    title: 'Build your own worlds',
    tagline: 'Paint a grid, drop in Kara, add obstacles — then run your program against it.',
    body: (
      <ul className="welcome-bullets">
        <li>🖌️ Click cells to add or remove trees, leaves and mushrooms.</li>
        <li>↩️ Rotate Kara, change her starting square — anything goes.</li>
        <li>💾 Save your world + program to a <code>.json</code> file to share or come back to later.</li>
      </ul>
    ),
  },
  {
    theme: 'cloud',
    icon: '🎯',
    title: 'Try a challenge book',
    tagline: 'Teachers can build challenge books — each challenge defines a starting world and a target.',
    body: (
      <ul className="welcome-bullets">
        <li>📚 Your teacher may send you a link or file — when you open it the first challenge starts automatically.</li>
        <li>✅ Your job: write a program that turns the starting world into the target world.</li>
        <li>👀 Stuck? Some challenges include a peekable reference solution to help you out.</li>
      </ul>
    ),
  },
];
