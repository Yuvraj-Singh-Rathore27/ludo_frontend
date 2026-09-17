// Browser helpers that keep working when the site is NOT served over https.
//
// Chrome only exposes some APIs in a "secure context" (https, or localhost during
// development). Production is served over plain http (dev-api.dabafantasy.com:3000),
// so `navigator.clipboard` and `crypto.randomUUID` are simply missing there — which is
// why copying a room code threw "Cannot read properties of undefined (reading
// 'writeText')" in production while working perfectly on localhost.

// Copies text to the clipboard. Returns true on success.
// Uses the modern API when it exists, and falls back to the old execCommand path
// (a hidden textarea + document.execCommand('copy')) which works on http too.
export const copyText = async text => {
    const value = String(text ?? '');
    if (!value) return false;

    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(value);
            return true;
        } catch {
            /* blocked (no permission, not focused, http) — fall through */
        }
    }

    try {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        // Keep it off-screen but still selectable, and don't scroll the page on iOS.
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, value.length); // iOS needs the explicit range
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        return copied;
    } catch {
        return false;
    }
};

// Random id for request idempotency keys. crypto.randomUUID() is secure-context only,
// while crypto.getRandomValues() is available everywhere, so this produces a proper
// random v4 UUID on http as well, and only falls back to Math.random if neither exists.
export const randomId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0'));
    return [
        hex.slice(0, 4).join(''),
        hex.slice(4, 6).join(''),
        hex.slice(6, 8).join(''),
        hex.slice(8, 10).join(''),
        hex.slice(10, 16).join(''),
    ].join('-');
};
