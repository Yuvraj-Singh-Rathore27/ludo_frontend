import getPositionAfterMove from './getPositionAfterMove';

// This file duplicates the server's movement logic (ludo_backend/models/pawnLogic.js).
// Any divergence desyncs the board from the server, so these assert the same
// board invariants the backend suite asserts.
const HOME = { red: [68, 73], blue: [74, 79], green: [80, 85], yellow: [86, 91] };
const BASE = { red: 0, blue: 4, green: 8, yellow: 12 };
const START = { red: 16, blue: 55, green: 42, yellow: 29 };
const LAST_TRACK = { red: 66, blue: 53, green: 40, yellow: 27 };
const COLORS = Object.keys(HOME);

const pawn = (color, position) => ({ _id: '0', color, basePos: BASE[color], position });

describe('getPositionAfterMove', () => {
    it.each(COLORS)('sends %s out of its base onto its start square', color => {
        expect(getPositionAfterMove(pawn(color, BASE[color]), 6)).toBe(START[color]);
    });

    // Square 67 is the last track cell before the loop wraps back to 16.
    it.each(['blue', 'green', 'yellow'])("wraps %s from 67 to 16 rather than into red's home", color => {
        for (let rolled = 1; rolled <= 6; rolled++) {
            expect(getPositionAfterMove(pawn(color, 67), rolled)).toBe(15 + rolled);
        }
    });

    it.each(COLORS)('moves %s off its last track cell into its own home column', color => {
        expect(getPositionAfterMove(pawn(color, LAST_TRACK[color]), 1)).toBe(HOME[color][0]);
        expect(getPositionAfterMove(pawn(color, LAST_TRACK[color]), 6)).toBe(HOME[color][1]);
    });

    // Regression: yellow's overshoot guard read `<= 85` (green's limit), which
    // froze every yellow token the moment it reached 86 — the client refused a
    // move the server allowed.
    it.each(COLORS)('lets %s advance through its own home column', color => {
        const [first, last] = HOME[color];
        for (let position = first; position < last; position++) {
            expect(getPositionAfterMove(pawn(color, position), 1)).toBe(position + 1);
        }
        expect(getPositionAfterMove(pawn(color, last), 1)).toBe(last);
    });

    it.each(COLORS)('never lets %s reach another colour home column', color => {
        const seen = new Set([BASE[color]]);
        const queue = [BASE[color]];
        while (queue.length) {
            const position = queue.shift();
            for (let rolled = 1; rolled <= 6; rolled++) {
                if (position === BASE[color] && rolled !== 6) continue;
                const destination = getPositionAfterMove(pawn(color, position), rolled);
                if (destination === undefined || seen.has(destination)) continue;
                seen.add(destination);
                queue.push(destination);
            }
        }

        const reached = [...seen];
        const foreign = reached.filter(position =>
            COLORS.some(
                other => other !== color && position >= HOME[other][0] && position <= HOME[other][1]
            )
        );

        expect(foreign).toEqual([]);
        expect(reached.filter(p => p >= 16 && p < 68)).toHaveLength(51);
        expect(reached.filter(p => p >= HOME[color][0] && p <= HOME[color][1])).toHaveLength(6);
    });
});
