// Repaints the board artwork in a calmer palette that is easy on the eyes against the
// dark game UI. Runs ONCE on the pre-rendered background canvas (see buildBackground
// in Map.jsx): purely visual, pawn positions and hit areas are untouched, and pawn
// tokens are drawn afterwards at full colour so they stand out on the calmer board.
//
// Why a palette remap and not a saturation/HSL filter: map.jpg is a flat-colour design
// (four pure colours, white cells, black lines) saved as JPEG, so its "white" cells
// carry faint colour noise and every black line has coloured ringing. HSL saturation
// treats a near-white pixel with a tiny tint as highly saturated, so filtering in HSL
// amplified that noise into visible rainbow speckles.
//
// Instead, every pixel is read as a mix of ONE board colour and a grey:
//   pixel = amount × boardColour + (1 − amount) × grey
// For the four board colours (each has a channel at 0) that split is exact:
//   amount = (max − min) / 255,   grey = min / (1 − amount)
// The pixel is then rebuilt from the target palette with the same amount and grey.
// Faint tints (JPEG noise) fall under a small threshold and become clean neutral, flat
// areas come out perfectly flat, and anti-aliased edges keep their exact softness.

// Target palette — softened, slightly deeper tones that sit well on a dark background.
export const BOARD_PALETTE = {
    red: [214, 64, 60],
    yellow: [236, 194, 52],
    green: [64, 170, 96],
    cyan: [48, 164, 204],
    // What pure white becomes (a soft, faintly cool off-white). Black stays black.
    white: [234, 237, 242],
};

// Below this much colour (0-255 channel spread) a pixel is treated as neutral — it is
// JPEG noise or line ringing, not board colour.
const NOISE_CHROMA = 26;

// Which board colour a tinted pixel belongs to, by hue. Hues the board never uses
// (blue/magenta) only ever come from ringing, so they are treated as neutral.
const familyForHue = hue => {
    if (hue < 25 || hue >= 330) return 'red';
    if (hue < 80) return 'yellow';
    if (hue < 160) return 'green';
    if (hue < 225) return 'cyan';
    return null;
};

const hueOf = (r, g, b, max, min) => {
    const d = max - min;
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    return h < 0 ? h + 360 : h;
};

const clamp255 = v => (v < 0 ? 0 : v > 255 ? 255 : v);

// Repaints one RGB colour (0-255 channels). Exported for tests.
export const toneColor = (r, g, b, palette = BOARD_PALETTE) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    const white = palette.white;

    const family = chroma > NOISE_CHROMA ? familyForHue(hueOf(r, g, b, max, min)) : null;
    if (!family) {
        // Neutral: map its grey level onto the black → off-white ramp.
        const t = (max + min) / 2 / 255;
        return [Math.round(white[0] * t), Math.round(white[1] * t), Math.round(white[2] * t)];
    }

    const exactAmount = chroma / 255;
    // Grey part of the mix (see header). Near-full colour has no grey left to measure.
    const grey = exactAmount >= 0.98 ? 0 : clamp255(min / (1 - exactAmount)) / 255;
    // Ease the colour in from the noise threshold so there is no visible step.
    const amount = Math.min(1, (chroma - NOISE_CHROMA) / (255 - NOISE_CHROMA - 15));
    const target = palette[family];

    return [0, 1, 2].map(i => Math.round(clamp255(amount * target[i] + (1 - amount) * white[i] * grey)));
};

// Repaints an ImageData-style RGBA buffer in place (alpha untouched).
export const toneBoardPixels = (data, palette = BOARD_PALETTE) => {
    for (let i = 0; i < data.length; i += 4) {
        const [r, g, b] = toneColor(data[i], data[i + 1], data[i + 2], palette);
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
    }
    return data;
};

// Safe-square stars: warm amber that reads on off-white and on the softened yellow
// home column, with a firm dark outline.
export const STAR_FILL = '#f2ad2e';
export const STAR_STROKE = 'rgba(70, 38, 0, 0.7)';
