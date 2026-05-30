import React, { useState, useEffect, useMemo, useRef } from 'react';
import { generateAppsScript } from '../../utils/googleDrive/appsScriptGenerator.js';
import { pingAppsScript } from '../../utils/googleDrive/googleDriveClient.js';
import { copyToClipboard } from '../../utils/copyToClipboard.js';

/**
 * Google Drive setup panel — per-teacher Apps Script.
 *
 * Generates one script per teacher (no class data baked in). The
 * teacher pastes it into a fresh Apps Script project once, deploys it
 * as a Web App, and reuses the same URL across every class and every
 * challenge book.
 */
export default function GoogleDriveSetupPanel({ cloudSave, keydetails, dispatch, onConnectionVerified }) {
  const ready = !!(keydetails?.publicKeyJwk && keydetails?.privateKeyJwk);
  const devMode = import.meta.env.VITE_SKIP_TURNSTILE === 'true';
  const proxyUrl = import.meta.env.VITE_TURNSTILE_PROXY_URL
    || 'https://karaweb.classinteractives.co.uk/api/verify-turnstile';

  const [scriptSource, setScriptSource] = useState('');
  const [devScriptSource, setDevScriptSource] = useState('');
  const [generating, setGenerating]     = useState(false);
  const [copied, setCopied]             = useState(false);
  const [devCopied, setDevCopied]       = useState(false);
  const [busyTest, setBusyTest]         = useState(false);
  const [localStatus, setLocalStatus]   = useState(null);

  // Regenerate the script whenever the keypair (or env settings) change.
  useEffect(() => {
    let cancelled = false;
    if (!ready) {
      setScriptSource('');
      setDevScriptSource('');
      return;
    }
    setGenerating(true);
    (async () => {
      try {
        const prod = await generateAppsScript({
          publicKeyJwk:  keydetails.publicKeyJwk,
          privateKeyJwk: keydetails.privateKeyJwk,
          submissionVerifier: keydetails.submissionVerifier,
          verifyProxyUrl: proxyUrl,
          turnstileRequired: true,
        });
        if (!cancelled) setScriptSource(prod);
        if (devMode) {
          const dev = await generateAppsScript({
            publicKeyJwk:  keydetails.publicKeyJwk,
            privateKeyJwk: keydetails.privateKeyJwk,
            submissionVerifier: keydetails.submissionVerifier,
            verifyProxyUrl: proxyUrl,
            turnstileRequired: false,
          });
          if (!cancelled) setDevScriptSource(dev);
        }
      } catch (err) {
        if (!cancelled) {
          setLocalStatus({ kind: 'error', message: 'Script generation failed: ' + (err?.message ?? err) });
        }
      } finally {
        if (!cancelled) setGenerating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ready, keydetails?.publicKeyJwk?.n, devMode, proxyUrl]);

  const copyProd = async () => {
    const ok = await copyToClipboard(scriptSource);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500); }
  };
  const copyDev = async () => {
    const ok = await copyToClipboard(devScriptSource);
    if (ok) { setDevCopied(true); setTimeout(() => setDevCopied(false), 1500); }
  };

  const doTestConnection = async () => {
    if (!cloudSave.apiBaseUrl) return;
    setBusyTest(true);
    setLocalStatus({ kind: '', message: 'Pinging Apps Script…' });
    try {
      const pong = await pingAppsScript(cloudSave.apiBaseUrl);
      if (pong?.status !== 'ok') {
        setLocalStatus({ kind: 'error', message: 'Unexpected ping response: ' + JSON.stringify(pong) });
        return;
      }
      dispatch({ type: 'CS_SET_REGISTERED', registered: true });
      setLocalStatus({ kind: 'ok', message: '🟢 Backend reachable. Cloud-save mode is now available in the Save dialog.' });
      onConnectionVerified?.();
    } catch (err) {
      setLocalStatus({ kind: 'error', message: 'Connection failed: ' + (err?.message ?? err) });
    } finally {
      setBusyTest(false);
    }
  };

  return (
    <div className="gd-panel">
      <section className="cs-section">
        <h3 className="cl-section-title">Step 1 — Copy the Apps Script</h3>
        <p className="cs-help">
          One script per teacher. No class data inside — add students any time.
        </p>
        {!ready && (
          <p className="cl-hint">
            Generate or load your keydetails (Class List tab → "Teacher keys") first.
          </p>
        )}
        {ready && (
          <>
            <div className="wiz-copy-row">
              <button
                className="btn-primary wiz-copy-btn"
                disabled={generating}
                onClick={copyProd}
              >{generating ? 'Generating…' : (copied ? '✓ Copied!' : `Copy script (${Math.round(scriptSource.length / 1024)} KB)`)}</button>
              {devMode && (
                <button
                  className="btn-secondary wiz-copy-btn"
                  disabled={generating}
                  onClick={copyDev}
                  title="Dev only: TURNSTILE_REQUIRED=false. For testing on localhost."
                >{devCopied ? '✓ Copied!' : 'Copy dev script (no Turnstile)'}</button>
              )}
            </div>
            <details className="wiz-codepreview">
              <summary>Preview the script that will be copied</summary>
              <textarea
                className="wiz-code-textarea"
                readOnly
                rows={16}
                value={scriptSource}
              />
            </details>
          </>
        )}
      </section>

      <section className="cs-section">
        <h3 className="cl-section-title">Step 2 — Deploy to Google Apps Script</h3>
        <ol className="cs-deploy-list">
          <li>Open <a href="https://script.google.com" target="_blank" rel="noreferrer">script.google.com</a> and click <strong>New project</strong>.</li>
          <li>Name the project <code>karaweb-yourname</code>.</li>
          <li>Select all of the default <code>Code.gs</code> content (<kbd>Ctrl</kbd>+<kbd>A</kbd>) and delete it. Paste the copied script (<kbd>Ctrl</kbd>+<kbd>V</kbd>) and save.</li>
          <li><strong>Deploy → New deployment</strong>. Type: <strong>Web app</strong>. <strong>Execute as: Me</strong>. <strong>Who has access: Anyone</strong>.</li>
          <li>First-time only: Google shows an "Unverified app" warning. Click <em>Advanced → Go to {`{project name}`} (unsafe) → Allow</em>.</li>
          <li>Copy the <strong>Web app URL</strong> Google shows you. Paste it below.</li>
          <li>To <strong>update</strong> the script later (e.g. after rotating keys): <em>Deploy → Manage deployments → pencil → Version: New version → Deploy</em>. Same URL.</li>
        </ol>
        <details className="cs-details">
          <summary>Why does the script need access to my Drive files?</summary>
          <p>Script creates one Drive folder + one sheet per book. Use a dedicated Google account if you'd prefer isolation.</p>
        </details>
      </section>

      <section className="cs-section">
        <h3 className="cl-section-title">Step 3 — Paste the Web App URL</h3>
        <div className="cl-row">
          <label>Web app URL</label>
          <input
            value={cloudSave.apiBaseUrl}
            onChange={e => dispatch({ type: 'CS_SET_FIELD', field: 'apiBaseUrl', value: e.target.value })}
            placeholder="https://script.google.com/macros/s/AKfycb.../exec"
            style={{ width: 460 }}
          />
        </div>
        <div className="cl-row">
          <button
            className="btn-primary"
            disabled={!cloudSave.apiBaseUrl || busyTest}
            onClick={doTestConnection}
          >{busyTest ? 'Testing…' : 'Test connection'}</button>
          {cloudSave.registered && (
            <span className="cl-ok">✓ Saved.</span>
          )}
        </div>
      </section>

      {localStatus?.message && (
        <div className={`cl-status cl-status-${localStatus.kind || ''}`}>{localStatus.message}</div>
      )}
    </div>
  );
}
