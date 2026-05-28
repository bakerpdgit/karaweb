import React, { useEffect, useState } from 'react';
import { healthCheck } from '../../utils/codehooksClient.js';
import {
  getGoogleDriveConfig, setGoogleDriveConfig,
  getCodehooksConfig, setCodehooksConfig,
} from '../../utils/localStore.js';
import SetupWizard from './SetupWizard.jsx';
import GoogleDriveSetupPanel from './GoogleDriveSetupPanel.jsx';
import RememberOnDeviceModal from '../RememberOnDeviceModal.jsx';
import AboutCloudSubmissionsModal from './AboutCloudSubmissionsModal.jsx';
import { useConfirmModal } from '../ConfirmModal.jsx';

/**
 * Cloud Save tab.
 *
 * Codehooks is set up via the in-browser SetupWizard (no CLI). The
 * teacher's `classCode` is no longer required — the Codehooks
 * backend identifies the teacher by their RSA public-key fingerprint,
 * so the same setup serves every class the teacher hands the book to.
 */
export default function CloudSavePanel({ cloudSave, classList, keydetails, dispatch }) {
  // Codehooks no longer needs a classCode — only keydetails. The
  // backend identifies the teacher by their RSA public-key
  // fingerprint at /teacher/challenge time.
  const ready = !!keydetails;
  // After a successful Test connection, ask whether to persist the URL
  // on this device. Until the teacher answers, the URL lives only in
  // memory (cloudSave state) — nothing is written to localStorage.
  const [rememberPrompt, setRememberPrompt] = useState(null);
  const [showAbout, setShowAbout] = useState(false);
  const { confirm, modal: confirmModalEl } = useConfirmModal();

  // Switching method when an existing setup is in place wipes the
  // current connection — confirm before doing so. A challenge file
  // can only save one method, so we don't keep stale state from the
  // other backend lying around. Also clears the destination backend's
  // saved localStorage slot so a stale URL (e.g. from before slots
  // were split) doesn't auto-repopulate the new panel's URL field.
  const handleMethodChange = async (nextMethod) => {
    if (nextMethod === cloudSave.method) return;
    const haveExisting = !!cloudSave.apiBaseUrl;
    if (haveExisting) {
      const ok = await confirm({
        title: 'Wipe existing cloud connection?',
        message: `You currently have a ${cloudSave.method === 'google-drive' ? 'Google Drive' : 'Codehooks'} backend configured. Switching to ${nextMethod === 'google-drive' ? 'Google Drive' : 'Codehooks'} clears the current URL — a challenges file can only carry one backend.`,
        confirmLabel: 'Switch backend',
        variant: 'danger',
      });
      if (!ok) return;
      if (nextMethod === 'google-drive') {
        setGoogleDriveConfig({ apiBaseUrl: '', registered: false });
      } else {
        setCodehooksConfig({ apiBaseUrl: '', turnstileSiteKey: '', registered: false });
      }
    }
    dispatch({ type: 'CS_SET_METHOD', method: nextMethod });
  };

  // Auto-load the saved config for the active method. Both backends
  // now use a single per-teacher config slot in localStorage.
  useEffect(() => {
    const stored = cloudSave.method === 'google-drive'
      ? getGoogleDriveConfig()
      : getCodehooksConfig();
    if (stored?.apiBaseUrl && !cloudSave.apiBaseUrl) {
      dispatch({ type: 'CS_SET_FIELD', field: 'apiBaseUrl', value: stored.apiBaseUrl });
    }
    if (cloudSave.method === 'codehooks' && stored?.turnstileSiteKey && !cloudSave.turnstileSiteKey) {
      dispatch({ type: 'CS_SET_FIELD', field: 'turnstileSiteKey', value: stored.turnstileSiteKey });
    }
    if (stored?.registered && !cloudSave.registered) {
      dispatch({ type: 'CS_SET_REGISTERED', registered: true });
    }
  }, [cloudSave.method]);

  // No auto-persist effect on URL keystrokes — the URL only enters
  // localStorage after the teacher passes Test connection AND clicks
  // Yes on the Remember-on-device prompt.

  // Codehooks no longer has a "register class" step; the only
  // backend setup is a connectivity check. On success we set
  // `registered` so the wizard remembers this URL is good and
  // resumes at Step 5 next time.
  const testConnection = async () => {
    if (!ready) return;
    dispatch({ type: 'CS_SET_STATUS', busy: true, message: 'Pinging backend…' });
    try {
      await healthCheck(cloudSave.apiBaseUrl);
      dispatch({ type: 'CS_SET_REGISTERED', registered: true });
      dispatch({ type: 'CS_SET_STATUS', busy: false, kind: 'ok',
        message: 'Connection ok. Your Codehooks backend is ready.' });
      setRememberPrompt({
        method: cloudSave.method,
        apiBaseUrl: cloudSave.apiBaseUrl,
        turnstileSiteKey: cloudSave.turnstileSiteKey,
      });
    } catch (err) {
      dispatch({ type: 'CS_SET_STATUS', busy: false, kind: 'error',
        message: 'Health check failed: ' + (err?.message ?? err) });
    }
  };

  const confirmRemember = (yes) => {
    if (!rememberPrompt) return;
    if (yes) {
      if (rememberPrompt.method === 'google-drive') {
        setGoogleDriveConfig({
          apiBaseUrl: rememberPrompt.apiBaseUrl,
          registered: true,
        });
      } else {
        setCodehooksConfig({
          apiBaseUrl: rememberPrompt.apiBaseUrl,
          turnstileSiteKey: rememberPrompt.turnstileSiteKey,
          registered: true,
        });
      }
    }
    setRememberPrompt(null);
  };

  const suggestedProjectName = classList.initials
    ? `karaweb-${classList.initials.toLowerCase()}`
    : 'karaweb';

  const method = cloudSave.method;
  return (
    <div className="editor-tab-panel">
      <section className="cs-section cs-method-row">
        <label className="cs-method-label">Backend method:</label>
        <select
          className="cs-method-select"
          value={method}
          onChange={e => handleMethodChange(e.target.value)}
        >
          <option value="google-drive">Google Drive (recommended)</option>
          <option value="codehooks">Codehooks.io</option>
        </select>
        <span className="cs-method-blurb">
          {method === 'google-drive'
            ? 'Use your Google Drive for easiest submission storage.'
            : 'Free serverless backend (up to normal limits) for more customisation.'}
        </span>
      </section>

      <div className="security-callout">
        <div className="security-callout-title">🛡 What's stored</div>
        <ul>
          <li><strong>On the cloud:</strong> encrypted solutions + anonymous 6-digit codes &amp; timestamps.</li>
          <li><strong>Never sent:</strong> usernames, your private key, class lists. Anyone with the URL can submit; only you can read results.</li>
          <li><a className="cs-link" href="#" onClick={e => { e.preventDefault(); setShowAbout(true); }}>More details on how cloud submissions work…</a></li>
        </ul>
      </div>

      {method === 'google-drive' && (
        <GoogleDriveSetupPanel
          cloudSave={cloudSave}
          keydetails={keydetails}
          dispatch={dispatch}
          onConnectionVerified={() => setRememberPrompt({
            method: 'google-drive',
            apiBaseUrl: cloudSave.apiBaseUrl,
            turnstileSiteKey: cloudSave.turnstileSiteKey,
          })}
        />
      )}

      {method === 'codehooks' && (
        <>
          <SetupWizard
            suggestedProjectName={suggestedProjectName}
            apiBaseUrl={cloudSave.apiBaseUrl}
            onApiBaseUrlChange={(v) => dispatch({ type: 'CS_SET_FIELD', field: 'apiBaseUrl', value: v })}
            onTestConnection={testConnection}
            testBusy={cloudSave.status.busy}
            registered={cloudSave.registered}
          />

          {cloudSave.status.message && (
            <div className={`cl-status cl-status-${cloudSave.status.kind || ''}`}>
              {cloudSave.status.message}
            </div>
          )}
        </>
      )}

      {rememberPrompt && (
        <RememberOnDeviceModal
          what="cloud-save URL"
          detail={rememberPrompt.apiBaseUrl}
          onYes={() => confirmRemember(true)}
          onNo={() => confirmRemember(false)}
        />
      )}
      {showAbout && (
        <AboutCloudSubmissionsModal onClose={() => setShowAbout(false)} />
      )}
      {confirmModalEl}
    </div>
  );
}
