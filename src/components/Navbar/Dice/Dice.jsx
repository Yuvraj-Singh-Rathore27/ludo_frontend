import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { SocketContext } from '../../../App';
import images from '../../../constants/diceImages';
import diceSound from '../../../images/dice/dice.mp3';
import styles from './Dice.module.css';

// ── What changed and why ───────────────────────────────────────────────────────
// BEFORE: setInterval at 50ms swapped PNG src every tick → 20 React state updates
//         per second → 20 re-renders per second → 20 DOM image swaps per second.
//
// AFTER:  isRolling toggles a single CSS class. The existing `diceRolling` keyframe
//         (already GPU-accelerated with will-change: transform) handles the spin
//         animation visually. No JS loop, no React renders during the roll.
//         The final face number appears when the server responds — same as before.
// ─────────────────────────────────────────────────────────────────────────────────

const Dice = ({ rolledNumber, nowMoving, playerColor, movingPlayer, variant = 'card' }) => {
    const socket = useContext(SocketContext);
    const [isRolling, setIsRolling] = useState(false);
    const audioRef = useRef(null);
    const stopTimeoutRef = useRef(null);

    const stopRolling = useCallback(() => {
        if (stopTimeoutRef.current) {
            clearTimeout(stopTimeoutRef.current);
            stopTimeoutRef.current = null;
        }
        setIsRolling(false);
    }, []);

    const handleClick = useCallback(() => {
        if (isRolling) return;

        // Lazy-create Audio object — avoids loading the sound file until first click
        if (!audioRef.current) {
            audioRef.current = new Audio(diceSound);
        }
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});

        // Start CSS animation — no setInterval, no face swapping, no React renders
        setIsRolling(true);

        // Safety net: if server never responds, stop after 6s so UI can't get stuck
        stopTimeoutRef.current = setTimeout(stopRolling, 6000);

        socket?.emit('game:roll');
    }, [isRolling, socket, stopRolling]);

    const isCurrentPlayer = movingPlayer === playerColor;
    const hasRolledNumber = rolledNumber !== null && rolledNumber !== undefined;

    // Stop the CSS animation when the server responds or turn passes
    useEffect(() => {
        if (hasRolledNumber || !isCurrentPlayer || !nowMoving) {
            stopRolling();
        }
    }, [hasRolledNumber, isCurrentPlayer, nowMoving, stopRolling]);

    // Cleanup safety timer on unmount
    useEffect(() => {
        return () => {
            if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
        };
    }, []);

    // Dock idle view — not this player's turn
    if (variant === 'dock' && (!isCurrentPlayer || (!nowMoving && !hasRolledNumber))) {
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

    const showTurnIndicator = variant === 'dock' && isCurrentPlayer && nowMoving;

    return (
        <div
            className={`${styles.container} ${variant === 'dock' ? styles.dockContainer : styles.cardContainer} ${
                showTurnIndicator ? styles.turnIndicator : ''
            }`}
        >
            {isCurrentPlayer ? (
                hasRolledNumber ? (
                    // Show the actual rolled face after server responds
                    <span className={styles.resultWrap}>
                        <img
                            className={styles.resultDie}
                            src={images[rolledNumber - 1]}
                            alt={rolledNumber}
                        />
                        <span className={styles.resultBadge} aria-hidden='true'>
                            {rolledNumber}
                        </span>
                    </span>
                ) : nowMoving ? (
                    // Roll button — CSS diceRolling keyframe handles the 3D spin animation.
                    // A single static image is shown; the spin gives the rolling illusion.
                    <button
                        className={`${styles.rollButton} ${styles[playerColor] || ''} ${
                            isRolling ? styles.rolling : styles.readyToRoll
                        }`}
                        type='button'
                        aria-label='Roll dice'
                        onClick={handleClick}
                        disabled={isRolling}
                    >
                        <img src={images[6]} alt='roll' />
                    </button>
                ) : null
            ) : null}
        </div>
    );
};

export default React.memo(Dice);
