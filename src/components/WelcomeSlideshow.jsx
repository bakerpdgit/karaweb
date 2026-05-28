import React, { useState } from 'react';

/**
 * First-run welcome slideshow shown when a teacher enters the
 * Challenge Editor for the first time. Five short illustrated slides
 * covering the high-level shape of the app:
 *   1. Welcome / what it is
 *   2. Authoring challenges
 *   3. Sharing them with students
 *   4. Optional cloud-save of results
 *   5. Privacy & key safety
 *
 * Layout: progress dots + close (×) on top, big emoji + title +
 * body in the middle, prev/next + "don't show again" at the bottom.
 *
 * onClose(dontShowAgain) is invoked when the teacher dismisses the
 * slideshow (close button, Got it on the last slide, or click-out).
 */
export default function WelcomeSlideshow({ onClose }) {
  const [i, setI] = useState(0);
  const [dontShow, setDontShow] = useState(false);
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
          <label className="welcome-dontshow" title="When ticked, this slideshow won't pop again on this device. You can re-enable it from Settings.">
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
      </div>
    </div>
  );
}

// Slide data — keep copy short and visual. Each slide has its own
// theme colour for the icon panel so they feel distinct.
const SLIDES = [
  {
    theme: 'welcome',
    icon: '🐞',
    title: 'Welcome to the Challenge Editor',
    tagline: 'Build, share and (optionally) track programming challenges around Kara the Ladybug.',
    body: (
      <ul className="welcome-bullets">
        <li>🎯 Author your own start-to-target challenges.</li>
        <li>📚 Save a whole book to JSON, drop it on GitHub, share a single link.</li>
        <li>☁️ Track student results in <em>your own</em> Google Drive — no third-party server, no student logins.</li>
      </ul>
    ),
  },
  {
    theme: 'ways',
    icon: '🗺️',
    title: 'Four ways to use KaraWeb',
    tagline: 'Pick the path that suits your class — each one builds on the previous.',
    body: (
      <ol className="welcome-bullets welcome-numbered">
        <li><strong>🆓 Free experimentation.</strong> Students just open the URL and build their own worlds + programs. No accounts, no setup.</li>
        <li><strong>📦 Build a challenge book.</strong> Author challenges in this editor, save the book as a <code>.json</code> file, share it any way you like (USB, email, LMS upload).</li>
        <li><strong>🔗 Direct GitHub link.</strong> Drop the file on a public GitHub repo; KaraWeb generates a <code>?challenges=…</code> URL students open to load the book + start the first challenge automatically.</li>
        <li><strong>☁️ Cloud-save tracking.</strong> Add cloud save to your book so student results land in <em>your</em> Google Drive (or Codehooks). No personal data stored — only anonymous 6-digit codes.</li>
      </ol>
    ),
  },
  {
    theme: 'build',
    icon: '🎯',
    title: 'Build a challenge',
    tagline: 'Paint an initial world; paint a target world; the student writes the program that bridges them.',
    body: (
      <>
        <ul className="welcome-bullets">
          <li>🟦 <strong>Initial</strong> → 🟧 <strong>Target</strong> are the two checkpoints every challenge has.</li>
          <li>➕ Add intermediate checkpoints if the program must pass through specific in-between world states.</li>
          <li>🧩 Pick a mode — <strong>FSM</strong>, <strong>Blocks</strong> or <strong>Python</strong> — and lock the student to it, or let them switch.</li>
          <li>✍️ Per-challenge notes in Markdown; an optional reference solution students can peek at.</li>
        </ul>
      </>
    ),
  },
  {
    theme: 'share',
    icon: '📤',
    title: 'Share with students',
    tagline: 'No accounts, no installs — one link.',
    body: (
      <ul className="welcome-bullets">
        <li>💾 <strong>Save</strong> exports the whole book as a <code>.json</code> file.</li>
        <li>🐙 Drop the file on a public GitHub repo (or any raw-URL host).</li>
        <li>🔗 KaraWeb generates a <code>?challenges=…</code> deep link — students open it and the book auto-loads.</li>
      </ul>
    ),
  },
  {
    theme: 'cloud',
    icon: '☁️',
    title: 'Optional: track results',
    tagline: 'Your data, your drive — no karaweb server, no third-party database.',
    body: (
      <ul className="welcome-bullets">
        <li>📂 Pick <strong>Google Drive</strong> (recommended) or <strong>Codehooks</strong> as the backend.</li>
        <li>🛠️ A short setup wizard pastes a one-time script into <em>your</em> account; everything stored lands in <em>your</em> Drive.</li>
        <li>👀 <strong>Analyse</strong> tab pulls results back into the browser so you can see who's passed what.</li>
        <li>🙅 No student accounts. Each student just types their school username + a 6-digit code.</li>
      </ul>
    ),
  },
  {
    theme: 'privacy',
    icon: '🔒',
    title: 'Privacy and your keydetails',
    tagline: 'Anonymised on the wire; encrypted at rest; only you hold the key.',
    body: (
      <ul className="welcome-bullets">
        <li>🆔 Student usernames are <strong>hashed locally</strong> to a 6-digit code. The cloud never sees the username.</li>
        <li>🛡️ Solutions are <strong>encrypted with your public key</strong> before they leave the browser. Only your <code>keydetails.txt</code> can decrypt them.</li>
        <li>✂️ Python <strong>comments and multi-line strings are stripped</strong> on the way out — a final defence against students leaving personal info in code.</li>
        <li>⚠️ Treat your <code>keydetails.txt</code> like a password — anyone with it can read every submission. <strong>Don't share it with students.</strong></li>
      </ul>
    ),
  },
];
