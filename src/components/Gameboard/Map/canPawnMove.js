import { getDestination } from './boardPath';
import getPositionAfterMove from './getPositionAfterMove';

// Same values as backend/utils/constants.js (SAFE_POSITIONS, HOME_STRETCH_MIN).
const SAFE_POSITIONS = [16, 24, 29, 37, 42, 50, 55, 63];
const HOME_STRETCH_MIN = 68;

// Mirrors backend RoomState.isOpponentBlock: 2+ pawns of ONE other colour on a cell.
// Safe squares and home stretches never hold a block.
const isOpponentBlock = (position, attackerColor, pawns) => {
    if (SAFE_POSITIONS.includes(position) || position >= HOME_STRETCH_MIN) return false;
    const counts = {};
    for (const p of pawns) {
        if (p.color !== attackerColor && p.position === position) {
            counts[p.color] = (counts[p.color] || 0) + 1;
            if (counts[p.color] >= 2) return true;
        }
    }
    return false;
};

// Mirrors backend RoomState.isPathBlocked: a block on any cell passed over (not the
// destination, which isOpponentBlock covers) stops the move. A pawn leaving base jumps
// straight to its start square, so there is nothing to walk.
const isPathBlocked = (pawn, rolledNumber, pawns) => {
    if (pawn.position === pawn.basePos) return false;
    for (let step = 1; step < rolledNumber; step++) {
        if (isOpponentBlock(getPositionAfterMove(pawn, step), pawn.color, pawns)) return true;
    }
    return false;
};

// Only a 6 exits a home token, overshooting the final home cell is not a move, and a
// pawn not on its own path can never move (matches backend pawnLogic.canMove).
// When the board's pawns are supplied it also applies the backend's block rule, so a
// pawn the server would refuse is not offered as movable. The server stays the
// authority — this only stops the UI from advertising a move that will be dropped.
const canPawnMove = (pawn, rolledNumber, pawns) => {
    const destination = getDestination(pawn, rolledNumber);
    if (destination === null) return false;
    if (!pawns) return true;
    return !isOpponentBlock(destination, pawn.color, pawns) && !isPathBlocked(pawn, rolledNumber, pawns);
};

export default canPawnMove;
