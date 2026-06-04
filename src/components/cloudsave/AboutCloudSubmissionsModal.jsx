import React from 'react';

/**
 * Friendly "how cloud submissions work" explainer modal, linked from
 * both the Teacher Keys and Cloud Save security callouts. Deliberately
 * non-technical — covers the moving parts (keydetails, data store,
 * 6-digit user numbers) without diving into RSA / fingerprints.
 */
export default function AboutCloudSubmissionsModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal about-cloud-modal" onClick={e => e.stopPropagation()}>
        <header className="about-cloud-header">
          <div className="about-cloud-icon" aria-hidden="true">☁️🔐</div>
          <h2 className="about-cloud-title">How cloud submissions work</h2>
        </header>

        <div className="about-cloud-body">
          <p>
            Submissions live on <strong>your</strong> cloud data store —
            Google Drive or Codehooks — never on a KaraWeb server. You
            can delete or reset that data whenever you like.
          </p>
          <p>
            Students are identified only by a <strong>6-digit user number</strong>.
            Their solutions are encrypted in the browser before being
            sent, so the data store only ever holds anonymous numbers
            and encrypted code.
          </p>

          <h4 className="about-cloud-subhead">The moving parts</h4>
          <ul className="about-cloud-list">
            <li>
              <strong>🔑 Keydetails file</strong> — one per teacher (or
              school). Encrypts what students send; only this file can
              decrypt it back. Optionally password-protected.
            </li>
            <li>
              <strong>🗄️ Your data store</strong> — Google Drive or
              Codehooks, set up by a short wizard. Lives entirely in
              your own account.
            </li>
            <li>
              <strong>🔗 Challenge book link</strong> — the wizard bakes
              your data-store URL into each book. Students open the
              link and submissions flow straight to your store.
            </li>
            <li>
              <strong>📊 Submissions tab</strong> — pulls the encrypted
              submissions back and decrypts them locally with your
              keydetails. Apply a class list (kept only on your device)
              to see real usernames instead of 6-digit numbers.
            </li>
          </ul>

          <h4 className="about-cloud-subhead">Data retention</h4>
          <p>
            🗑️ By default, both backends auto-delete submissions older
            than <strong>3 years</strong>. You can change or disable
            this in your backend script if you prefer.
          </p>
        </div>

        <div className="modal-actions">
          <button className="btn-primary" onClick={onClose} autoFocus>Got it</button>
        </div>
      </div>
    </div>
  );
}
