(function () {
  "use strict";

  const PRINTABLE_START = 32;
  const PRINTABLE_END = 126;
  const PRINTABLE_RANGE = PRINTABLE_END - PRINTABLE_START + 1;
  const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
  const TEST_FILE_FORMAT = "unitester-test-aes-gcm-v1";
  const RESULT_FILE_FORMAT = "unitester-result-hybrid-v1";
  const PUBLIC_KEY_FORMAT = "unitester-rsa-oaep-public-v1";
  const KEY_DETAILS_FORMAT = "unitester-keydetails-v1";
  const SECURE_MATERIAL_FORMAT = "unitester-secure-materials";
  const TEST_KDF_ITERATIONS = 150000;
  const TESTS_DIR = "tests/";
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  function requireCrypto() {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error(
        "This browser does not support the required Web Crypto APIs.",
      );
    }
  }

  function normaliseTestNameToBase(name) {
    const trimmed = String(name || "").trim();
    if (!trimmed) {
      throw new Error("A test name is required.");
    }
    if (!/^[A-Za-z0-9 _-]+$/.test(trimmed)) {
      throw new Error(
        "Use only letters, numbers, spaces, underscores, and hyphens in the test name.",
      );
    }
    if (
      trimmed.includes("..") ||
      trimmed.includes(".") ||
      trimmed.includes("&")
    ) {
      throw new Error("Do not use dots or ampersands in the test name.");
    }
    return trimmed.replace(/\s+/g, "_");
  }

  function testPasswordFromBase(base) {
    const safeBase = normaliseTestNameToBase(base);
    if (/^\d{3}$/.test(safeBase)) {
      return safeBase + safeBase;
    }
    return safeBase + "_" + safeBase;
  }

  function testPathFromBase(base) {
    return TESTS_DIR + normaliseTestNameToBase(base) + ".txt";
  }

  function numericTestId(index) {
    return String(index).padStart(3, "0");
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        bytes.subarray(index, index + chunkSize),
      );
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

  function randomBytes(length) {
    requireCrypto();
    const bytes = new Uint8Array(length);
    window.crypto.getRandomValues(bytes);
    return bytes;
  }

  async function deriveAesKeyFromPassword(password, salt, iterations) {
    requireCrypto();
    if (!String(password || "").trim()) {
      throw new Error("A test encryption key is required.");
    }

    const passwordKey = await window.crypto.subtle.importKey(
      "raw",
      textEncoder.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"],
    );

    return window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt,
        iterations,
      },
      passwordKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }

  async function encryptTestPayload(title, payload, password) {
    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) {
      throw new Error("A test title is required.");
    }

    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = await deriveAesKeyFromPassword(
      password,
      salt,
      TEST_KDF_ITERATIONS,
    );
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      textEncoder.encode(JSON.stringify(payload)),
    );

    const envelope = {
      format: TEST_FILE_FORMAT,
      kdf: "PBKDF2",
      hash: "SHA-256",
      iterations: TEST_KDF_ITERATIONS,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    };
    return cleanTitle + "\n" + JSON.stringify(envelope);
  }

  async function decryptTestPayload(text, password, expectedType) {
    const encoded = splitEncodedFile(text);
    const envelope = JSON.parse(encoded.body);
    if (envelope.format !== TEST_FILE_FORMAT) {
      throw new Error(
        "This test file is not encrypted with the current format.",
      );
    }

    const salt = base64ToBytes(envelope.salt);
    const iv = base64ToBytes(envelope.iv);
    const key = await deriveAesKeyFromPassword(
      password,
      salt,
      Number(envelope.iterations) || TEST_KDF_ITERATIONS,
    );
    const plaintext = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      base64ToBytes(envelope.ciphertext),
    );
    const payload = JSON.parse(textDecoder.decode(plaintext));
    if (expectedType && payload.type !== expectedType) {
      throw new Error("The file is not a " + expectedType + " file.");
    }
    return { fileTitle: encoded.title, payload };
  }

  async function discoverTestsWithPassword(password, onProgress) {
    const tests = [];
    for (let index = 1; index <= 999; index += 1) {
      const id = numericTestId(index);
      const path = testPathFromBase(id);
      if (typeof onProgress === "function") {
        onProgress(id);
      }

      let response;
      try {
        response = await fetch(path, { cache: "no-store" });
      } catch (error) {
        throw new Error(
          "Test discovery requires the pages to be served over HTTP.",
        );
      }

      if (response.status === 404) {
        break;
      }
      if (!response.ok) {
        throw new Error(path + " returned HTTP " + response.status + ".");
      }

      const text = await response.text();
      try {
        const decoded = await decryptTestPayload(
          text,
          password,
          "unitester-test",
        );
        tests.push({
          id,
          base: id,
          filename: id + ".txt",
          path,
          title: decoded.payload.title || decoded.fileTitle || "Test " + id,
          test: normalizeTest(decoded.payload),
        });
      } catch (error) {
        // A non-matching password or old-format file is simply not available.
      }
    }
    return tests;
  }

  async function fetchEncryptedTest(testId, password) {
    const path = testPathFromBase(testId);
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Could not load " + path + ".");
    }
    const text = await response.text();
    const decoded = await decryptTestPayload(text, password, "unitester-test");
    return normalizeTest(decoded.payload);
  }

  async function findNamedTest(testName) {
    const base = normaliseTestNameToBase(testName);
    const path = testPathFromBase(base);
    const password = testPasswordFromBase(base);
    const response = await fetch(path, { cache: "no-store" });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(path + " returned HTTP " + response.status + ".");
    }
    const text = await response.text();
    const decoded = await decryptTestPayload(text, password, "unitester-test");
    return {
      id: base,
      base,
      filename: base + ".txt",
      path,
      password,
      title: decoded.payload.title || decoded.fileTitle || base,
      test: normalizeTest(decoded.payload),
    };
  }

  async function browseOpenTests(onProgress) {
    const tests = [];
    for (let index = 1; index <= 999; index += 1) {
      const id = numericTestId(index);
      const path = testPathFromBase(id);
      if (typeof onProgress === "function") {
        onProgress(id);
      }

      let response;
      try {
        response = await fetch(path, { cache: "no-store" });
      } catch (error) {
        throw new Error(
          "Test discovery requires the pages to be served over HTTP.",
        );
      }
      if (response.status === 404) {
        break;
      }
      if (!response.ok) {
        throw new Error(path + " returned HTTP " + response.status + ".");
      }

      const text = await response.text();
      try {
        const password = testPasswordFromBase(id);
        const decoded = await decryptTestPayload(
          text,
          password,
          "unitester-test",
        );
        tests.push({
          id,
          base: id,
          filename: id + ".txt",
          path,
          password,
          title: decoded.payload.title || decoded.fileTitle || "Test " + id,
          test: normalizeTest(decoded.payload),
        });
      } catch (error) {
        // Skip incompatible files, but continue until the first missing numeric slot.
      }
    }
    return tests;
  }

  async function findNextOpenTestId(onProgress) {
    for (let index = 1; index <= 999; index += 1) {
      const id = numericTestId(index);
      if (typeof onProgress === "function") {
        onProgress(id);
      }
      let response;
      try {
        response = await fetch(testPathFromBase(id), { cache: "no-store" });
      } catch (error) {
        throw new Error(
          "Finding an open numeric test slot requires the pages to be served over HTTP.",
        );
      }
      if (response.status === 404) {
        return id;
      }
      if (!response.ok) {
        throw new Error(
          testPathFromBase(id) + " returned HTTP " + response.status + ".",
        );
      }
    }
    throw new Error("No available numeric test slot was found.");
  }

  async function fetchTextFile(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Could not load " + path + ".");
    }
    return response.text();
  }

  function parseKeyText(text) {
    let parsed;
    try {
      parsed = JSON.parse(String(text || "").trim());
    } catch (error) {
      throw new Error("The key text is not valid JSON.");
    }
    return parsed;
  }

  function getPublicJwk(keyTextOrObject) {
    const parsed =
      typeof keyTextOrObject === "string"
        ? parseKeyText(keyTextOrObject)
        : keyTextOrObject;
    const publicKeyJwk =
      parsed.publicKeyJwk ||
      parsed.publicKey ||
      parsed.keys?.publicKeyJwk ||
      (parsed.kty === "RSA" ? parsed : null);
    if (!publicKeyJwk || publicKeyJwk.kty !== "RSA") {
      throw new Error("A valid RSA public key was not found.");
    }
    return publicKeyJwk;
  }

  function getPrivateJwk(keyTextOrObject) {
    const parsed =
      typeof keyTextOrObject === "string"
        ? parseKeyText(keyTextOrObject)
        : keyTextOrObject;
    const privateKeyJwk =
      parsed.privateKeyJwk ||
      parsed.privateKey ||
      parsed.keys?.privateKeyJwk ||
      (parsed.kty === "RSA" && parsed.d ? parsed : null);
    if (!privateKeyJwk || privateKeyJwk.kty !== "RSA") {
      throw new Error("A valid RSA private key was not found.");
    }
    return privateKeyJwk;
  }

  function publicKeyTextFromKeyDetails(keyDetailsText) {
    getPrivateJwk(keyDetailsText);
    return JSON.stringify(
      {
        format: PUBLIC_KEY_FORMAT,
        publicKeyJwk: getPublicJwk(keyDetailsText),
      },
      null,
      2,
    );
  }

  async function importPublicKey(keyTextOrObject) {
    requireCrypto();
    return window.crypto.subtle.importKey(
      "jwk",
      getPublicJwk(keyTextOrObject),
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"],
    );
  }

  async function importPrivateKey(keyTextOrObject) {
    requireCrypto();
    return window.crypto.subtle.importKey(
      "jwk",
      getPrivateJwk(keyTextOrObject),
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["decrypt"],
    );
  }

  async function encryptTextWithPublicKeyObject(title, plaintext, publicKey) {
    requireCrypto();
    const aesKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
    const encryptedKey = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      rawAesKey,
    );
    const iv = randomBytes(12);
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      textEncoder.encode(plaintext),
    );

    const envelope = {
      format: RESULT_FILE_FORMAT,
      algorithm: "RSA-OAEP-256+A256GCM",
      encryptedKey: bytesToBase64(new Uint8Array(encryptedKey)),
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    };
    return (
      String(title || "ENCRYPTED").trim() + "\n" + JSON.stringify(envelope)
    );
  }

  async function encryptTextWithPublicKey(title, plaintext, publicKeyText) {
    const publicKey = await importPublicKey(publicKeyText);
    return encryptTextWithPublicKeyObject(title, plaintext, publicKey);
  }

  async function decryptTextWithPrivateKey(text, privateKeyText) {
    const encoded = splitEncodedFile(text);
    const envelope = JSON.parse(encoded.body);
    if (envelope.format !== RESULT_FILE_FORMAT) {
      throw new Error(
        "This file is not encrypted with the current result format.",
      );
    }

    const privateKey = await importPrivateKey(privateKeyText);
    const rawAesKey = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      base64ToBytes(envelope.encryptedKey),
    );
    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      rawAesKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );
    const plaintext = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(envelope.iv) },
      aesKey,
      base64ToBytes(envelope.ciphertext),
    );
    return textDecoder.decode(plaintext);
  }

  async function encryptPayloadWithPublicKey(title, payload, publicKeyText) {
    return encryptTextWithPublicKey(
      title,
      JSON.stringify(payload),
      publicKeyText,
    );
  }

  async function decryptPayloadWithPrivateKey(
    text,
    privateKeyText,
    expectedType,
  ) {
    const plaintext = await decryptTextWithPrivateKey(text, privateKeyText);
    const payload = JSON.parse(plaintext);
    if (expectedType && payload.type !== expectedType) {
      throw new Error("The file is not a " + expectedType + " file.");
    }
    return { payload };
  }

  function answerStringFromQuestions(questions) {
    return (questions || [])
      .map((question) =>
        optionLetter(Number.parseInt(question.correctIndex, 10) || 0),
      )
      .join("");
  }

  function applySecureMaterials(test, securePayload) {
    if (!test || !securePayload) {
      return test;
    }
    const answers = String(securePayload.answers || "");
    const explanations = Array.isArray(securePayload.explanations)
      ? securePayload.explanations
      : [];
    test.questions.forEach((question, index) => {
      const answerIndex = answers.charCodeAt(index) - 65;
      if (answerIndex >= 0 && answerIndex < question.optionCount) {
        question.correctIndex = answerIndex;
      }
      if (Object.prototype.hasOwnProperty.call(explanations, index)) {
        question.explanationMarkdown = String(explanations[index] || "");
      }
    });
    return test;
  }

  async function unlockSecureMaterials(test, privateKeyText) {
    if (!test || !test.secureMaterial) {
      return test;
    }
    const decoded = await decryptPayloadWithPrivateKey(
      test.secureMaterial,
      privateKeyText,
      SECURE_MATERIAL_FORMAT,
    );
    applySecureMaterials(test, decoded.payload);
    test.secureMaterialUnlocked = true;
    return test;
  }

  async function generateKeyFiles() {
    requireCrypto();
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"],
    );
    const publicKeyJwk = await window.crypto.subtle.exportKey(
      "jwk",
      keyPair.publicKey,
    );
    const privateKeyJwk = await window.crypto.subtle.exportKey(
      "jwk",
      keyPair.privateKey,
    );
    const publicKeyFile = JSON.stringify(
      { format: PUBLIC_KEY_FORMAT, publicKeyJwk },
      null,
      2,
    );
    const keyDetailsFile = JSON.stringify(
      {
        format: KEY_DETAILS_FORMAT,
        instructions: [
          "Keep this file safe. It contains the private key needed to analyse student results.",
          "Upload publickey.txt and keytest.txt to the web app root.",
          "Do not upload keydetails.txt to the web app root.",
        ],
        publicKeyJwk,
        privateKeyJwk,
      },
      null,
      2,
    );
    const keytestFile = await encryptTextWithPublicKeyObject(
      "KEYTEST",
      "ACCESS GRANTED",
      keyPair.publicKey,
    );
    return {
      publicKeyFile,
      keytestFile,
      keyDetailsFile,
    };
  }

  function escapeJsonToPrintable(json) {
    return json.replace(/[^\x20-\x7E]/g, (char) => {
      const code = char.charCodeAt(0).toString(16).padStart(4, "0");
      return "\\u" + code;
    });
  }

  function keyShift(key, index) {
    if (!key) {
      return 0;
    }

    const code = key.charCodeAt(index % key.length);
    if (code >= PRINTABLE_START && code <= PRINTABLE_END) {
      return code - PRINTABLE_START + 1;
    }
    return (code % PRINTABLE_RANGE) + 1;
  }

  function rotatePrintable(text, key, direction) {
    if (!key || !key.trim()) {
      throw new Error("A non-empty title is required for encoding.");
    }

    let output = "";
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      if (code < PRINTABLE_START || code > PRINTABLE_END) {
        output += text[index];
        continue;
      }

      const shift = keyShift(key, index) * direction;
      const normalized = code - PRINTABLE_START;
      const rotated =
        (normalized + shift + PRINTABLE_RANGE * 4) % PRINTABLE_RANGE;
      output += String.fromCharCode(rotated + PRINTABLE_START);
    }
    return output;
  }

  function encodePayload(title, payload) {
    const cleanTitle = String(title || "").trim();
    const json = escapeJsonToPrintable(JSON.stringify(payload));
    return cleanTitle + "\n" + rotatePrintable(json, cleanTitle, 1);
  }

  function splitEncodedFile(text) {
    const normalized = String(text || "").replace(/^\uFEFF/, "");
    const newlineIndex = normalized.search(/\r?\n/);
    if (newlineIndex < 0) {
      throw new Error("The file does not contain an encoded payload.");
    }

    const title = normalized.slice(0, newlineIndex).trim();
    const body = normalized
      .slice(
        normalized[newlineIndex] === "\r" ? newlineIndex + 2 : newlineIndex + 1,
      )
      .replace(/[\r\n]+$/g, "");
    if (!title || !body) {
      throw new Error("The file is missing its title or encoded payload.");
    }
    return { title, body };
  }

  function decodePayload(text, expectedType) {
    const encoded = splitEncodedFile(text);
    const json = rotatePrintable(encoded.body, encoded.title, -1);
    const payload = JSON.parse(json);
    if (expectedType && payload.type !== expectedType) {
      throw new Error("The file is not a " + expectedType + " file.");
    }
    return { fileTitle: encoded.title, payload };
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeLinkTarget(url) {
    const value = String(url || "").trim();
    if (/^(https?:|mailto:)/i.test(value)) {
      return value;
    }
    return "";
  }

  function renderMathExpression(latex, displayMode) {
    const source = String(latex || "").trim();
    if (!source) {
      return "";
    }
    if (window.katex && typeof window.katex.renderToString === "function") {
      try {
        return window.katex.renderToString(source, {
          displayMode: Boolean(displayMode),
          throwOnError: false,
        });
      } catch (error) {
        // Fall back to escaped source if KaTeX cannot render this expression.
      }
    }
    return '<code class="math-fallback">' + escapeHtml(source) + "</code>";
  }

  function inlineMarkdownToHtml(text) {
    const tokens = [];
    const remember = (html) => {
      const token = "\u0000" + tokens.length + "\u0000";
      tokens.push(html);
      return token;
    };

    let value = String(text || "");
    value = value.replace(/`([^`]+)`/g, (_, code) =>
      remember("<code>" + escapeHtml(code) + "</code>"),
    );
    value = value.replace(
      /!\[([^\]]*)\]\((data:image\/[^)\s]+)\)/gi,
      (_, alt, src) => {
        return remember(
          '<img class="markdown-image" alt="' +
            escapeHtml(alt) +
            '" src="' +
            escapeHtml(src) +
            '">',
        );
      },
    );
    value = value.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
      const target = safeLinkTarget(url);
      if (!target) {
        return escapeHtml(label);
      }
      return remember(
        '<a href="' +
          escapeHtml(target) +
          '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(label) +
          "</a>",
      );
    });
    value = value.replace(/\$([^$\n]+)\$/g, (_, latex) =>
      remember(renderMathExpression(latex, false)),
    );

    value = escapeHtml(value);
    value = value
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
      .replace(/_([^_]+)_/g, "<em>$1</em>");

    tokens.forEach((html, index) => {
      value = value.replaceAll("\u0000" + index + "\u0000", html);
    });
    return value;
  }

  function markdownToHtml(markdown) {
    const lines = String(markdown || "")
      .replace(/\r\n?/g, "\n")
      .split("\n");
    const blocks = [];
    let index = 0;

    const flushParagraph = (parts) => {
      if (parts.length) {
        blocks.push("<p>" + inlineMarkdownToHtml(parts.join(" ")) + "</p>");
      }
    };

    while (index < lines.length) {
      const line = lines[index];
      const trimmed = line.trim();
      if (!trimmed) {
        index += 1;
        continue;
      }

      if (trimmed === "$$") {
        index += 1;
        const mathLines = [];
        while (index < lines.length && lines[index].trim() !== "$$") {
          mathLines.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) {
          index += 1;
        }
        blocks.push(
          '<div class="math-block">' +
            renderMathExpression(mathLines.join("\n"), true) +
            "</div>",
        );
        continue;
      }

      const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
      if (heading) {
        const level = heading[1].length + 2;
        blocks.push(
          "<h" +
            level +
            ">" +
            inlineMarkdownToHtml(heading[2]) +
            "</h" +
            level +
            ">",
        );
        index += 1;
        continue;
      }

      if (/^[-*]\s+/.test(trimmed)) {
        const items = [];
        while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
          items.push(
            "<li>" +
              inlineMarkdownToHtml(
                lines[index].trim().replace(/^[-*]\s+/, ""),
              ) +
              "</li>",
          );
          index += 1;
        }
        blocks.push("<ul>" + items.join("") + "</ul>");
        continue;
      }

      if (/^\d+\.\s+/.test(trimmed)) {
        const items = [];
        while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
          items.push(
            "<li>" +
              inlineMarkdownToHtml(
                lines[index].trim().replace(/^\d+\.\s+/, ""),
              ) +
              "</li>",
          );
          index += 1;
        }
        blocks.push("<ol>" + items.join("") + "</ol>");
        continue;
      }

      if (/^>\s+/.test(trimmed)) {
        const quote = [];
        while (index < lines.length && /^>\s+/.test(lines[index].trim())) {
          quote.push(lines[index].trim().replace(/^>\s+/, ""));
          index += 1;
        }
        blocks.push(
          "<blockquote>" +
            inlineMarkdownToHtml(quote.join(" ")) +
            "</blockquote>",
        );
        continue;
      }

      const paragraph = [trimmed];
      index += 1;
      while (
        index < lines.length &&
        lines[index].trim() &&
        !/^(#{1,3})\s+/.test(lines[index].trim()) &&
        !/^[-*]\s+/.test(lines[index].trim()) &&
        !/^\d+\.\s+/.test(lines[index].trim()) &&
        !/^>\s+/.test(lines[index].trim()) &&
        lines[index].trim() !== "$$"
      ) {
        paragraph.push(lines[index].trim());
        index += 1;
      }
      flushParagraph(paragraph);
    }

    return blocks.join("\n");
  }

  function renderMarkdown(container, markdown) {
    container.classList.add("markdown-content");
    container.innerHTML = markdownToHtml(markdown);
  }

  function optionLetter(index) {
    return String.fromCharCode(65 + index);
  }

  function optionLetters(count) {
    return Array.from({ length: count }, (_, index) => optionLetter(index));
  }

  function clampOptionCount(value) {
    const count = Number.parseInt(value, 10);
    if (Number.isNaN(count)) {
      return 4;
    }
    return Math.max(2, Math.min(26, count));
  }

  function normalizeQuestion(question) {
    const optionCount = clampOptionCount(
      question.optionCount || question.options || 4,
    );
    const optionImages = Array.isArray(question.optionImages)
      ? question.optionImages.slice(0, optionCount)
      : [];
    const optionMarkdown = Array.isArray(question.optionMarkdown)
      ? question.optionMarkdown.slice(0, optionCount)
      : [];
    let correctIndex = Number.isInteger(question.correctIndex)
      ? question.correctIndex
      : Number.parseInt(question.correct || 0, 10) || 0;
    if (correctIndex < 0 || correctIndex >= optionCount) {
      correctIndex = 0;
    }
    while (optionImages.length < optionCount) {
      optionImages.push("");
    }
    while (optionMarkdown.length < optionCount) {
      optionMarkdown.push("");
    }

    return {
      imageName: question.imageName || "Question image",
      imageType: question.imageType || "",
      imageData: question.imageData || question.image || "",
      questionMarkdown: String(
        question.questionMarkdown || question.markdown || "",
      ),
      optionCount,
      correctIndex,
      optionImages,
      optionMarkdown: optionMarkdown.map((value) => String(value || "")),
      explanationMarkdown: String(
        question.explanationMarkdown || question.explanation || "",
      ),
      showLetterPrefixes: question.showLetterPrefixes === false ? false : true,
    };
  }

  function normalizeTest(payload) {
    if (!payload || !Array.isArray(payload.questions)) {
      throw new Error("The test file does not contain any questions.");
    }

    return {
      version: payload.version || 1,
      type: payload.type || "unitester-test",
      title: String(payload.title || "Untitled test"),
      instructions: String(payload.instructions || ""),
      endInstructions: String(
        payload.endInstructions || defaultEndInstructions(),
      ),
      activityMode: payload.activityMode === "review" ? "review" : "test",
      guideTimeMinutes: Math.max(
        0,
        Number.parseInt(payload.guideTimeMinutes, 10) || 0,
      ),
      timerEnforcement: ["enforce-test-informational-review", "informational-only", "enforce-always", "disabled"].includes(payload.timerEnforcement)
        ? payload.timerEnforcement
        : "enforce-test-informational-review",
      extraTimeOption: ["allow-25-percent", "allow-10-percent", "disallow"].includes(payload.extraTimeOption)
        ? payload.extraTimeOption
        : "allow-25-percent",
      secureMaterial: String(payload.secureMaterial || ""),
      resultPublicKey: String(payload.resultPublicKey || ""),
      questions: payload.questions.map(normalizeQuestion),
    };
  }

  function renderQuestionView(container, question, options) {
    const settings = options || {};
    const normalized = normalizeQuestion(question);
    const selectedIndex = Number.isInteger(settings.selectedIndex)
      ? settings.selectedIndex
      : null;
    const groupName =
      settings.groupName || "question-" + Math.random().toString(36).slice(2);
    const disabled = Boolean(settings.disabled);
    const correctIndex = Number.isInteger(settings.correctIndex)
      ? settings.correctIndex
      : null;
    const showCorrectAnswer = Boolean(settings.showCorrectAnswer);
    const showFeedback = Boolean(settings.showFeedback);

    container.replaceChildren();

    if (normalized.questionMarkdown.trim()) {
      const markdownWrap = document.createElement("div");
      markdownWrap.className = "question-markdown markdown-content";
      renderMarkdown(markdownWrap, normalized.questionMarkdown);
      container.appendChild(markdownWrap);
    }

    if (normalized.imageData) {
      const imageWrap = document.createElement("div");
      imageWrap.className = "question-image-wrap";

      const image = document.createElement("img");
      image.className = "question-image";
      image.alt = normalized.imageName;
      image.src = normalized.imageData;
      imageWrap.appendChild(image);
      container.appendChild(imageWrap);
    }

    const optionsWrap = document.createElement("div");
    optionsWrap.className = "answer-options";
    optionsWrap.setAttribute("role", "radiogroup");

    optionLetters(normalized.optionCount).forEach((letter, index) => {
      const label = document.createElement("label");
      label.className = "answer-option";
      if (
        correctIndex === index &&
        (showCorrectAnswer || (showFeedback && selectedIndex === index))
      ) {
        label.classList.add("is-correct");
      }
      if (
        showFeedback &&
        selectedIndex === index &&
        correctIndex !== null &&
        correctIndex !== index
      ) {
        label.classList.add("is-incorrect");
      }

      const input = document.createElement("input");
      input.type = "radio";
      input.name = groupName;
      input.value = String(index);
      input.checked = selectedIndex === index;
      input.disabled = disabled;
      input.addEventListener("change", () => {
        if (typeof settings.onChange === "function") {
          settings.onChange(index);
        }
      });

      const marker = document.createElement("span");
      marker.className = "answer-marker";
      marker.textContent = letter;

      if (normalized.showLetterPrefixes !== false) {
        label.append(input, marker);
      } else {
        label.append(input);
      }

      if (normalized.optionImages[index]) {
        const snippet = document.createElement("img");
        snippet.className = "answer-snippet";
        snippet.alt = "Option " + letter;
        snippet.src = normalized.optionImages[index];
        label.appendChild(snippet);
      }

      if (normalized.optionMarkdown[index].trim()) {
        const markdown = document.createElement("div");
        markdown.className = "answer-option-markdown markdown-content";
        renderMarkdown(markdown, normalized.optionMarkdown[index]);
        label.appendChild(markdown);
      }

      if (showFeedback && selectedIndex === index && correctIndex !== null) {
        const feedback = document.createElement("span");
        feedback.className = "answer-feedback";
        feedback.textContent = correctIndex === index ? "✓" : "✗";
        label.appendChild(feedback);
      }

      optionsWrap.appendChild(label);
    });

    container.appendChild(optionsWrap);
  }

  function sanitizeFilePart(value) {
    const cleaned = String(value || "")
      .trim()
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "");
    return cleaned || "untitled";
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    downloadBlob(filename, blob);
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function readFileAsText(file) {
    return file.text();
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () =>
        reject(reader.error || new Error("Could not read file."));
      reader.readAsDataURL(blob);
    });
  }

  function imageMimeFromName(name) {
    const lower = name.toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".bmp")) return "image/bmp";
    if (lower.endsWith(".svg")) return "image/svg+xml";
    return "application/octet-stream";
  }

  async function fileToImageQuestion(file) {
    const dataUrl = await blobToDataUrl(file);
    return {
      imageName: file.name || "question-image",
      imageType: file.type || imageMimeFromName(file.name || ""),
      imageData: dataUrl,
      questionMarkdown: "",
      optionCount: 4,
      correctIndex: 0,
      optionImages: [],
      optionMarkdown: [],
    };
  }

  async function discoverTests(onProgress) {
    const tests = [];
    for (let index = 1; index <= 999; index += 1) {
      const id = numericTestId(index);
      const path = testPathFromBase(id);
      if (typeof onProgress === "function") {
        onProgress(id);
      }

      let response;
      try {
        response = await fetch(path, { cache: "no-store" });
      } catch (error) {
        throw new Error(
          "Test discovery requires the pages to be served over HTTP.",
        );
      }

      if (response.status === 404) {
        break;
      }
      if (!response.ok) {
        throw new Error(path + " returned HTTP " + response.status + ".");
      }

      const text = await response.text();
      const firstLine = text
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/, 1)[0]
        .trim();
      tests.push({
        id,
        base: id,
        filename: id + ".txt",
        path,
        title: firstLine || "Test " + id,
      });
    }
    return tests;
  }

  async function fetchTest(testId, password) {
    return fetchEncryptedTest(testId, password);
  }

  function getUint16(view, offset) {
    return view.getUint16(offset, true);
  }

  function getUint32(view, offset) {
    return view.getUint32(offset, true);
  }

  function findEndOfCentralDirectory(view) {
    const minOffset = Math.max(0, view.byteLength - 65557);
    for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
      if (getUint32(view, offset) === 0x06054b50) {
        return offset;
      }
    }
    throw new Error("Could not find the ZIP directory.");
  }

  async function inflateRaw(data) {
    if (!("DecompressionStream" in window)) {
      throw new Error("This browser cannot decompress deflated ZIP files.");
    }

    const formats = ["deflate-raw", "deflate"];
    let lastError = null;
    for (const format of formats) {
      try {
        const stream = new Blob([data])
          .stream()
          .pipeThrough(new DecompressionStream(format));
        const buffer = await new Response(stream).arrayBuffer();
        return new Uint8Array(buffer);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("Could not decompress ZIP entry.");
  }

  async function readZipEntries(file) {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const decoder = new TextDecoder();
    const eocdOffset = findEndOfCentralDirectory(view);
    const totalEntries = getUint16(view, eocdOffset + 10);
    let centralOffset = getUint32(view, eocdOffset + 16);
    const entries = [];

    for (let entryIndex = 0; entryIndex < totalEntries; entryIndex += 1) {
      if (getUint32(view, centralOffset) !== 0x02014b50) {
        throw new Error("The ZIP central directory is not readable.");
      }

      const flags = getUint16(view, centralOffset + 8);
      const method = getUint16(view, centralOffset + 10);
      const compressedSize = getUint32(view, centralOffset + 20);
      const uncompressedSize = getUint32(view, centralOffset + 24);
      const nameLength = getUint16(view, centralOffset + 28);
      const extraLength = getUint16(view, centralOffset + 30);
      const commentLength = getUint16(view, centralOffset + 32);
      const localOffset = getUint32(view, centralOffset + 42);
      const nameBytes = bytes.slice(
        centralOffset + 46,
        centralOffset + 46 + nameLength,
      );
      const name = decoder.decode(nameBytes);
      centralOffset += 46 + nameLength + extraLength + commentLength;

      if (name.endsWith("/")) {
        continue;
      }
      if ((flags & 1) === 1) {
        throw new Error(
          name + " is encrypted. Please use an unencrypted ZIP file.",
        );
      }
      if (getUint32(view, localOffset) !== 0x04034b50) {
        throw new Error(name + " has an unreadable local ZIP header.");
      }

      const localNameLength = getUint16(view, localOffset + 26);
      const localExtraLength = getUint16(view, localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      let data;
      if (method === 0) {
        data = compressed;
      } else if (method === 8) {
        data = await inflateRaw(compressed);
      } else {
        throw new Error(name + " uses an unsupported ZIP compression method.");
      }

      if (uncompressedSize && data.byteLength !== uncompressedSize) {
        throw new Error(name + " did not decompress to the expected size.");
      }
      entries.push({ name, data });
    }

    return entries.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  }

  async function zipImagesToQuestions(file) {
    const entries = await readZipEntries(file);
    const questions = [];
    for (const entry of entries) {
      if (!IMAGE_EXTENSIONS.test(entry.name)) {
        continue;
      }
      const blob = new Blob([entry.data], {
        type: imageMimeFromName(entry.name),
      });
      const dataUrl = await blobToDataUrl(blob);
      questions.push({
        imageName: entry.name,
        imageType: blob.type,
        imageData: dataUrl,
        questionMarkdown: "",
        optionCount: 4,
        correctIndex: 0,
        optionImages: [],
        optionMarkdown: [],
      });
    }
    return questions;
  }

  async function zipTextEntries(file) {
    const entries = await readZipEntries(file);
    const decoder = new TextDecoder();
    return entries
      .filter((entry) => entry.name.toLowerCase().endsWith(".txt"))
      .map((entry) => ({ name: entry.name, text: decoder.decode(entry.data) }));
  }

  function formatDateTime(value) {
    if (!value) {
      return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function csvEscape(value) {
    const text = value == null ? "" : String(value);
    if (/[",\r\n]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  function defaultEndInstructions() {
    return "Well done on completing this activity.\nPlease keep your test file for later review.";
  }

  function setStatus(element, message, tone) {
    if (!element) {
      return;
    }
    element.textContent = message || "";
    element.className = "status-line";
    if (tone) {
      element.classList.add("status-" + tone);
    }
  }

  window.Unitester = {
    clampOptionCount,
    csvEscape,
    answerStringFromQuestions,
    applySecureMaterials,
    defaultEndInstructions,
    decodePayload,
    discoverTests,
    discoverTestsWithPassword,
    downloadBlob,
    downloadText,
    encodePayload,
    encryptPayloadWithPublicKey,
    encryptTestPayload,
    decryptPayloadWithPrivateKey,
    decryptTestPayload,
    decryptTextWithPrivateKey,
    browseOpenTests,
    blobToDataUrl,
    fetchTest,
    fetchTextFile,
    fileToImageQuestion,
    findNamedTest,
    findNextOpenTestId,
    formatDateTime,
    generateKeyFiles,
    normalizeQuestion,
    normalizeTest,
    normaliseTestNameToBase,
    optionLetter,
    optionLetters,
    readFileAsText,
    renderMarkdown,
    markdownToHtml,
    renderQuestionView,
    publicKeyTextFromKeyDetails,
    sanitizeFilePart,
    setStatus,
    testPasswordFromBase,
    testPathFromBase,
    unlockSecureMaterials,
    zipImagesToQuestions,
    zipTextEntries,
  };
})();
