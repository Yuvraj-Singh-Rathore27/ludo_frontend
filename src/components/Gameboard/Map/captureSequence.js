// A capture reaches the client as ONE board update: the attacker is on the target
// cell and the victim is already back on its base. Animating both from the same
// instant sent the victim home while the attacker was still hopping towards it.
//
// This decides, purely from that update, how long each pawn's animation must wait:
// a captured pawn waits for the animation of the pawn that captured it, so it only
// leaves its cell once the attacker has landed. Every other pawn starts at once.
// Game state is untouched — this only orders what is drawn.

// pawns:      the new board (each { _id, color, basePos, position })
// previous:   pawnId -> position that was on screen before this update (or null)
// durationOf: pawnId -> how long that pawn's own animation runs, in ms
// returns:    pawnId -> ms to wait before that pawn's animation starts (only non-zero entries)
export const planCaptureDelays = (pawns, previous, durationOf) => {
    const delays = {};
    if (!previous) return delays;

    const moved = pawns.filter(p => previous[p._id] !== undefined && previous[p._id] !== p.position);
    const victims = moved.filter(p => p.position === p.basePos);

    victims.forEach(victim => {
        const cell = previous[victim._id];
        // The attacker is the other-colour pawn that moved onto the victim's old cell
        // in this same update.
        const attacker = moved.find(p => p.color !== victim.color && p.position === cell);
        if (!attacker) return;
        const wait = durationOf(attacker._id);
        if (wait > 0) delays[victim._id] = wait;
    });

    return delays;
};
