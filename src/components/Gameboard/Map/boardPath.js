// Single source of truth for where every pawn is allowed to be (client copy).
//
// Board index layout:
//   bases   red 0-3, blue 4-7, green 8-11, yellow 12-15 (basePos === position)
//   track   16-67, a 52-cell loop shared by everyone
//   homes   red 68-73, blue 74-79, green 80-85, yellow 86-91
//
// Each colour has an explicit ordered path: 51 track cells from its start square,
// then its own 6 home cells. A move is "step N cells forward along your own path".
//
// KEEP IN SYNC with backend/models/boardPath.js —
// backend/tests/models/boardPath.test.js fails if the two copies drift apart.

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

export const BASE_POSITIONS = {
    red: range(0, 3),
    blue: range(4, 7),
    green: range(8, 11),
    yellow: range(12, 15),
};

export const PATHS = {
    red: [...range(16, 66), ...range(68, 73)],
    blue: [...range(55, 67), ...range(16, 53), ...range(74, 79)],
    green: [...range(42, 67), ...range(16, 40), ...range(80, 85)],
    yellow: [...range(29, 67), ...range(16, 27), ...range(86, 91)],
};

const MIN_ROLL = 1;
const MAX_ROLL = 6;

export const isKnownColor = color => Object.prototype.hasOwnProperty.call(PATHS, color);

export const isValidRoll = rolledNumber =>
    Number.isInteger(rolledNumber) && rolledNumber >= MIN_ROLL && rolledNumber <= MAX_ROLL;

export const isValidPawnPosition = pawn => {
    if (!pawn || !isKnownColor(pawn.color)) return false;
    if (!Number.isInteger(pawn.basePos) || !Number.isInteger(pawn.position)) return false;
    if (!BASE_POSITIONS[pawn.color].includes(pawn.basePos)) return false;
    if (pawn.position === pawn.basePos) return true;
    return PATHS[pawn.color].includes(pawn.position);
};

// Destination for a legal move, or null when the move is not legal.
export const getDestination = (pawn, rolledNumber) => {
    if (!isValidPawnPosition(pawn) || !isValidRoll(rolledNumber)) return null;
    if (pawn.position === pawn.basePos) {
        return rolledNumber === MAX_ROLL ? PATHS[pawn.color][0] : null;
    }
    const path = PATHS[pawn.color];
    const nextIndex = path.indexOf(pawn.position) + rolledNumber;
    return nextIndex < path.length ? path[nextIndex] : null;
};
