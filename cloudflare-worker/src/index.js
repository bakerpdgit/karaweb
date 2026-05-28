// karaweb Turnstile verification proxy.
//
// Receives the Turnstile token from a teacher's Apps Script (server-to-
// server via UrlFetchApp.fetch) and asks Cloudflare's siteverify
// endpoint whether the token is real. The Turnstile **secret key** lives
// only in Cloudflare env vars (`wrangler secret put TURNSTILE_SECRET_KEY`)
// — never in client code or in the generated Apps Scripts.
//
// Wire format (POST JSON):
//   { "tkn": "<turnstile_response_token>" }
// Response (JSON):
//   { success: true } | { success: false, errors?: [...] }

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_BODY_BYTES  = 4 * 1024;      // 4 KB upper bound on POST body
const MAX_TOKEN_CHARS = 2 * 1024;      // 2 KB upper bound on the token

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age":       "86400",
};

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...extraHeaders },
  });
}

export default {
  async fetch(request, env) {
    // Preflight, just in case some browser-side caller hits us directly.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "POST") {
      return json({ success: false, error: "method_not_allowed" }, 405);
    }
    if (!env.TURNSTILE_SECRET_KEY) {
      return json({ success: false, error: "secret_not_configured" }, 500);
    }

    let raw;
    try {
      raw = await request.text();
    } catch {
      return json({ success: false, error: "body_read_failed" }, 400);
    }
    if (raw.length > MAX_BODY_BYTES) {
      return json({ success: false, error: "body_too_large" }, 413);
    }

    let token = "";
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      token = String(parsed?.tkn ?? parsed?.token ?? "");
    } catch {
      return json({ success: false, error: "invalid_json" }, 400);
    }
    if (!token || token.length > MAX_TOKEN_CHARS) {
      return json({ success: false, error: "invalid_token" }, 400);
    }

    // Forward to Cloudflare. siteverify accepts either form-encoded or
    // JSON; we use form-encoded for the simpler wire.
    const form = new URLSearchParams();
    form.set("secret",   env.TURNSTILE_SECRET_KEY);
    form.set("response", token);
    let upstream;
    try {
      upstream = await fetch(SITEVERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
    } catch (err) {
      return json({ success: false, error: "siteverify_unreachable", detail: String(err) }, 502);
    }
    if (!upstream.ok) {
      return json({ success: false, error: "siteverify_http_" + upstream.status }, 502);
    }
    let result;
    try {
      result = await upstream.json();
    } catch {
      return json({ success: false, error: "siteverify_non_json" }, 502);
    }
    // Pass through the Cloudflare verdict — adds `success` (bool) and
    // possibly `error-codes`, hostname, action, cdata.
    return json({
      success: !!result.success,
      errors:  result["error-codes"] ?? [],
      hostname: result.hostname,
    });
  },
};
