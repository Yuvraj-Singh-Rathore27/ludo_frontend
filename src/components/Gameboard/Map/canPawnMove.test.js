import canPawnMove from './canPawnMove';

const pawn = (_id, color, basePos, position) => ({ _id, color, basePos, position });

// Red path starts at 16. A red pawn on 20 rolling 4 lands on 24 (a safe star) and
// passes over 21, 22, 23.
const red = pawn('r0', 'red', 0, 20);

describe('canPawnMove — legality without a board (unchanged)', () => {
    it('only lets a 6 leave base', () => {
        expect(canPawnMove(pawn('r1', 'red', 1, 1), 5)).toBe(false);
        expect(canPawnMove(pawn('r1', 'red', 1, 1), 6)).toBe(true);
    });
    it('rejects overshooting home', () => {
        expect(canPawnMove(pawn('r2', 'red', 2, 72), 2)).toBe(false);
    });
});

describe('canPawnMove — no block rule (mirrors backend getPawnsThatCanMove)', () => {
    const blueBlock = at => [pawn('b0', 'blue', 4, at), pawn('b1', 'blue', 5, at)];

    it('may land on a square holding two same-colour opponents', () => {
        expect(canPawnMove(red, 2, [red, ...blueBlock(22)])).toBe(true);
    });

    it('may pass over a square holding two same-colour opponents', () => {
        expect(canPawnMove(red, 4, [red, ...blueBlock(22)])).toBe(true);
    });
});
