(function () {
  "use strict";

  const U = window.Unitester;
  const CONFIG_PATH = "codehooks_config.json";
  const RESULT_DOWNLOAD_FORMAT = "unitester-result-download-v4";
  const CLEAR_RESULT_DOWNLOAD_FORMAT = "unitester-result-download-v3";
  const LEGACY_RESULT_DOWNLOAD_FORMAT = "unitester-result-download-v2";
  const RESULT_DOWNLOAD_PAYLOAD_FORMAT = "unitester-result-download-payload-v1";
  const RESULT_DOWNLOAD_KDF_ITERATIONS = 100000;
  const REVIEW_PAYLOAD_FORMAT = "unitester-review-payload-v1";
  const REVIEW_ENVELOPE_FORMAT = "unitester-review-aes-gcm-v1";
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  let configPromise = null;
  let turnstileWidgetId = null;
  let turnstileToken = "";
  let teacherSession = null;

  function requireCrypto() {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("This browser does not support the required Web Crypto APIs.");
    }
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let index = 0; index < view.length; index += 1) {
      binary += String.fromCharCode(view[index]);
    }
    return btoa(binary);
  }

  function base64ToBytes(base64) {
    const binary = atob(String(base64 || ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  function bytesToBase64Url(bytes) {
    return bytesToBase64(bytes)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  function base64UrlToBytes(value) {
    let base64 = String(value || "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    return base64ToBytes(base64);
  }

  function randomBytes(length) {
    requireCrypto();
    const bytes = new Uint8Array(length);
    window.crypto.getRandomValues(bytes);
    return bytes;
  }

  function generateSubmissionGuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    const bytes = randomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-");
  }

  function generateReviewSecret() {
    return bytesToBase64Url(randomBytes(32));
  }

  async function importReviewKey(reviewSecret, usages) {
    requireCrypto();
    const secretText = String(reviewSecret || "");
    if (!secretText) {
      throw new Error("The review secret is not valid.");
    }
    let secretBytes = null;
    try {
      const decoded = base64UrlToBytes(secretText);
      if (decoded.length === 32) {
        secretBytes = decoded;
      }
    } catch (error) {
      secretBytes = null;
    }
    if (!secretBytes) {
      secretBytes = new Uint8Array(
        await window.crypto.subtle.digest(
          "SHA-256",
          textEncoder.encode(secretText),
        ),
      );
    }
    return window.crypto.subtle.importKey(
      "raw",
      secretBytes,
      { name: "AES-GCM", length: 256 },
      false,
      usages,
    );
  }

  async function encryptReviewPayload(payload, reviewSecret) {
    requireCrypto();
    const key = await importReviewKey(reviewSecret, ["encrypt"]);
    const iv = randomBytes(12);
    const body = Object.assign(
      {
        version: 1,
        type: REVIEW_PAYLOAD_FORMAT,
      },
      payload,
    );
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      textEncoder.encode(JSON.stringify(body)),
    );
    return {
      format: REVIEW_ENVELOPE_FORMAT,
      algorithm: "AES-GCM",
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    };
  }

  async function decryptReviewPayload(envelope, reviewSecret) {
    requireCrypto();
    if (!envelope || envelope.format !== REVIEW_ENVELOPE_FORMAT) {
      throw new Error("The cloud review payload is not in the expected format.");
    }
    const key = await importReviewKey(reviewSecret, ["decrypt"]);
    const plaintext = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(envelope.iv) },
      key,
      base64ToBytes(envelope.ciphertext),
    );
    const payload = JSON.parse(textDecoder.decode(plaintext));
    if (payload.type !== REVIEW_PAYLOAD_FORMAT) {
      throw new Error("The cloud review payload is not a Unitester review file.");
    }
    return payload;
  }

  function resultDownloadKeyText(value) {
    return U.sanitizeFilePart(String(value || "").trim()).toLowerCase();
  }

  async function importResultDownloadPasswordKey(keyText) {
    requireCrypto();
    const normalized = resultDownloadKeyText(keyText);
    if (!normalized || normalized === "untitled") {
      throw new Error("A username is required to protect this result file.");
    }
    return window.crypto.subtle.importKey(
      "raw",
      textEncoder.encode(normalized),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
  }

  async function deriveResultDownloadKey(keyText, salt, usages, iterations) {
    const passwordKey = await importResultDownloadPasswordKey(keyText);
    return window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt,
        iterations: iterations || RESULT_DOWNLOAD_KDF_ITERATIONS,
      },
      passwordKey,
      { name: "AES-GCM", length: 256 },
      false,
      usages,
    );
  }

  async function createResultDownload(details) {
    requireCrypto();
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = await deriveResultDownloadKey(
      details.studentUsername,
      salt,
      ["encrypt"],
      RESULT_DOWNLOAD_KDF_ITERATIONS,
    );
    const payload = {
      format: RESULT_DOWNLOAD_PAYLOAD_FORMAT,
      studentResult: details.studentResult,
    };
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      textEncoder.encode(JSON.stringify(payload)),
    );
    return JSON.stringify(
      {
        format: RESULT_DOWNLOAD_FORMAT,
        schemaVersion: 4,
        algorithm: "PBKDF2-SHA256-AES-GCM",
        kdf: {
          name: "PBKDF2",
          hash: "SHA-256",
          iterations: RESULT_DOWNLOAD_KDF_ITERATIONS,
          salt: bytesToBase64(salt),
        },
        iv: bytesToBase64(iv),
        ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
        submissionGuid: details.submissionGuid,
        testId: details.testId,
        testTitle: details.testTitle,
        completedAt: details.completedAt,
      },
      null,
      2,
    );
  }

  function parseResultDownload(text) {
    try {
      const parsed = JSON.parse(String(text || ""));
      if (
        parsed &&
        (parsed.format === RESULT_DOWNLOAD_FORMAT ||
          parsed.format === CLEAR_RESULT_DOWNLOAD_FORMAT ||
          parsed.format === LEGACY_RESULT_DOWNLOAD_FORMAT)
      ) {
        return parsed;
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  function unwrapTeacherResultText(text) {
    const wrapper = parseResultDownload(text);
    return wrapper && wrapper.teacherPayload ? wrapper.teacherPayload : text;
  }

  function clearResultPayloadFromDownload(text) {
    try {
      const parsed = JSON.parse(String(text || ""));
      if (parsed && parsed.type === "unitester-result") {
        return parsed;
      }
      const wrapper = parseResultDownload(text);
      if (wrapper && wrapper.studentResult && wrapper.studentResult.type === "unitester-result") {
        return wrapper.studentResult;
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  async function decryptResultDownload(wrapper, keyText) {
    if (!wrapper || wrapper.format !== RESULT_DOWNLOAD_FORMAT) {
      return null;
    }
    try {
      const kdf = wrapper.kdf || {};
      const key = await deriveResultDownloadKey(
        keyText,
        base64ToBytes(kdf.salt),
        ["decrypt"],
        Number.parseInt(kdf.iterations, 10) || RESULT_DOWNLOAD_KDF_ITERATIONS,
      );
      const plaintext = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToBytes(wrapper.iv) },
        key,
        base64ToBytes(wrapper.ciphertext),
      );
      const payload = JSON.parse(textDecoder.decode(plaintext));
      if (
        payload &&
        payload.format === RESULT_DOWNLOAD_PAYLOAD_FORMAT &&
        payload.studentResult &&
        payload.studentResult.type === "unitester-result"
      ) {
        return payload.studentResult;
      }
      throw new Error("The result file payload is not in the expected format.");
    } catch (error) {
      throw new Error("This result file could not be opened with that username.");
    }
  }

  async function studentResultFromDownload(text, keyText) {
    const clearResult = clearResultPayloadFromDownload(text);
    if (clearResult) {
      return clearResult;
    }
    const wrapper = parseResultDownload(text);
    if (!wrapper || wrapper.format !== RESULT_DOWNLOAD_FORMAT) {
      return null;
    }
    return decryptResultDownload(wrapper, keyText);
  }

  async function loadConfig() {
    if (!configPromise) {
      configPromise = fetch(CONFIG_PATH, { cache: "no-store" })
        .then((response) => {
          if (response.status === 404) {
            return null;
          }
          if (!response.ok) {
            throw new Error("Could not load " + CONFIG_PATH + ".");
          }
          return response.json();
        })
        .then((config) => {
          if (!config) {
            return null;
          }
          const apiBaseUrl = String(config.apiBaseUrl || "").replace(/\/+$/g, "");
          if (!apiBaseUrl) {
            return null;
          }
          return {
            apiBaseUrl,
            turnstileSiteKey: String(config.turnstileSiteKey || ""),
            turnstileRequired: config.turnstileRequired !== false,
          };
        })
        .catch((error) => {
          console.warn("Codehooks configuration unavailable:", error.message);
          return null;
        });
    }
    return configPromise;
  }

  function waitForTurnstile() {
    if (window.turnstile && typeof window.turnstile.render === "function") {
      return Promise.resolve(window.turnstile);
    }
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const timer = window.setInterval(() => {
        attempts += 1;
        if (window.turnstile && typeof window.turnstile.render === "function") {
          window.clearInterval(timer);
          resolve(window.turnstile);
        } else if (attempts > 50) {
          window.clearInterval(timer);
          reject(new Error("Cloudflare Turnstile did not load."));
        }
      }, 100);
    });
  }

  async function prepareTurnstile(container, statusElement) {
    const config = await loadConfig();
    if (
      !container ||
      !config ||
      config.turnstileRequired === false ||
      !config.turnstileSiteKey
    ) {
      return { available: false };
    }

    container.replaceChildren();
    turnstileToken = "";
    turnstileWidgetId = null;

    try {
      const turnstile = await waitForTurnstile();
      turnstileWidgetId = turnstile.render(container, {
        sitekey: config.turnstileSiteKey,
        theme: "auto",
        callback(token) {
          turnstileToken = token;
          U.setStatus(statusElement, "", "");
        },
        "expired-callback"() {
          turnstileToken = "";
          U.setStatus(statusElement, "The bot-protection check expired. Please retry it before finishing.", "error");
        },
        "error-callback"() {
          turnstileToken = "";
          U.setStatus(statusElement, "The bot-protection check could not load.", "error");
        },
      });
      return { available: true };
    } catch (error) {
      U.setStatus(statusElement, error.message, "error");
      return { available: false, error };
    }
  }

  function getTurnstileToken() {
    if (turnstileToken) {
      return turnstileToken;
    }
    if (
      turnstileWidgetId !== null &&
      window.turnstile &&
      typeof window.turnstile.getResponse === "function"
    ) {
      return window.turnstile.getResponse(turnstileWidgetId) || "";
    }
    return "";
  }

  function resetTurnstile() {
    if (
      turnstileWidgetId !== null &&
      window.turnstile &&
      typeof window.turnstile.reset === "function"
    ) {
      window.turnstile.reset(turnstileWidgetId);
    }
    turnstileToken = "";
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    if (!timeoutMs || !window.AbortController) {
      return fetch(url, options);
    }
    const controller = new window.AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(
        url,
        Object.assign({}, options, { signal: controller.signal }),
      );
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("Codehooks submission timed out.");
      }
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function attemptSubmitToCodehooks(submission, options) {
    const config = await loadConfig();
    if (!config) {
      return { success: false, reason: "config-not-found" };
    }

    const timeoutMs = Number.parseInt(options && options.timeoutMs, 10) || 0;
    const response = await fetchWithTimeout(config.apiBaseUrl + "/api/public/submissions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(submission),
    }, timeoutMs);
    if (!response.ok) {
      const message = await response.text();
      throw new Error("Codehooks submission failed (" + response.status + "): " + message);
    }
    return response.json();
  }

  function submitInBackground(submission) {
    attemptSubmitToCodehooks(submission)
      .then((result) => {
        if (result && result.success) {
          console.log("Codehooks submission stored:", result.submissionGuid);
        }
      })
      .catch((error) => {
        console.warn("Background Codehooks submission failed:", error.message);
      });
  }

  async function fetchReviewSubmission(submissionGuid) {
    const config = await loadConfig();
    if (!config) {
      throw new Error("Codehooks is not configured.");
    }
    const response = await fetch(
      config.apiBaseUrl + "/api/public/submissions/" + encodeURIComponent(submissionGuid),
      { cache: "no-store" },
    );
    if (!response.ok) {
      throw new Error("Could not load the cloud review submission.");
    }
    const result = await response.json();
    return result.submission;
  }

  function hasUsableTeacherSession() {
    return (
      teacherSession &&
      teacherSession.sessionToken &&
      new Date(teacherSession.expiresAt || 0).getTime() > Date.now() + 30000
    );
  }

  async function ensureTeacherSession(privateKeyText) {
    const config = await loadConfig();
    if (!config) {
      throw new Error("Codehooks is not configured.");
    }
    if (hasUsableTeacherSession()) {
      return teacherSession.sessionToken;
    }
    if (!String(privateKeyText || "").trim()) {
      throw new Error("Unlock Analyse with keydetails.txt first.");
    }

    const challengeResponse = await fetch(
      config.apiBaseUrl + "/api/public/teacher/challenge",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{}",
      },
    );
    if (!challengeResponse.ok) {
      throw new Error("Could not create a teacher challenge.");
    }
    const challenge = await challengeResponse.json();
    const decoded = await U.decryptPayloadWithPrivateKey(
      challenge.encryptedChallenge,
      privateKeyText,
      "unitester-teacher-challenge",
    );
    const payload = decoded.payload;

    const sessionResponse = await fetch(
      config.apiBaseUrl + "/api/public/teacher/session",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengeId: payload.challengeId,
          nonce: payload.nonce,
        }),
      },
    );
    if (!sessionResponse.ok) {
      throw new Error("The teacher private-key challenge failed.");
    }
    teacherSession = await sessionResponse.json();
    return teacherSession.sessionToken;
  }

  async function fetchTeacherSubmissions(testId, privateKeyText) {
    const config = await loadConfig();
    if (!config) {
      throw new Error("Codehooks is not configured.");
    }
    const sessionToken = await ensureTeacherSession(privateKeyText);
    const response = await fetch(
      config.apiBaseUrl + "/api/public/teacher/submissions/" + encodeURIComponent(testId),
      {
        cache: "no-store",
        headers: {
          Authorization: "Bearer " + sessionToken,
        },
      },
    );
    if (response.status === 401 || response.status === 403) {
      teacherSession = null;
    }
    if (!response.ok) {
      throw new Error("Could not fetch cloud submissions (" + response.status + ").");
    }
    const result = await response.json();
    return result.submissions || [];
  }

  async function deleteTeacherSubmission(submissionGuid, privateKeyText) {
    const config = await loadConfig();
    if (!config) {
      throw new Error("Codehooks is not configured.");
    }
    const sessionToken = await ensureTeacherSession(privateKeyText);
    const response = await fetch(
      config.apiBaseUrl + "/api/public/teacher/submissions/" + encodeURIComponent(submissionGuid),
      {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + sessionToken,
        },
      },
    );
    if (response.status === 401 || response.status === 403) {
      teacherSession = null;
    }
    if (!response.ok) {
      throw new Error("Could not delete cloud submission (" + response.status + ").");
    }
    return response.json();
  }

  window.Unitester.CodehooksIntegration = {
    createResultDownload,
    clearResultPayloadFromDownload,
    deleteTeacherSubmission,
    decryptReviewPayload,
    encryptReviewPayload,
    fetchReviewSubmission,
    fetchTeacherSubmissions,
    generateReviewSecret,
    generateSubmissionGuid,
    getTurnstileToken,
    loadConfig,
    parseResultDownload,
    prepareTurnstile,
    resetTurnstile,
    studentResultFromDownload,
    submitInBackground,
    submitToCodehooks: attemptSubmitToCodehooks,
    unwrapTeacherResultText,
  };
})();
