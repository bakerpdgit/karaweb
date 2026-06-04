import React, { useState } from 'react';

/**
 * Single-slide welcome that pops the first time a teacher opens the
 * Teacher Keys tab. Walks them through the 4-step end-to-end flow so
 * they understand where the keydetails file fits before they start
 * clicking buttons. Dismissed permanently via the "don't show again"
 * tickbox; reset from Settings.
 */
export default function TeacherKeysWelcomeSlideshow({ onClose }) {
  const [dontShow, setDontShow] = useState(false);
  const close = () => onClose?.(dontShow);

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal welcome-modal" onClick={e => e.stopPropagation()}>
        <header className="welcome-header">
          <div className="welcome-dots" aria-hidden="true">
            <span className="welcome-dot active" />
          </div>
          <button className="welcome-close" onClick={close} title="Close" aria-label="Close">✕</button>
        </header>

        <div className="welcome-slide welcome-slide-cloud">
          <div className="welcome-icon">🔑</div>
          <h2 className="welcome-title">Collecting student submissions</h2>
          <p className="welcome-tagline">
            Four short steps from setting up your keys to seeing pass / fail results.
          </p>

          <ol className="tk-welcome-steps">
            <li>
              <div className="tk-step-icon">🔑</div>
              <div className="tk-step-text">
                <strong>Generate or load a keydetails file.</strong>
                <span> One file per teacher (or per school). It's what encrypts and decrypts every submission.</span>
              </div>
            </li>
            <li>
              <div className="tk-step-icon">☁️</div>
              <div className="tk-step-text">
                <strong>Set up your cloud data store.</strong>
                <span> The Cloud Save tab walks you through creating a class list of usernames & user numbers and pasting a one-time script into your own Google Drive or Codehooks account.</span>
              </div>
            </li>
            <li>
              <div className="tk-step-icon">📤</div>
              <div className="tk-step-text">
                <strong>Save and share your challenge book.</strong>
                <span> The data-store URL is baked into the book file — students just open the challenge book file or link and login. Cloud submissions will occur automatically but only user numbers not usernames are saved in your data store.</span>
              </div>
            </li>
            <li>
              <div className="tk-step-icon">📊</div>
              <div className="tk-step-text">
                <strong>Open the Submissions tab.</strong>
                <span> Pulls results back, decrypts them locally, and shows you who's passed what.</span>
              </div>
            </li>
          </ol>
        </div>

        <footer className="welcome-footer">
          <label className="welcome-dontshow" title="When ticked, this won't pop again on this device. You can re-enable it from Settings.">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={e => setDontShow(e.target.checked)}
            />
            Don't show this again on this device
          </label>
          <div className="welcome-nav">
            <button className="btn-primary" onClick={close}>Got it ✓</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
