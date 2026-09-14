// Layout for pawns that share a board cell. Pure (no canvas), so it is testable.
//
// - Draw order is deterministic: opponents first, the local player's own pawns
//   last (so they are always on top), ties broken by a fixed colour order + id.
// - Pawns sharing a cell are spread into a small mini-grid and shrunk slightly so
//   every one of them stays visible; offsets are in the pawn's upright (screen)
//   frame, so the spread looks the same for every board rotation.
// - Cells holding more pawns than the mini-grid has slots also get a count badge.

const COLOR_ORDER = ['red', 'blue', 'green', 'yellow'];

export const STACK_SCALE = 0.72;
export const BASE_HIT_RADIUS = 12;

const OFFSETS = {
    1: [[0, 0]],
    2: [[-7, 0], [7, 0]],
    3: [[-7, -5], [7, -5], [0, 5]],
    4: [[-7, -5], [7, -5], [-7, 5], [7, 5]],
};
const MAX_SLOTS = 4;

const compareInStack = localColor => (a, b) => {
    const aOwn = a.color === localColor ? 1 : 0;
    const bOwn = b.color === localColor ? 1 : 0;
    if (aOwn !== bOwn) return aOwn - bOwn; // own pawns drawn last = on top
    const colorDiff = COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color);
    if (colorDiff !== 0) return colorDiff;
    return Number(a._id) - Number(b._id);
};

// Returns entries in draw order (bottom-most first):
//   { pawn, position, offsetX, offsetY, scale, stackSize, showCount }
export const layoutPawns = (pawns, localColor) => {
    const groups = new Map();
    pawns.forEach(pawn => {
        if (!groups.has(pawn.position)) groups.set(pawn.position, []);
        groups.get(pawn.position).push(pawn);
    });

    const layout = [];
    groups.forEach((group, position) => {
        const sorted = [...group].sort(compareInStack(localColor));
        const stackSize = sorted.length;
        const offsets = OFFSETS[Math.min(stackSize, MAX_SLOTS)];
        sorted.forEach((pawn, index) => {
            const [offsetX, offsetY] = offsets[index % offsets.length];
            layout.push({
                pawn,
                position,
                offsetX,
                offsetY,
                scale: stackSize > 1 ? STACK_SCALE : 1,
                stackSize,
                // Badge once on the top-most pawn when slots are shared.
                showCount: stackSize > MAX_SLOTS && index === stackSize - 1,
            });
        });
    });

    // Own pawns across the whole board are drawn after everyone else, so a pawn on
    // a neighbouring cell can never paint over them either.
    const isOwn = entry => (entry.pawn.color === localColor ? 1 : 0);
    return layout
        .map((entry, order) => ({ entry, order }))
        .sort((a, b) => isOwn(a.entry) - isOwn(b.entry) || a.order - b.order)
        .map(({ entry }) => entry);
};
