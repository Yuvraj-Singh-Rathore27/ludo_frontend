import { getDestination } from './boardPath';

// Only a 6 exits a home token, overshooting the final home cell is not a move, and a
// pawn not on its own path can never move (matches backend pawnLogic.canMove).
const canPawnMove = (pawn, rolledNumber) => getDestination(pawn, rolledNumber) !== null;

export default canPawnMove;
