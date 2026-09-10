// Single source of truth for the dice roll animation's timing, shared between
// Dice.jsx (runs the animation) and Gameboard.jsx (pins the dice's on-board
// corner to the roller for exactly as long as the animation can possibly run,
// so a fast server turn-pass — e.g. no legal move — can never yank the dice
// away or cut the animation short). Animation speed never depends on pawn
// count or move legality; it is always this fixed sequence.

export const MIN_SPIN_MS = 1150; // fast 3D spin before it's allowed to land
export const LANDING_MS = 600; // gradual slowdown into the final face
export const RESULT_HOLD_MS = 450; // show the landed face before evaluating what's next
export const NO_MOVE_HOLD_MS = 900; // "No move available" message hold

// Worst-case total lifetime of one roll's animation (spin -> land -> hold ->
// no-move message). Gameboard uses this to keep the dice pinned to the roller.
export const MAX_ROLL_ANIMATION_MS = MIN_SPIN_MS + LANDING_MS + RESULT_HOLD_MS + NO_MOVE_HOLD_MS;
