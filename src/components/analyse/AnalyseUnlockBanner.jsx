import React from 'react';

export default function AnalyseUnlockBanner({ keydetails, cloudSave, loadedCloudSave }) {
  const lines = [];
  if (!keydetails) {
    lines.push('Generate or load your keydetails file.');
  } else if (!keydetails.privateKeyJwk && !keydetails.encryptedKeyPair) {
    // Public key only — common when the teacher loaded a v3 file via
    // the Teacher-verification flow but didn't supply the password.
    lines.push('Re-load your keydetails file and supply the password — only the public key is currently available, so submissions cannot be decrypted.');
  }
  if (!loadedCloudSave?.apiBaseUrl && !cloudSave?.apiBaseUrl) {
    lines.push('Configure the Cloud Save tab with your backend URL.');
  }
  return (
    <div className="analyse-unlock">
      <h3>Analyse is locked</h3>
      <p>Before you can view submitted results, you need:</p>
      <ul>{lines.map(l => <li key={l}>{l}</li>)}</ul>
    </div>
  );
}
