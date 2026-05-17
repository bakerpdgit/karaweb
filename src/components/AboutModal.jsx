import React from 'react';

export default function AboutModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal about-modal" onClick={e => e.stopPropagation()}>
        <div className="about-header">
          <span className="about-logo">🐞</span>
          <div>
            <h2 className="about-title">KaraWeb</h2>
            <p className="about-subtitle">
              An independent web-based re-implementation of the{' '}
              <a href="https://www.swisseduc.ch/informatik/karatojava/" target="_blank" rel="noreferrer">
                classic computer science tool
              </a>.
            </p>
          </div>
        </div>

        <hr className="about-divider" />

        <section className="about-section">
          <h3>About this Project</h3>
          <p>
            This tool is an independent, open-source web implementation of the classic
            "Kara the programmable ladybird" microworld, built using modern web technologies
            to make it accessible in modern browser-based classrooms.
          </p>
          <p>
            It is deeply inspired by the original Kara environments conceived and developed
            by <strong>Raimond Reichert</strong>, <strong>Jürg Nievergelt</strong>, and{' '}
            <strong>Werner Hartmann</strong> at ETH Zürich /{' '}
            <a href="https://www.swisseduc.ch/informatik/karatojava/" target="_blank" rel="noreferrer">
              SwissEduc
            </a>.
            This project is not officially affiliated with, sponsored by, or endorsed by
            the original creators or SwissEduc.
          </p>
        </section>

        <hr className="about-divider" />

        <section className="about-section">
          <h3>Licence</h3>
          <div className="licence-badge">
            <a
              href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
              target="_blank"
              rel="noreferrer"
              className="licence-link"
            >
              CC BY-NC-SA 4.0
            </a>
            <span className="licence-name">
              Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
            </span>
          </div>
          <p>
            KaraWeb is free to use, share, and adapt for non-commercial purposes, provided
            appropriate credit is given and any derivative works are distributed under the
            same licence. Copyright © 2026 Paul Baker.
          </p>
          <p>
            The original Kara concept and materials are the intellectual property of their
            respective creators and are subject to{' '}
            <a href="https://www.swisseduc.ch/about/copyright/" target="_blank" rel="noreferrer">
              SwissEduc's own terms
            </a>.
          </p>
        </section>

        <div className="modal-actions">
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
