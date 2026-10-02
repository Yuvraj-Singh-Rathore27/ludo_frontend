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

describe('canPawnMove — opponent blocks (mirrors backend isOpponentBlock / isPathBlocked)', () => {
    const blueBlock = at => [pawn('b0', 'blue', 4, at), pawn('b1', 'blue', 5, at)];

    it('is not movable when the destination holds a same-colour opponent block', () => {
        expect(canPawnMove(red, 2, [red, ...blueBlock(22)])).toBe(false);
    });

    it('is not movable when a block sits on a cell it would pass over', () => {
        expect(canPawnMove(red, 4, [red, ...blueBlock(22)])).toBe(false);
    });

    it('a single opponent pawn is not a block (capture is still allowed)', () => {
        expect(canPawnMove(red, 4, [red, pawn('b0', 'blue', 4, 22)])).toBe(true);
    });

    it('two pawns of DIFFERENT opponent colours are not a block', () => {
        expect(canPawnMove(red, 4, [red, pawn('b0', 'blue', 4, 22), pawn('g0', 'green', 8, 22)])).toBe(true);
    });

    it('own-colour stacks never block', () => {
        expect(canPawnMove(red, 4, [red, pawn('r1', 'red', 1, 22), pawn('r2', 'red', 2, 22)])).toBe(true);
    });

    it('a non-safe cell with two opponents does block (control for the safe-square test)', () => {
        const onStart = pawn('r3', 'red', 3, 16);
        expect(canPawnMove(onStart, 3, [onStart, ...blueBlock(19)])).toBe(false);
    });

    it('lands on a safe square holding two opponents without being blocked', () => {
        const near = pawn('r4', 'red', 3, 20);
        expect(canPawnMove(near, 4, [near, ...blueBlock(24)])).toBe(true); // 24 is a safe star
    });

    it('passes over a safe square holding two same-colour opponents', () => {
        // 20 -> 26 walks over the star at 24; a stack on a safe square is never a block.
        expect(canPawnMove(red, 6, [red, ...blueBlock(24)])).toBe(true);
    });

    it('a pawn leaving base is not path-checked', () => {
        const home = pawn('r5', 'red', 3, 3);
        expect(canPawnMove(home, 6, [home, ...blueBlock(17)])).toBe(true);
    });
});
