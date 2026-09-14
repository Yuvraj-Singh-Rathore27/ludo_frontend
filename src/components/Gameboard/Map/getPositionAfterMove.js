import { getDestination } from './boardPath';

// Destination cell for a move, or the current position when the move is not legal
// (matches backend pawnLogic.getPositionAfterMove).
const getPositionAfterMove = (pawn, rolledNumber) => {
    const destination = getDestination(pawn, rolledNumber);
    return destination === null ? pawn.position : destination;
};

export default getPositionAfterMove;
