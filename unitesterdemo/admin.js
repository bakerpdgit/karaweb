(function () {
  "use strict";

  const U = window.Unitester;

  const elements = {
    adminKeyFile: document.getElementById("adminKeyFile"),
    adminRetainKey: document.getElementById("adminRetainKey"),
    adminUnlockButton: document.getElementById("adminUnlockButton"),
    adminLockStatus: document.getElementById("adminLockStatus"),
    adminLockPanel: document.getElementById("adminLockPanel"),
    adminContent: document.getElementById("adminContent"),
  };

  async function unlockAdmin() {
    const selectedFile = elements.adminKeyFile.files[0];
    let privateKeyText = window.localStorage.getItem("unitesterPrivateKey") || "";
    if (selectedFile) {
      privateKeyText = await selectedFile.text();
    }
    if (!privateKeyText) {
      U.setStatus(elements.adminLockStatus, "Choose keydetails.txt first.", "error");
      return;
    }

    elements.adminUnlockButton.disabled = true;
    U.setStatus(elements.adminLockStatus, "Checking private key...", "");
    try {
      const keytestText = await U.fetchTextFile("keytest.txt");
      const result = await U.decryptTextWithPrivateKey(keytestText, privateKeyText);
      if (result.trim() !== "ACCESS GRANTED") {
        throw new Error("The private key did not pass the key test.");
      }

      if (elements.adminRetainKey.checked) {
        window.localStorage.setItem("unitesterPrivateKey", privateKeyText);
      } else {
        window.localStorage.removeItem("unitesterPrivateKey");
      }
      elements.adminLockPanel.hidden = true;
      elements.adminContent.hidden = false;
    } catch (error) {
      window.localStorage.removeItem("unitesterPrivateKey");
      U.setStatus(elements.adminLockStatus, error.message, "error");
    } finally {
      elements.adminUnlockButton.disabled = false;
    }
  }

  function tryStoredKey() {
    const stored = window.localStorage.getItem("unitesterPrivateKey");
    if (stored) {
      elements.adminRetainKey.checked = true;
      unlockAdmin();
    }
  }

  elements.adminUnlockButton.addEventListener("click", unlockAdmin);
  elements.adminKeyFile.addEventListener("change", () => {
    U.setStatus(elements.adminLockStatus, "", "");
  });

  tryStoredKey();
})();
