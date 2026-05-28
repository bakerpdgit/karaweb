// Generates a per-teacher Apps Script source by substituting placeholders
// in the template. Pure: returns a string, no side effects.

import { APPS_SCRIPT_TEMPLATE } from "./appsScriptTemplate.js";
import { computeAdminTokenHash } from "./adminToken.js";
import { derivePubFingerprint } from "../pubFingerprint.js";

const DEFAULT_PROXY_URL = "https://karaweb-turnstile-proxy.bakerpd.workers.dev";

const RE_LS = new RegExp("\\u2028", "g");
const RE_PS = new RegExp("\\u2029", "g");

/**
 * @param opts.publicKeyJwk        teacher's RSA public JWK (`n`, `e`, `kty`)
 * @param opts.privateKeyJwk       teacher's RSA private JWK; used only to
 *                                 derive the inner admin-token hash.
 * @param opts.submissionVerifier  optional base64 PBKDF2 of the
 *                                 teacher's keydetails password. When
 *                                 set, baked into the generated script
 *                                 and required on every teacher fetch.
 *                                 Empty/null → no enforcement.
 * @param opts.turnstileRequired   boolean (default true)
 * @param opts.verifyProxyUrl      URL of the karaweb Cloudflare Worker
 */
export async function generateAppsScript(opts) {
  if (!opts?.publicKeyJwk?.n) throw new Error("publicKeyJwk.n required");
  if (!opts?.privateKeyJwk?.d) throw new Error("privateKeyJwk.d required");

  const turnstileRequired = opts.turnstileRequired !== false;
  const verifyProxyUrl = opts.verifyProxyUrl || DEFAULT_PROXY_URL;
  const adminTokenHash = await computeAdminTokenHash(opts.privateKeyJwk);
  const submissionVerifier = opts.submissionVerifier
    ? String(opts.submissionVerifier)
    : "";
  const publicKeyFp = await derivePubFingerprint(opts.publicKeyJwk);

  return APPS_SCRIPT_TEMPLATE.replace(
    /__TEACHER_PUBLIC_KEY_FP__/g,
    jsStr(publicKeyFp),
  )
    .replace(/__ADMIN_TOKEN_HASH__/g, jsStr(adminTokenHash))
    .replace(/__SUBMISSION_VERIFIER__/g, jsStr(submissionVerifier))
    .replace(/__VERIFY_PROXY_URL__/g, jsStr(verifyProxyUrl))
    .replace(/__TURNSTILE_REQUIRED__/g, String(turnstileRequired))
    .replace(/__GENERATED_AT__/g, jsStr(new Date().toISOString()));
}

function jsStr(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(RE_LS, "\\u2028")
    .replace(RE_PS, "\\u2029");
}
