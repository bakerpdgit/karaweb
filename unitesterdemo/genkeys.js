(function () {
  "use strict";

  const U = window.Unitester;
  const button = document.getElementById("generateKeysButton");
  const status = document.getElementById("keygenStatus");

  async function generateAndDownloadKeys() {
    button.disabled = true;
    U.setStatus(status, "Generating key pair...", "");
    try {
      const files = await U.generateKeyFiles();
      U.downloadText("publickey.txt", files.publicKeyFile);
      U.downloadText("keytest.txt", files.keytestFile);
      U.downloadText("keydetails.txt", files.keyDetailsFile);
      U.setStatus(status, "Downloaded publickey.txt, keytest.txt, and keydetails.txt.", "ok");
    } catch (error) {
      U.setStatus(status, error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  button.addEventListener("click", generateAndDownloadKeys);
})();
