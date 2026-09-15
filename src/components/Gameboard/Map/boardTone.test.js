import { toneColor, toneBoardPixels, BOARD_PALETTE } from './boardTone';

const within = (actual, expected, tolerance = 2) =>
    actual.forEach((v, i) => expect(Math.abs(v - expected[i])).toBeLessThanOrEqual(tolerance));

describe('boardTone', () => {
    it.each([
        ['red', [255, 0, 0]],
        ['yellow', [255, 255, 0]],
        ['green', [0, 255, 0]],
        ['cyan', [0, 216, 255]],
    ])('should repaint flat neon %s as the calm palette colour', (family, rgb) => {
        within(toneColor(...rgb), BOARD_PALETTE[family], 12);
    });

    it('should turn pure white into the soft off-white and keep black lines black', () => {
        expect(toneColor(255, 255, 255)).toEqual(BOARD_PALETTE.white);
        expect(toneColor(0, 0, 0)).toEqual([0, 0, 0]);
    });

    // Regression: the first version filtered in HSL, which treated faint JPEG tints in
    // the white cells as "highly saturated" and turned them into rainbow speckles.
    it('should render JPEG colour noise in white cells as plain off-white, not speckles', () => {
        const noisyWhites = [
            [255, 238, 250], // faint pink
            [236, 255, 240], // faint green
            [240, 246, 255], // faint blue
            [255, 252, 233], // faint yellow
        ];
        noisyWhites.forEach(rgb => {
            const [r, g, b] = toneColor(...rgb);
            // Same cool off-white ramp as pure white — no colour of its own.
            expect(Math.abs(r / BOARD_PALETTE.white[0] - g / BOARD_PALETTE.white[1])).toBeLessThan(0.02);
            expect(Math.abs(g / BOARD_PALETTE.white[1] - b / BOARD_PALETTE.white[2])).toBeLessThan(0.02);
            expect(r).toBeGreaterThan(215);
        });
    });

    it('should treat coloured ringing next to black lines (blue/magenta) as neutral', () => {
        const [r, g, b] = toneColor(90, 40, 120); // purple-ish ringing
        expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(10);
    });

    it('should keep anti-aliased edges soft: a half green/half white pixel stays between the two', () => {
        const [r, g, b] = toneColor(128, 255, 128);
        const green = BOARD_PALETTE.green;
        const white = BOARD_PALETTE.white;
        [r, g, b].forEach((v, i) => {
            expect(v).toBeGreaterThanOrEqual(Math.min(green[i], white[i]) - 2);
            expect(v).toBeLessThanOrEqual(Math.max(green[i], white[i]) + 2);
        });
    });

    it('should repaint an RGBA buffer in place and never touch alpha', () => {
        const data = new Uint8ClampedArray([0, 255, 0, 200, 255, 255, 255, 255]);
        toneBoardPixels(data);
        expect(data[3]).toBe(200);
        expect(data[7]).toBe(255);
        expect([data[0], data[1], data[2]]).not.toEqual([0, 255, 0]);
    });
});
