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
            Teachers retain their own submission data on their own cloud
            data store (Google Drive or Codehooks.io) so they can delete
            or reset submission data at any time. Using the submissions
            panel wizard, teachers create a URL endpoint for their data
            store and this is held within each challenge book that is
            cloud-save enabled.
          </p>
          <p>
            Students are given 6-digit user numbers by the teacher and
            only these user numbers along with their submissions are
            stored on the teacher's data store with the submissions
            encrypted with the teacher's keydetails for additional
            security. No student usernames are stored on the teacher's
            cloud data store.
          </p>

          <h4 className="about-cloud-subhead">The moving parts</h4>
          <ul className="about-cloud-list">
            <li>
              <strong>🔑 Keydetails file</strong> — a one-per-teacher (or
              per-school) file containing a public + private key pair.
              The public key encrypts every submission as it leaves the
              student's browser; the private key — which only the teacher
              has — is the only way to read them back. Optionally
              password-protected; the password isn't recoverable.
            </li>
            <li>
              <strong>🗄️ Your data store</strong> — either a Google Apps
              Script hooked into your Google Drive, or a free serverless
              project on Codehooks.io. Either way it lives entirely
              under your account; KaraWeb itself never sees the data.
            </li>
            <li>
              <strong>🔗 URL endpoint</strong> — the wizard produces a
              single URL pointing at your data store. That URL is baked
              into each challenge book you save; students load the book
              and their submissions flow straight to your store.
            </li>
            <li>
              <strong>🔢 6-digit user numbers</strong> — generated
              locally from each student's username + your public key,
              so two teachers will never collide. The number itself is
              <strong>encrypted with your public key before it leaves
              the browser</strong>, so the backend only ever sees a
              short pseudonymous hash + the encrypted form. Usernames
              are never sent at all. When you open the Submissions
              tab, the original 6-digit numbers are recovered locally
              by decrypting with your private key.
            </li>
            <li>
              <strong>📊 Submissions panel</strong> — pulls the
              encrypted submissions back, decrypts them locally with
              your private key, and shows you the pass/fail grid.
              Apply a class list (kept locally on your device) to
              translate user numbers back into usernames for display.
            </li>
          </ul>

          <h4 className="about-cloud-subhead">Data retention</h4>
          <p>
            🗑️ By default, both backends auto-delete submission rows
            older than <strong>3 years</strong> the next time you open
            the Submissions tab — this protects historical data if
            your keydetails file is ever lost. Teachers comfortable
            with their script can change the number of days or
            disable auto-deletion by editing a clearly-marked
            constant near the top of their backend script
            (<code>RESULT_RETENTION_DAYS</code> for Codehooks,
            <code>ROW_RETENTION_DAYS</code> for the Google Apps
            Script). The value in the deployed script is the
            authoritative one; existing deployments keep their
            previous setting until the teacher re-pastes the latest
            script.
          </p>
        </div>

        <div className="modal-actions">
          <button className="btn-primary" onClick={onClose} autoFocus>Got it</button>
        </div>
      </div>
    </div>
  );
}
