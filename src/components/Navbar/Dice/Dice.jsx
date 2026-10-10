import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { PlayerDataContext, SocketContext } from '../../../App';
import images from '../../../constants/diceImages';
import diceSound from '../../../images/dice/dice.mp3';
import lottie from 'lottie-web/build/player/lottie_light';
import diceAnimation from '../../../animations/ludo_dice.json';
import styles from './Dice.module.css';
import { SPIN_CYCLE_MS, MIN_SPIN_MS, LANDING_MS, RESULT_HOLD_MS, NO_MOVE_HOLD_MS } from './diceTiming';

const SAFETY_TIMEOUT_MS = 6000;

// One roll sound for the whole app. The dice component is mounted afresh in
// whichever player's corner holds the dice, so a per-instance Audio re-requested
// dice.mp3 on nearly every turn. Created on first use (browsers only allow audio
// after a user gesture anyway) and reused from then on.
let sharedDiceAudio = null;
const getDiceAudio = () => {
    if (!sharedDiceAudio) sharedDiceAudio = new Audio(diceSound);
    return sharedDiceAudio;
};

// diceImages.js layout: [faces 1..6, roll]. The roll button uses the same image.
const ROLL_IMAGE_INDEX = 6;

const SETTLED_PHASES = new Set(['landing', 'landed', 'noMove']);

// Lottie dice (animations/ludo_dice.json): six 45-frame segments, segment N ends on face N.
// Inside a segment, frames 4-28 are one full tumble (random faces) and 28-40 the final
// slowdown onto the real face, so: while waiting for the server we loop the tumble, and the
// landing plays ONLY the slowdown from where the loop ends — playing the whole segment
// would tumble a second time. Landing is stretched to fit LANDING_MS (diceTiming.js).
const SEGMENT_FRAMES = 45;
const TUMBLE_START = 4;
const TUMBLE_END = 28;
const LAND_END = 40;
const LOTTIE_FPS = 30;
const segmentStart = result => (Math.min(6, Math.max(1, result || 1)) - 1) * SEGMENT_FRAMES;

const DiceCube = ({ phase, result }) => {
    const hostRef = useRef(null);
    const animRef = useRef(null);
    // Read by the phase effect below but deliberately not a dependency: the result arriving
    // mid-tumble must not restart the tumble.
    const resultRef = useRef(result);
    resultRef.current = result;

    useEffect(() => {
        let anim = null;
        try {
            anim = lottie.loadAnimation({
                container: hostRef.current,
                renderer: 'svg',
                loop: false,
                autoplay: false,
                animationData: diceAnimation,
                // Crop the 320x320 canvas to the die so it fills its box (overflow stays visible for the hop)
                rendererSettings: { preserveAspectRatio: 'xMidYMid meet', viewBoxSize: '80 100 160 160' },
            });
        } catch {
            /* animation unavailable (e.g. no SVG support) — the result badge still shows */
        }
        // The art is authored at 30 fps. Without this lottie re-renders the whole SVG on every
        // display refresh (60-120 Hz) between those frames; on a weak CPU that wasted work is
        // what drops frames. Time still drives playback, so a slow device skips frames
        // instead of running the roll slower.
        if (anim) anim.setSubframe(false);
        animRef.current = anim;
        return () => {
            animRef.current = null;
            if (anim) anim.destroy();
        };
    }, []);

    useEffect(() => {
        const anim = animRef.current;
        if (!anim) return;
        try {
            if (phase === 'spinning') {
                anim.loop = true;
                anim.setSpeed(((TUMBLE_END - TUMBLE_START) / LOTTIE_FPS) * (1000 / SPIN_CYCLE_MS));
                anim.playSegments([TUMBLE_START, TUMBLE_END], true);
            } else if (phase === 'landing') {
                const start = segmentStart(resultRef.current);
                anim.loop = false;
                anim.setSpeed(((LAND_END - TUMBLE_END) / LOTTIE_FPS) * (1000 / LANDING_MS));
                anim.playSegments([start + TUMBLE_END, start + LAND_END], true);
            } else {
                // goToAndStop counts from the active segment's first frame, not frame 0 — so
                // make the held frame its own one-frame segment, then show that segment's start.
                const held = segmentStart(resultRef.current) + SEGMENT_FRAMES - 1;
                anim.playSegments([held, held + 1], true);
                anim.goToAndStop(0, true);
            }
        } catch {
            /* ignore — purely visual */
        }
    }, [phase]);

    return (
        <div className={`${styles.diceBounceWrap} ${phase === 'landed' ? styles.landed : ''}`}>
            <div ref={hostRef} className={styles.lottieDice} role='img' aria-label={result ? `Dice ${result}` : 'Dice'} />
        </div>
    );
};

