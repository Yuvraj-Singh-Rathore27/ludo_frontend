import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { PlayerDataContext, SocketContext } from '../../../App';
import images from '../../../constants/diceImages';
import diceSound from '../../../images/dice/dice.mp3';
import styles from './Dice.module.css';
import { MIN_SPIN_MS, LANDING_MS, RESULT_HOLD_MS, NO_MOVE_HOLD_MS } from './diceTiming';

// 3D dice roll — a real 6-sided cube (not face-swapping) built from the
// existing 1.png..6.png images. Opposite faces sum to 7, like a real die:
// front=1/back=6, right=3/left=4, top=2/bottom=5.
const FACE_LANDING_ROTATION = {
    1: { x: 0, y: 0 },
    2: { x: -90, y: 0 },
    3: { x: 0, y: -90 },
    4: { x: 0, y: 90 },
    5: { x: 90, y: 0 },
    6: { x: 0, y: 180 },
};

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

// Builds the cube's final transform: a few extra full turns (so the motion
// keeps going, never reverses) ending exactly on the rolled face.
const buildLandTransform = rolledNumber => {
    const target = FACE_LANDING_ROTATION[rolledNumber] || FACE_LANDING_ROTATION[1];
    const turns = () => 2 + Math.floor(Math.random() * 2); // 2-3 extra full turns
    const x = target.x + 360 * turns();
    const y = target.y + 360 * turns();
    const z = 360 * turns(); // Z has no face meaning — always resolves to a clean multiple
    return `rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)`;
};

const SETTLED_PHASES = new Set(['landing', 'landed', 'noMove']);

const DiceCube = ({ phase, landTransform }) => (
    <div className={`${styles.diceBounceWrap} ${phase === 'landed' ? styles.landed : ''}`}>
        <div className={styles.diceScene}>
            <div
                className={`${styles.dice3d} ${phase === 'spinning' ? styles.spinning : ''} ${
                    phase === 'landing' ? styles.landing : ''
                }`}
                style={SETTLED_PHASES.has(phase) ? { transform: landTransform } : undefined}
            >
                <div className={`${styles.diceFace} ${styles.faceFront}`}>
                    <img src={images[0]} alt='1' />
                </div>
                <div className={`${styles.diceFace} ${styles.faceBack}`}>
                    <img src={images[5]} alt='6' />
                </div>
                <div className={`${styles.diceFace} ${styles.faceRight}`}>
                    <img src={images[2]} alt='3' />
                </div>
                <div className={`${styles.diceFace} ${styles.faceLeft}`}>
                    <img src={images[3]} alt='4' />
                </div>
                <div className={`${styles.diceFace} ${styles.faceTop}`}>
                    <img src={images[1]} alt='2' />
                </div>
                <div className={`${styles.diceFace} ${styles.faceBottom}`}>
                    <img src={images[4]} alt='5' />
                </div>
            </div>
        </div>
    </div>
);

// Every step of the animation is guarded by a monotonic "roll id" instead of
// several booleans that have to stay in sync — a step only acts if its id is
// still the current one, so resetting (bumping the id) instantly and safely
// invalidates any timers still in flight. This is what makes the sequence
// robust regardless of how fast the server responds or passes the turn.
const Dice = ({ rolledNumber, nowMoving, playerColor, movingPlayer, variant = 'card', labelSide = 'below' }) => {
    const socket = useContext(SocketContext);
    const roomId = useContext(PlayerDataContext)?.roomId;
    // 'idle' | 'spinning' | 'landing' | 'landed' | 'noMove'
    const [phase, setPhase] = useState('idle');
    const phaseRef = useRef('idle');

    const rollIdRef = useRef(0);
    const spinStartRef = useRef(null);
    const landTransformRef = useRef('none');
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
        socket?.emit('game:roll', roomId);
    }, [socket, roomId, setPhaseSafe, after, resetToIdle]);

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
        const wait = Math.max(0, MIN_SPIN_MS - elapsed);

        after(wait, myId, () => {
            landTransformRef.current = buildLandTransform(capturedResultRef.current);
            setPhaseSafe('landing');

            after(LANDING_MS, myId, () => {
                setPhaseSafe('landed');

                after(RESULT_HOLD_MS, myId, () => {
                    if (hasRolledNumberRef.current) {
                        // A legal move exists — server hasn't cleared the roll, so just
                        // wait for the player to actually pick a pawn on the board.
                        awaitingMoveRef.current = true;
                        return;
                    }
                    // No legal move — the server already passed the turn. Say so briefly.
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
                    src={hasRolledNumber ? images[rolledNumber - 1] : images[5]}
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
                        <DiceCube phase={phase} landTransform={landTransformRef.current} />
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
                            <img src={images[6]} alt='roll' />
                        </button>
                        <span className={styles.rollLabel}>{offlineHint ? 'Reconnecting…' : 'Roll Dice'}</span>
                    </span>
                ) : null
            ) : null}
        </div>
    );
};

export default React.memo(Dice);
