import React, { useState, useEffect } from 'react';
import { generateAppsScript } from '../../utils/googleDrive/appsScriptGenerator.js';
import { pingAppsScript } from '../../utils/googleDrive/googleDriveClient.js';
import { copyToClipboard } from '../../utils/copyToClipboard.js';

const STEPS = [
  { id: 1, label: 'Copy script' },
  { id: 2, label: 'Deploy' },
  { id: 3, label: 'Connect' },
];

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
  const [step, setStep] = useState(() => {
    if (cloudSave.registered || cloudSave.apiBaseUrl) return 3;
    return 1;
  });

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
    <div className="wiz gd-panel">
      <ProgressBar step={step} />

      {step === 1 && (
        <StepCard
          title="1. Copy the Apps Script"
          onNext={() => setStep(2)}
          nextLabel="I've copied the script"
          nextDisabled={!ready || generating}
        >
          <p>
            One script per teacher. No class data inside — add students any time.
          </p>
          <p className="wiz-help">
            After copying the script, click <strong>I've copied the script</strong> to continue to the deployment step.
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
        </StepCard>
      )}

      {step === 2 && (
        <StepCard
          title="2. Deploy to Google Apps Script"
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          nextLabel="I've deployed it"
        >
          <ol className="cs-deploy-list">
            <li>Open <a href="https://script.google.com" target="_blank" rel="noreferrer">script.google.com</a> and click <strong>New project</strong>.</li>
            <li>Name the project <code>karaweb-yourname</code>.</li>
            <li>Select all of the default <code>Code.gs</code> content (<kbd>Ctrl</kbd>+<kbd>A</kbd>) and delete it. Paste the copied script (<kbd>Ctrl</kbd>+<kbd>V</kbd>) and save.</li>
            <li><strong>Deploy → New deployment</strong>. Type: <strong>Web app</strong>. <strong>Execute as: Me</strong>. <strong>Who has access: Anyone</strong>.</li>
            <li>First-time only: Google shows an "Unverified app" warning. Click <em>Advanced → Go to {`{project name}`} (unsafe) → Allow</em>.</li>
            <li>Copy the <strong>Web app URL</strong> Google shows you. Paste it in KaraWeb on the next step.</li>
            <li>To <strong>update</strong> the script later (e.g. after rotating keys): <em>Deploy → Manage deployments → pencil → Version: New version → Deploy</em>. Same URL.</li>
          </ol>
          <details className="cs-details">
            <summary>Why does the script need access to my Drive files?</summary>
            <p>Script creates one Drive folder + one sheet per book. Use a dedicated Google account if you'd prefer isolation.</p>
          </details>
        </StepCard>
      )}

      {step === 3 && (
        <StepCard
          title="3. Connect KaraWeb to your Web App"
          onBack={() => setStep(2)}
        >
          <p>Paste the Google Web App URL here, then click <strong>Test connection</strong>:</p>
          <div className="wiz-final-row">
            <input
              className="wiz-url-input"
              value={cloudSave.apiBaseUrl}
              onChange={e => dispatch({ type: 'CS_SET_FIELD', field: 'apiBaseUrl', value: e.target.value })}
              placeholder="https://script.google.com/macros/s/AKfycb.../exec"
            />
            <button
              className="btn-primary"
              disabled={!cloudSave.apiBaseUrl || busyTest}
              onClick={doTestConnection}
            >{busyTest ? 'Testing…' : 'Test connection'}</button>
          </div>
          {cloudSave.registered && (
            <p className="wiz-help" style={{ color: '#0f5132' }}>
              ✓ Connection saved. You can now save a challenges file with
              this Google Drive backend wired in.
            </p>
          )}
        </StepCard>
      )}

      {localStatus?.message && (
        <div className={`cl-status cl-status-${localStatus.kind || ''}`}>{localStatus.message}</div>
      )}
    </div>
  );
}

function ProgressBar({ step }) {
  return (
    <ol className="wiz-progress">
      {STEPS.map(s => (
        <li
          key={s.id}
          className={`wiz-progress-step ${s.id === step ? 'current' : ''} ${s.id < step ? 'done' : ''}`}
        >
          <span className="wiz-progress-num">{s.id < step ? '✓' : s.id}</span>
          <span className="wiz-progress-label">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

function StepCard({ title, children, onBack, onNext, nextLabel, nextDisabled = false }) {
  return (
    <div className="wiz-card">
      <h3 className="wiz-card-title">{title}</h3>
      <div className="wiz-card-body">{children}</div>
      <div className="wiz-card-actions">
        {onBack && <button className="btn-secondary" onClick={onBack}>← Back</button>}
        {onNext && <button className="btn-primary" disabled={nextDisabled} onClick={onNext}>{nextLabel ?? 'Next'} →</button>}
      </div>
    </div>
  );
}
