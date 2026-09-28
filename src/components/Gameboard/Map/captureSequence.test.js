import { planCaptureDelays } from './captureSequence';

const pawn = (_id, color, basePos, position) => ({ _id, color, basePos, position });
const duration = ms => () => ms;

describe('planCaptureDelays', () => {
    const before = { r0: 20, b0: 25, g0: 8 };

    it('delays a captured pawn until its attacker has landed', () => {
        // red r0 20 -> 25 captures blue b0 (25 -> its base 4)
        const pawns = [pawn('r0', 'red', 0, 25), pawn('b0', 'blue', 4, 4), pawn('g0', 'green', 8, 8)];
        const delays = planCaptureDelays(pawns, before, id => (id === 'r0' ? 630 : 0));
        expect(delays).toEqual({ b0: 630 });
    });

    it('uses the attacker\'s own duration for 1-step and 6-step captures', () => {
        const pawns = [pawn('r0', 'red', 0, 25), pawn('b0', 'blue', 4, 4)];
        expect(planCaptureDelays(pawns, before, duration(105))).toEqual({ b0: 105 });
        expect(planCaptureDelays(pawns, before, duration(630))).toEqual({ b0: 630 });
    });

    it('adds no delay when nothing was captured', () => {
        const pawns = [pawn('r0', 'red', 0, 23), pawn('b0', 'blue', 4, 25), pawn('g0', 'green', 8, 8)];
        expect(planCaptureDelays(pawns, before, duration(400))).toEqual({});
    });

    it('does not delay a pawn that went home without an attacker landing on its cell', () => {
        const pawns = [pawn('r0', 'red', 0, 22), pawn('b0', 'blue', 4, 4)];
        expect(planCaptureDelays(pawns, before, duration(400))).toEqual({});
    });

    it('ignores the first board (no previous positions)', () => {
        expect(planCaptureDelays([pawn('r0', 'red', 0, 25)], null, duration(400))).toEqual({});
    });

    it('never treats a same-colour pawn as the attacker', () => {
        const pawns = [pawn('r0', 'red', 0, 25), pawn('r1', 'red', 1, 1)];
        expect(planCaptureDelays(pawns, { r0: 20, r1: 25 }, duration(400))).toEqual({});
    });
});
