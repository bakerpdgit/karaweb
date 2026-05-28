import React from 'react';

export default function AnalyseUnlockBanner({ classList, keydetails, cloudSave, loadedCloudSave }) {
  const lines = [];
  const isCodehooks = (loadedCloudSave?.method || cloudSave?.method) === 'codehooks';
  if (!keydetails) {
    lines.push('Generate or load your keydetails file.');
  }
  if (isCodehooks && !classList?.classCode) {
    lines.push('Set a class code in the Class List tab (Codehooks needs one).');
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
