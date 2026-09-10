// Local player perspective — purely a rendering concern. The underlying game
// state (pawn positions, colors, coordinates) never changes; this only tells
// the UI where things should visually appear for the person looking at THIS
// screen, so their own color always feels like "my side" (bottom-left).

// Canonical (unrotated) board layout — must match the fixed positions.js /
// pawnLogic.js coordinate math: red=TL, yellow=TR, blue=BL, green=BR.
export const CANONICAL_CORNER = { red: 'TL', yellow: 'TR', green: 'BR', blue: 'BL' };

// Clockwise corner cycle — one 90° CSS rotation step moves TL->TR->BR->BL->TL.
const CW_CYCLE = ['TL', 'TR', 'BR', 'BL'];

// How many degrees (clockwise) to rotate the whole board so this color's
// canonical corner lands at bottom-left ("my side").
const ROTATION_BY_COLOR = { red: 270, yellow: 180, blue: 0, green: 90 };

// getLocalPerspective(localColor) — the single reusable function every
// perspective-aware piece of UI (board, dice, labels) should derive from.
export const getLocalPerspective = localColor => {
    const rotation = ROTATION_BY_COLOR[localColor] || 0;
    const steps = rotation / 90;

    // Where a given color's home quadrant visually ends up once this
    // rotation is applied — e.g. the dice for whoever is moving should sit
    // at this corner, not at their canonical (pre-rotation) one.
    const visualCornerOf = color => {
        const canonical = CANONICAL_CORNER[color];
        if (!canonical) return null;
        const idx = CW_CYCLE.indexOf(canonical);
        return CW_CYCLE[(idx + steps) % 4];
    };

    return { rotation, visualCornerOf };
};

// Rotates a canonical-space point (x, y) clockwise by `deg` around (cx, cy) —
// used to turn a raw click/hover position (measured against the rotated
// canvas) back into the canonical coordinates the game logic already uses.
// Pass -rotation to undo a forward rotation.
export const rotatePoint = (x, y, cx, cy, deg) => {
    if (!deg) return { x, y };
    const rad = (deg * Math.PI) / 180;
    const dx = x - cx;
    const dy = y - cy;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos,
    };
};
