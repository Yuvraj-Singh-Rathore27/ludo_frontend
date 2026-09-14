import { getDestination } from './boardPath';

// Destination cell for a move, or the current position when the move is not legal
// (matches backend pawnLogic.getPositionAfterMove).
const getPositionAfterMove = (pawn, rolledNumber) => {
<<<<<<< HEAD
    const destination = getDestination(pawn, rolledNumber);
    return destination === null ? pawn.position : destination;
=======
    const { position, color } = pawn;
    switch (color) {
        case 'red':
            if (pawn.position + rolledNumber <= 73) {
                if (position >= 0 && position <= 3) {
                    return 16;
                } else if (position <= 66 && position + rolledNumber >= 67) {
                    return position + rolledNumber + 1;
                } else {
                    return position + rolledNumber;
                }
            } else {
                return position;
            }
        case 'blue':
            if (pawn.position + rolledNumber <= 79) {
                if (position >= 4 && position <= 7) {
                    return 55;
                } else if (position <= 67 && position + rolledNumber > 67) {
                    return position + rolledNumber - 52;
                } else if (position <= 53 && position + rolledNumber >= 54) {
                    return position + rolledNumber + 20;
                } else {
                    return position + rolledNumber;
                }
            } else {
                return position;
            }
        case 'green':
            if (pawn.position + rolledNumber <= 85) {
                if (position >= 8 && position <= 11) {
                    return 42;
                } else if (position <= 67 && position + rolledNumber > 67) {
                    return position + rolledNumber - 52;
                } else if (position <= 40 && position + rolledNumber >= 41) {
                    return position + rolledNumber + 39;
                } else {
                    return position + rolledNumber;
                }
            } else {
                return position;
            }
        case 'yellow':
            if (pawn.position + rolledNumber <= 91) {
                if (position >= 12 && position <= 15) {
                    return 29;
                } else if (position <= 67 && position + rolledNumber > 67) {
                    return position + rolledNumber - 52;
                } else if (position <= 27 && position + rolledNumber >= 28) {
                    return position + rolledNumber + 58;
                } else {
                    return position + rolledNumber;
                }
            } else {
                return position;
            }
        default:
            return position;
    }
>>>>>>> fbf3a145878c9370a1285c7c660c24140c40acad
};

export default getPositionAfterMove;
