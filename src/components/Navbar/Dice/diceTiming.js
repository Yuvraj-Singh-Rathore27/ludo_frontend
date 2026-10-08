// Single source of truth for the dice roll animation's timing, shared between
// Dice.jsx (runs the animation) and Gameboard.jsx (pins the dice's on-board
// corner to the roller for exactly as long as the animation can possibly run,
// so a fast server turn-pass — e.g. no legal move — can never yank the dice
// away or cut the animation short). Animation speed never depends on pawn
// count or move legality; it is always this fixed sequence.

// One full tumble of the looping spin keyframe (Dice.module.css diceTumble). The cube is back at
// its start pose at every multiple of this, so landing is only started on such a boundary —
// starting mid-cycle made the cube snap back to its start pose, which read as a stutter/loop.
export const SPIN_CYCLE_MS = 600;
export const MIN_SPIN_MS = 2 * SPIN_CYCLE_MS; // 3D spin before it's allowed to land
export const LANDING_MS = 750; // gradual slowdown into the final face
export const RESULT_HOLD_MS = 450; // show the landed face before evaluating what's next
export const NO_MOVE_HOLD_MS = 900; // "No move available" message hold

// Worst-case total lifetime of one roll's animation (spin -> land -> hold ->
// no-move message). Gameboard uses this to keep the dice pinned to the roller.
export const MAX_ROLL_ANIMATION_MS = MIN_SPIN_MS + LANDING_MS + RESULT_HOLD_MS + NO_MOVE_HOLD_MS;
