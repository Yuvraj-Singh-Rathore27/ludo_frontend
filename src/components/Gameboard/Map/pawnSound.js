// Pawn movement sound effects.
//
// Synthesised with the Web Audio API rather than loaded from a file: a token
// hops up to six times in well under a second, and re-triggering one <audio>
// element that fast is unreliable (each hop would cut the previous one off, and
// `currentTime = 0` mid-playback stutters). Oscillators are created per hop, so
// overlapping steps ring naturally and there is no asset to download or decode.
//
// Every entry point is wrapped so that a browser without Web Audio, or one that
// refuses to start a context, silently plays nothing instead of breaking a move.

let audioContext = null;

const getContext = () => {
    if (audioContext) return audioContext;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
        audioContext = new Ctor();
    } catch {
        return null;
    }
    return audioContext;
};

// Browsers start an AudioContext suspended until a user gesture. By the time a
// pawn moves the player has already clicked (roll / move), so resuming here is
// allowed — but it can still reject, hence the catch.
const ready = () => {
    const ctx = getContext();
    if (!ctx) return null;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
};

/**
 * Short percussive "tok" — one per cell a pawn steps onto.
 * `progress` (0..1) walks the pitch up slightly across a multi-cell move so a
 * six reads as a rising run of steps rather than six identical clicks.
 */
export const playStep = (progress = 0) => {
    const ctx = ready();
    if (!ctx) return;
    try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        const base = 430 + progress * 120;
        osc.frequency.setValueAtTime(base, now);
        osc.frequency.exponentialRampToValueAtTime(base * 0.72, now + 0.07);

        // Fast attack, short decay — a tap, not a tone.
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.16, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
    } catch {
        /* never let a sound failure interrupt a move */
    }
};

/** Lower, softer thud for a captured token being sent back to its base. */
export const playCapture = () => {
    const ctx = ready();
    if (!ctx) return;
    try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.26);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.22, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.32);
    } catch {
        /* never let a sound failure interrupt a move */
    }
};
