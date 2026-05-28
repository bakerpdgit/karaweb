// Tiny clipboard helper. Prefers the modern async Clipboard API, falls
// back to the legacy textarea + execCommand trick on browsers where the
// async API is unavailable (http:// non-localhost contexts in particular).
//
// Returns a Promise<boolean> — true if the copy succeeded.

export async function copyToClipboard(text) {
  const str = String(text ?? '');
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(str);
      return true;
    }
  } catch {
    // Fall through to the legacy path below.
  }
  try {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = str;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return !!ok;
  } catch {
    return false;
  }
}
