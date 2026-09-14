import { layoutPawns, STACK_SCALE } from './stackLayout';

const pawn = (_id, color, position) => ({ _id: String(_id), color, basePos: _id, position });

describe('layoutPawns', () => {
    it('should draw a lone pawn centred at full size', () => {
        const [entry] = layoutPawns([pawn(0, 'red', 20)], 'blue');
        expect(entry).toMatchObject({ offsetX: 0, offsetY: 0, scale: 1, stackSize: 1, showCount: false });
    });

    it('should spread pawns sharing a cell so none sits exactly on another', () => {
        const layout = layoutPawns([pawn(0, 'red', 20), pawn(1, 'red', 20), pawn(4, 'blue', 20)], 'green');
        const spots = layout.map(e => `${e.offsetX},${e.offsetY}`);
        expect(new Set(spots).size).toBe(3);
        layout.forEach(e => expect(e.scale).toBe(STACK_SCALE));
    });

    it("should always draw the local player's pawns last (on top)", () => {
        const pawns = [pawn(4, 'blue', 20), pawn(0, 'red', 20), pawn(8, 'green', 33), pawn(5, 'blue', 40)];
        const order = layoutPawns(pawns, 'blue').map(e => e.pawn.color);
        expect(order.slice(-2)).toEqual(['blue', 'blue']);
    });

    it('should give the same order no matter how the input array is ordered', () => {
        const pawns = [pawn(0, 'red', 20), pawn(4, 'blue', 20), pawn(8, 'green', 20), pawn(1, 'red', 20)];
        const ids = list => layoutPawns(list, 'red').map(e => e.pawn._id);
        expect(ids([...pawns].reverse())).toEqual(ids(pawns));
    });

    it('should show a count badge only once when a cell holds more pawns than slots', () => {
        const pawns = [0, 1, 2, 3].map(i => pawn(i, 'red', 16)).concat([4, 5].map(i => pawn(i, 'blue', 16)));
        const layout = layoutPawns(pawns, 'red');
        const badges = layout.filter(e => e.showCount);
        expect(badges).toHaveLength(1);
        expect(badges[0].stackSize).toBe(6);
        expect(layoutPawns(pawns.slice(0, 4), 'red').some(e => e.showCount)).toBe(false);
    });
});
