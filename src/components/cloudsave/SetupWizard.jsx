import React, { useState } from 'react';
import { copyToClipboard } from '../../utils/copyToClipboard.js';
// Single source of truth: read the exact backend file we ship into the
// repo. Vite's `?raw` import embeds the file as a string at build time.
import backendSource from '../../../codehooks-backend/index.js?raw';
import backendPackageSource from '../../../codehooks-backend/package.json?raw';

const STEPS = [
  { id: 1, label: 'Sign up' },
  { id: 2, label: 'Create project' },
  { id: 3, label: 'Paste code' },
  { id: 4, label: 'Connect' },
];

/**
 * 4-step in-browser wizard for setting up a codehooks.io backend
 * without using the CLI. Designed for a teacher who knows browser
 * basics but does not have Node.js installed.
 *
 * The shipped backend script hardwires sensible production defaults
 * (origin allowlist, Turnstile via the shared Cloudflare Worker), so
 * teachers never see env-var setup. Maintainer overrides are
 * documented in `.env.example` and in `codehooks-backend/index.js`
 * itself.
 */
export default function SetupWizard({
  suggestedProjectName,
  apiBaseUrl, onApiBaseUrlChange,
  onTestConnection, testBusy,
  registered,
}) {
  // Resume at the final step (Connect / Test) when the teacher comes
  // back to a project they've already configured — apiBaseUrl set
  // means they at least pasted the URL, registered means the
  // connection test has passed. Back buttons remain functional for
  // re-running any earlier step.
  const [step, setStep] = useState(() => {
    if (registered || apiBaseUrl) return 4;
    return 1;
  });

  return (
    <div className="wiz">
      <ProgressBar step={step} />

      {step === 1 && (
        <StepCard
          title="1. Create a Codehooks account"
          onNext={() => setStep(2)}
          nextLabel="I've signed up"
        >
          <p>
            Results stored on a <a href="https://codehooks.io" target="_blank" rel="noreferrer">Codehooks</a> server
            you control. The free tier should suffice.
          </p>
          <p>
            <a
              className="btn-primary wiz-link-btn"
              href="https://account.codehooks.io/login?signup"
              target="_blank" rel="noreferrer"
            >Open Codehooks signup ↗</a>
          </p>
          <p className="wiz-help">
            Use any email — you only need it for the signup. Come back once
            you've confirmed your account.
          </p>
        </StepCard>
      )}

      {step === 2 && (
        <StepCard
          title="2. Create your project"
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          nextLabel="I've created the project"
        >
          <p>
            In Codehooks Studio, create a new project for this class.
          </p>
          <ul className="wiz-list">
            <li>Name suggestion: <CopyChip text={suggestedProjectName || 'karaweb'} /></li>
            <li>Space: leave as <code>dev</code> (the default).</li>
            <li>Region: any will work.</li>
          </ul>
        </StepCard>
      )}

      {step === 3 && (
        <StepCard
          title="3. Paste the KaraWeb backend code"
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
          nextLabel="I've deployed the code"
        >
          <p>Replace the example code with KaraWeb's backend (you'll find these files in the studio area of your project's dev space):</p>
          <ol className="wiz-list">
            <li>Open <code>index.js</code>, select all (<kbd>Ctrl</kbd>+<kbd>A</kbd>), delete, paste the backend code below, and save.</li>
            <li>Open <code>package.json</code>, select all, delete, paste the package.json below, and save.</li>
            <li>Click <strong>Deploy</strong>.</li>
          </ol>
          <div className="wiz-copy-row">
            <CopyButton
              label={`Copy backend code (${Math.round(backendSource.length / 1024)} KB)`}
              text={backendSource}
            />
            <CopyButton
              label="Copy package.json"
              text={backendPackageSource}
            />
          </div>
          <details className="wiz-codepreview">
            <summary>Preview the code that will be copied</summary>
            <textarea
              className="wiz-code-textarea"
              readOnly
              rows={14}
              value={backendSource}
            />
          </details>
        </StepCard>
      )}

      {step === 4 && (
        <StepCard
          title="4. Connect KaraWeb to your backend"
          onBack={() => setStep(3)}
        >
          <p>
            In Codehooks Studio, find your project's API base URL on the
            project dashboard. It looks like:
          </p>
          <pre className="wiz-pre">https://YOUR_PROJECT.api.codehooks.io/dev</pre>
          <p>Paste it here, then click <strong>Test connection</strong>:</p>
          <div className="wiz-final-row">
            <input
              className="wiz-url-input"
              placeholder="https://YOUR_PROJECT.api.codehooks.io/dev"
              value={apiBaseUrl}
              onChange={e => onApiBaseUrlChange(e.target.value)}
            />
            <button
              className="btn-primary"
              disabled={!apiBaseUrl || testBusy}
              onClick={onTestConnection}
            >{testBusy ? 'Testing…' : 'Test connection'}</button>
          </div>
          {registered && (
            <p className="wiz-help" style={{ color: '#0f5132' }}>
              ✓ Connection saved. You can now save a challenges file with
              this Codehooks backend wired in.
            </p>
          )}
        </StepCard>
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

function StepCard({ title, children, onBack, onNext, nextLabel }) {
  return (
    <div className="wiz-card">
      <h3 className="wiz-card-title">{title}</h3>
      <div className="wiz-card-body">{children}</div>
      <div className="wiz-card-actions">
        {onBack && <button className="btn-secondary" onClick={onBack}>← Back</button>}
        {onNext && <button className="btn-primary" onClick={onNext}>{nextLabel ?? 'Next'} →</button>}
      </div>
    </div>
  );
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  const click = async () => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  return (
    <button className="btn-primary wiz-copy-btn" onClick={click}>
      {copied ? '✓ Copied!' : label}
    </button>
  );
}

function CopyChip({ text, placeholder }) {
  const [copied, setCopied] = useState(false);
  const display = text || placeholder || '';
  const click = async () => {
    const ok = await copyToClipboard(text || '');
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };
  return (
    <span className="wiz-copy-chip" onClick={click} title="Click to copy">
      <code>{display}</code>
      <span className="wiz-copy-chip-action">{copied ? '✓' : '📋'}</span>
    </span>
  );
}
