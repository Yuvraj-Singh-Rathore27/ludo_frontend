import React, { useMemo, useContext } from 'react';
import Dice from './Dice/Dice';
import NameContainer from './NameContainer/NameContainer';
import ReadyButton from './ReadyButton/ReadyButton';
import { PLAYER_COLORS } from '../../constants/colors';
import { PlayerDataContext } from '../../App';
import styles from './Navbar.module.css';

// Constant outside component — new array is not created on every render
const STAR_SCORES = [15, 12, 18, 16];

const Navbar = ({
    players,
    started,
    time,
    isReady,
    rolledNumber,
    nowMoving,
    movingPlayer,
    ended,
}) => {
    const context = useContext(PlayerDataContext);

    // Sort only when players list or current player changes — not on ping/clock/toast updates
    const orderedPlayers = useMemo(
        () =>
            players
                .map((player, index) => ({ player, index }))
                .filter(({ player }) => player.name !== '...')
                .sort((left, right) => {
                    const leftIsCurrent = left.player._id === context.playerId;
                    const rightIsCurrent = right.player._id === context.playerId;
                    if (leftIsCurrent === rightIsCurrent) return left.index - right.index;
                    return leftIsCurrent ? 1 : -1;
                }),
        [players, context.playerId]
    );

    // Stable object reference — Dice components won't re-render if these values haven't changed
    const diceProps = useMemo(
        () => ({ rolledNumber, nowMoving, movingPlayer }),
        [rolledNumber, nowMoving, movingPlayer]
    );

    return (
        <>
            {orderedPlayers.map(({ player, index }, slotIndex) => {
                const hasReadyAction = context.color === player.color && !started;
                const isCurrentTurn = started && !ended && player.nowMoving;
                const isCurrentUser = context.color === player.color;
                const statusText = isCurrentTurn
                    ? isCurrentUser
                        ? 'Your Turn'
                        : 'Playing'
                    : started
                      ? 'Playing'
                      : player.ready
                        ? 'Ready'
                        : 'Waiting';
                const playerColor = player.color || PLAYER_COLORS[index];

                return (
                    <div
                        className={`${styles.playerContainer} ${styles[playerColor]} ${styles[`slot${slotIndex + 1}`]} ${
                            hasReadyAction ? styles.actionSeat : ''
                        } ${isCurrentTurn ? styles.currentTurn : ''} ${
                            player.ready ? styles.readySeat : styles.waitingSeat
                        }`}
                        key={index}
                    >
                        {isCurrentUser ? <span className={styles.youBadge}>You</span> : null}
                        <NameContainer player={{ ...player, seatNumber: index + 1 }} time={time} />
                        <div className={styles.playerMeta}>
                            <strong>{player.name}</strong>
                            <span className={styles.scoreLine}>⭐ {STAR_SCORES[index]}</span>
                            {hasReadyAction ? (
                                <div className={styles.readyControl}>
                                    <ReadyButton isReady={isReady} />
                                </div>
                            ) : (
                                <em className={isCurrentTurn ? styles.liveStatus : styles.idleStatus}>
                                    <i></i>
                                    {statusText}
                                </em>
                            )}
                        </div>
                        <span className={styles.playerMenu} aria-hidden='true'>
                            ⋮
                        </span>
                        {started && !ended ? <Dice playerColor={playerColor} {...diceProps} /> : null}
                    </div>
                );
            })}
        </>
    );
};

Navbar.displayName = 'Navbar';
export default React.memo(Navbar);