// Every step of the animation is guarded by a monotonic "roll id" instead of
// several booleans that have to stay in sync — a step only acts if its id is
// still the current one, so resetting (bumping the id) instantly and safely
// invalidates any timers still in flight. This is what makes the sequence
// robust regardless of how fast the server responds or passes the turn.
const Dice = ({
    rolledNumber,
    nowMoving,
    playerColor,
    movingPlayer,
    variant = 'card',
    labelSide = 'below',
    onRollRequested,
}) => {
    const socket = useContext(SocketContext);
    const roomId = useContext(PlayerDataContext)?.roomId;
    // 'idle' | 'spinning' | 'landing' | 'landed' | 'noMove'
    const [phase, setPhase] = useState('idle');
    const phaseRef = useRef('idle');

    const rollIdRef = useRef(0);
    const spinStartRef = useRef(null);
    const capturedResultRef = useRef(null);
    // True once the landing sequence has been scheduled for the roll in
    // flight — independent of `phase`, which flips to 'spinning' optimistically
    // on click (before a result exists), so it can't double as this guard.
    const scheduledRef = useRef(false);
    // True once we've landed with a confirmed legal move — we're just
    // waiting on the player's pawn pick, not evaluating "no move".
    const awaitingMoveRef = useRef(false);
    // Mirrors the live prop for the delayed post-landing check.
    const hasRolledNumberRef = useRef(false);

    const timersRef = useRef([]); // every pending timeout for the CURRENT roll

    // Brief "Reconnecting…" label when a tap arrives while the game socket is down
    const [offlineHint, setOfflineHint] = useState(false);
    useEffect(() => {
        if (!offlineHint) return undefined;
        const id = setTimeout(() => setOfflineHint(false), 1500);
        return () => clearTimeout(id);
    }, [offlineHint]);

    const setPhaseSafe = useCallback(next => {
        phaseRef.current = next;
        setPhase(next);
    }, []);

    const clearTimers = useCallback(() => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
    }, []);

    // setTimeout that both tracks itself for cleanup AND no-ops if a newer
    // roll (or a reset) has superseded it by the time it fires.
    const after = useCallback((ms, myId, fn) => {
        const id = setTimeout(() => {
            if (rollIdRef.current !== myId) return;
            fn();
        }, ms);
        timersRef.current.push(id);
    }, []);

    const resetToIdle = useCallback(() => {
        rollIdRef.current += 1; // invalidates any still-pending step from this roll
        clearTimers();
        scheduledRef.current = false;
        awaitingMoveRef.current = false;
        capturedResultRef.current = null;
        spinStartRef.current = null;
        setPhaseSafe('idle');
    }, [clearTimers, setPhaseSafe]);

    const handleClick = useCallback(() => {
        // Synchronous ref check — immune to React's async state batching,
        // so a rapid double-tap can never start a second roll.
        if (phaseRef.current !== 'idle') return;

        // Mid-reconnect the emit would be buffered and could fire long after the tap,
        // while the dice sat spinning and blocked further taps. Say so and stay ready.
        if (socket && socket.connected === false) {
            setOfflineHint(true);
            return;
        }

        // Sound must never be able to stop the roll: play() returns undefined instead of
        // a promise on some older mobile browsers, and `.catch` on that used to throw
        // before game:roll was ever emitted — a tap that silently did nothing.
        try {
            const audio = getDiceAudio();
            audio.currentTime = 0;
            const playing = audio.play();
            if (playing && typeof playing.catch === 'function') playing.catch(() => {});
        } catch {
            /* audio unavailable — roll anyway */
        }

        spinStartRef.current = Date.now();
        // Optimistic visual only — the actual sequence (and its safety net)
        // is scheduled below once the real result arrives, so this alone
        // must never gate anything except a repeat click.
        setPhaseSafe('spinning');

        // Safety net: if the server never responds, stop after 6s so UI can't get stuck
        const myId = rollIdRef.current;
        after(SAFETY_TIMEOUT_MS, myId, () => {
            if (!scheduledRef.current) resetToIdle();
        });

        // Existing game logic — untouched. The server generates the real result;
        // this component only ever displays whatever number it sends back.
        // The room code rides along so the roll still lands after a reconnect that
        // lost the server-side session (the server verifies the seat either way).
        // onRollRequested lets the board tell a roll this player made from one the
        // server made for them on timeout (only the former may auto-move a token).
        onRollRequested?.();
        socket?.emit('game:roll', roomId);
    }, [socket, roomId, setPhaseSafe, after, resetToIdle, onRollRequested]);

    const isCurrentPlayer = movingPlayer === playerColor;
    const hasRolledNumber = rolledNumber !== null && rolledNumber !== undefined;

    useEffect(() => {
        hasRolledNumberRef.current = hasRolledNumber;
    }, [hasRolledNumber]);

    // Starts the fixed spin -> land -> hold -> (wait for move | "no move")
    // sequence exactly once per roll, the moment a result is known — and lets
    // it run to completion untouched by whatever the server does afterward.
    // This is what keeps the animation's timing identical regardless of pawn
    // count or move legality.
    useEffect(() => {
        if (!hasRolledNumber || scheduledRef.current) return;

        scheduledRef.current = true;
        rollIdRef.current += 1;
        const myId = rollIdRef.current;
        clearTimers(); // also cancels the click's now-unneeded safety timeout
        awaitingMoveRef.current = false;
        capturedResultRef.current = rolledNumber;
        if (!spinStartRef.current) spinStartRef.current = Date.now();
        setPhaseSafe('spinning');

        const elapsed = Date.now() - spinStartRef.current;
        // Land only when the looping spin is back at its start pose (a whole number of
        // cycles), so the cube eases straight into the landing instead of snapping.
        // A slow server reply just means a few more smooth cycles, never a visible jump.
        const cycles = Math.max(MIN_SPIN_MS / SPIN_CYCLE_MS, Math.ceil(elapsed / SPIN_CYCLE_MS));
        const wait = Math.max(0, cycles * SPIN_CYCLE_MS - elapsed);

        after(wait, myId, () => {
            setPhaseSafe('landing');

            after(LANDING_MS, myId, () => {
                setPhaseSafe('landed');

                if (hasRolledNumberRef.current) {
                    // The result is on screen and the roll is still live: a legal move
                    // exists. Tokens become pickable from this moment, so from here a
                    // cleared roll means "moved" (reset below), never "no move".
                    awaitingMoveRef.current = true;
                    return;
                }

                after(RESULT_HOLD_MS, myId, () => {
                    // The server cleared the roll before the dice even landed: there was
                    // no legal move and the turn already passed. Say so briefly.
                    setPhaseSafe('noMove');
                    after(NO_MOVE_HOLD_MS, myId, resetToIdle);
                });
            });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasRolledNumber, rolledNumber]);

    // Once landed with a legal move and just waiting on the player's pick,
    // clear back to idle the moment they actually move (rolledNumber resets).
    // Never fires mid-spin/landing — only after awaitingMoveRef is set.
    useEffect(() => {
        if (!hasRolledNumber && awaitingMoveRef.current) {
            resetToIdle();
        }
    }, [hasRolledNumber, resetToIdle]);

    // The server refused this roll (stale turn state, already rolled, …). Drop the
    // optimistic spin right away instead of waiting out the 6s safety timeout, so the
    // player's next tap works. Only a click-started spin with no result yet is reset.
    useEffect(() => {
        if (typeof socket?.on !== 'function') return undefined;
        const onRejected = () => {
            if (phaseRef.current === 'spinning' && !scheduledRef.current) resetToIdle();
        };
        socket.on('game:roll_rejected', onRejected);
        return () => socket.off('game:roll_rejected', onRejected);
    }, [socket, resetToIdle]);

    // Cleanup all timers on unmount
    useEffect(() => clearTimers, [clearTimers]);

    // Dock idle view — not this player's turn and nothing rolling yet
    if (variant === 'dock' && (!isCurrentPlayer || (!nowMoving && phase === 'idle'))) {
        return (
            <div className={`${styles.container} ${styles.dockContainer}`}>
                <img
                    className={styles.dockIdleDie}
                    // Always the neutral "roll" image, never a die face. This view only
                    // shows while nothing is animating, so a face here was either stale
                    // (images[5], the 6 face, used to flash after every move) or a new
                    // result painted for one frame before its spin started.
                    src={images[ROLL_IMAGE_INDEX]}
                    alt=''
                />
            </div>
        );
    }

    return (
        <div className={`${styles.container} ${variant === 'dock' ? styles.dockContainer : styles.cardContainer}`}>
            {isCurrentPlayer ? (
                phase !== 'idle' ? (
                    <span className={styles.resultWrap}>
                        <DiceCube phase={phase} result={capturedResultRef.current} />
                        {SETTLED_PHASES.has(phase) ? (
                            <span className={styles.resultBadge} aria-hidden='true'>
                                {capturedResultRef.current}
                            </span>
                        ) : null}
                        {phase === 'noMove' ? (
                            <span
                                className={`${styles.rollLabel} ${
                                    labelSide === 'above' ? styles.noMoveAbove : styles.noMoveBelow
                                }`}
                            >
                                No move available
                            </span>
                        ) : null}
                    </span>
                ) : nowMoving ? (
                    // Roll control — only rendered when it's actually this player's
                    // turn to roll, so it never appears as an active control otherwise.
                    <span
                        className={`${styles.rollPrompt} ${
                            labelSide === 'above' ? styles.rollPromptAbove : styles.rollPromptBelow
                        }`}
                    >
                        <button
                            className={`${styles.rollButton} ${styles[playerColor] || ''}`}
                            type='button'
                            aria-label='Roll dice'
                            onClick={handleClick}
                            disabled={phase !== 'idle'}
                        >
                            <img src={images[ROLL_IMAGE_INDEX]} alt='roll' />
                        </button>
                        <span className={styles.rollLabel}>{offlineHint ? 'Reconnecting…' : 'Roll Dice'}</span>
                    </span>
                ) : null
            ) : null}
        </div>
    );
};

// A dimmed die with exactly the dock dice's footprint (same classes, so the sizes stay in
// step at every breakpoint). Player badges hold it while someone else has the dice, so a
// badge never changes size as the dice moves between corners and every seat shows its dice.
export const DiceSlot = () => (
    <div className={`${styles.container} ${styles.dockContainer} ${styles.slot}`} aria-hidden='true'>
        <span className={styles.slotDie} />
    </div>
);

export default React.memo(Dice);
