import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { PlayerDataContext, SocketContext, SetPlayerDataContext, RoomSocketContext } from '../../App';
import { useAuth } from '../../context/AuthContext';
import useSocketData from '../../hooks/useSocketData';
import Map from './Map/Map';
import NameContainer from '../Navbar/NameContainer/NameContainer';
import ReadyButton from '../Navbar/ReadyButton/ReadyButton';
import Dice from '../Navbar/Dice/Dice';
import Overlay from '../Overlay/Overlay';
import styles from './Gameboard.module.css';
import trophyImage from '../../images/trophy.webp';
import logoDice from '../../images/pages/ludi-profile.png';
import homeSound from '../../images/dice/dice.mp3';
import { getLocalPerspective } from './perspective';
import { MAX_ROLL_ANIMATION_MS } from '../Navbar/Dice/diceTiming';

// Maps a *visual* board corner (post-perspective-rotation) to which side of
// the dice the "Roll Dice" label sits on, and to the badge's own CSS class —
// the badge is the single positioned box per corner; the dice renders inside
// it (see hasDice below) rather than as a separate overlay.
const CORNER_LABEL_SIDE = { TL: 'below', TR: 'below', BL: 'above', BR: 'above' };
const BADGE_CORNER_CLASS = {
    TL: 'playerBadgeTL',
    TR: 'playerBadgeTR',
    BL: 'playerBadgeBL',
    BR: 'playerBadgeBR',
};

/* ── Inline SVG icon set (no extra dependency) ── */
const GIcon = React.memo(({ type, size = 20, className }) => {
    const p = {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg',
        stroke: 'currentColor',
        strokeWidth: '2',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        className,
        'aria-hidden': 'true',
    };
    switch (type) {
        case 'arrow-left':
            return (
                <svg {...p}>
                    <path d='M19 12H5' />
                    <path d='M12 5l-7 7 7 7' />
                </svg>
            );
        case 'copy':
            return (
                <svg {...p}>
                    <rect x='9' y='9' width='13' height='13' rx='2' />
                    <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
                </svg>
            );
        case 'users':
            return (
                <svg {...p}>
                    <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
                    <circle cx='9' cy='7' r='4' />
                    <path d='M23 21v-2a4 4 0 0 0-3-3.87' />
                    <path d='M16 3.13a4 4 0 0 1 0 7.75' />
                </svg>
            );
        case 'user-plus':
            return (
                <svg {...p}>
                    <path d='M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
                    <circle cx='8.5' cy='7' r='4' />
                    <line x1='20' y1='8' x2='20' y2='14' />
                    <line x1='23' y1='11' x2='17' y2='11' />
                </svg>
            );
        case 'settings':
            return (
                <svg {...p}>
                    <circle cx='12' cy='12' r='3' />
                    <path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' />
                </svg>
            );
        case 'exit':
            return (
                <svg {...p}>
                    <path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' />
                    <polyline points='16 17 21 12 16 7' />
                    <line x1='21' y1='12' x2='9' y2='12' />
                </svg>
            );
        case 'wifi':
            return (
                <svg {...p}>
                    <path d='M5 12.55a11 11 0 0 1 14.08 0' />
                    <path d='M1.42 9a16 16 0 0 1 21.16 0' />
                    <path d='M8.53 16.11a6 6 0 0 1 6.95 0' />
                    <line x1='12' y1='20' x2='12.01' y2='20' />
                </svg>
            );
        case 'shield':
            return (
                <svg {...p}>
                    <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />
                </svg>
            );
        case 'server':
            return (
                <svg {...p}>
                    <rect x='2' y='2' width='20' height='8' rx='2' />
                    <rect x='2' y='14' width='20' height='8' rx='2' />
                    <line x1='6' y1='6' x2='6.01' y2='6' />
                    <line x1='6' y1='18' x2='6.01' y2='18' />
                </svg>
            );
        case 'zap':
            return (
                <svg {...p}>
                    <polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2' />
                </svg>
            );
        case 'clock':
            return (
                <svg {...p}>
                    <circle cx='12' cy='12' r='10' />
                    <polyline points='12 6 12 12 16 14' />
                </svg>
            );
        case 'message':
            return (
                <svg {...p}>
                    <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
                </svg>
            );
        case 'send':
            return (
                <svg {...p}>
                    <line x1='22' y1='2' x2='11' y2='13' />
                    <polygon points='22 2 15 22 11 13 2 9 22 2' />
                </svg>
            );
        case 'coin':
            return (
                <svg {...p} stroke='none' fill='currentColor'>
                    <circle cx='12' cy='12' r='10' />
                    <circle cx='12' cy='12' r='7' fill='rgba(0,0,0,0.18)' />
                    <path
                        d='M12 7v1.5M12 15.5V17'
                        stroke='rgba(255,255,255,0.5)'
                        strokeWidth='1.5'
                        fill='none'
                        strokeLinecap='round'
                    />
                    <path
                        d='M10 10h3a2 2 0 0 1 0 4h-2a2 2 0 0 0 0 4h3'
                        stroke='rgba(255,255,255,0.5)'
                        strokeWidth='1.5'
                        fill='none'
                        strokeLinecap='round'
                    />
                </svg>
            );
        default:
            return null;
    }
});

const COLOR_DOT = { red: '#f44', blue: '#48f', green: '#4c4', yellow: '#fc0' };

const BTN_VARIANTS = {
    ghost:  { border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff' },
    red:    { border: '1px solid rgba(255,24,58,0.5)',    background: 'rgba(255,24,58,0.15)',   color: '#ff4d6a' },
    green:  { border: '1px solid rgba(76,255,136,0.5)',   background: 'rgba(76,255,136,0.12)',  color: '#4cff88' },
    orange: { border: '1px solid rgba(255,160,40,0.5)',   background: 'rgba(255,160,40,0.12)', color: '#ffa028' },
};

const BTN = React.memo(({ onClick, disabled, children, variant = 'ghost' }) => {
    const s = BTN_VARIANTS[variant] || BTN_VARIANTS.ghost;
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                flex: 1,
                padding: '12px 0',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.45 : 1,
                transition: 'opacity 0.15s',
                ...s,
            }}
        >
            {children}
        </button>
    );
});

const WaitingRoom = React.memo(({
    roomInfo,
    isHost,
    onLeave,
    leaving,
    onCancel,
    cancelling,
    onStart,
    starting,
    onRefresh,
    actionError,
    hostDisconnect,
}) => {
    const status = roomInfo?.roomStatus;
    const isReady = status === 'READY';
    const isActive = status === 'WAITING' || status === 'READY';
    const slots = roomInfo ? Math.max(roomInfo.maxPlayers - roomInfo.joinedPlayers, 0) : null;
    const filledPercent = roomInfo ? Math.min((roomInfo.joinedPlayers / roomInfo.maxPlayers) * 100, 100) : 0;

    const statusLabel = {
        WAITING: { text: 'Waiting for Players', color: '#ff1a38', soft: 'rgba(255, 26, 56, 0.18)' },
        READY: { text: 'All Players Joined — Ready!', color: '#4cff88', soft: 'rgba(76, 255, 136, 0.16)' },
        PLAYING: { text: 'Game in Progress', color: '#ffa028', soft: 'rgba(255, 160, 40, 0.16)' },
        CANCELLED: { text: 'Room Cancelled', color: '#888', soft: 'rgba(136, 136, 136, 0.16)' },
        COMPLETED: { text: 'Game Completed', color: '#4cff88', soft: 'rgba(76, 255, 136, 0.16)' },
    };
    const sl = statusLabel[status] || {
        text: 'Loading...',
        color: 'rgba(255,255,255,0.4)',
        soft: 'rgba(255, 255, 255, 0.1)',
    };
    const waitingMessage = isReady
        ? isHost
            ? 'All players have joined. Start the match when you are ready.'
            : 'All players have joined. The host is starting the match soon.'
        : isHost
          ? slots !== null
              ? `Room created. Waiting for ${slots} more player${slots !== 1 ? 's' : ''} to join.`
              : 'Room created. Waiting for players to join.'
          : slots !== null
            ? `You joined successfully. Waiting for ${slots} more player${slots !== 1 ? 's' : ''}.`
            : 'You joined successfully. Please wait while the room is getting ready.';

    return (
        <div className={styles.waitingPage} style={{ '--waiting-accent': sl.color, '--waiting-accent-soft': sl.soft }}>
            <div className={styles.waitingCard}>
                {/* ── Header ── */}
                <div style={{ textAlign: 'center' }}>
                    <div className={styles.waitingKicker}>{sl.text}</div>
                    <h2 style={{ margin: 0, color: '#fff', fontSize: 22, fontWeight: 800 }}>
                        {roomInfo?.roomId || '...'}
                    </h2>
                    {isHost && (
                        <div
                            style={{
                                marginTop: 6,
                                fontSize: 11,
                                color: 'rgba(255,160,40,0.8)',
                                fontWeight: 600,
                                letterSpacing: 1,
                                textTransform: 'uppercase',
                            }}
                        >
                            You are the host
                        </div>
                    )}
                </div>

                <div className={styles.waitingShowcase} aria-hidden='true'>
                    <span className={styles.waitingGlow}></span>
                    <div className={styles.waitingBoard}>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <div className={styles.waitingOrbit}>
                        <i></i>
                        <i></i>
                        <i></i>
                    </div>
                </div>

                <div className={styles.waitingMessage}>
                    <strong>{isReady ? 'Ready to play' : isHost ? 'Room is live' : 'Joined the room'}</strong>
                    <span>{waitingMessage}</span>
                </div>

                {/* ── Host disconnect banner ── */}
                {hostDisconnect && (
                    <div
                        style={{
                            padding: '12px 16px',
                            borderRadius: 10,
                            background: 'rgba(255, 160, 40, 0.12)',
                            border: '1px solid rgba(255, 160, 40, 0.35)',
                            textAlign: 'center',
                        }}
                    >
                        <div style={{ color: '#ffa028', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                            ⚠ Host Disconnected
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
                            Waiting for host to reconnect ({hostDisconnect.secondsLeft}s remaining)
                        </div>
                    </div>
                )}

                {/* ── Player count ── */}
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 40, fontWeight: 900, color: sl.color }}>
                        {roomInfo ? `${roomInfo.joinedPlayers} / ${roomInfo.maxPlayers}` : '— / —'}
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                        {isReady
                            ? 'All players joined!'
                            : slots !== null && isActive
                              ? `Waiting for ${slots} more player${slots !== 1 ? 's' : ''}...`
                              : ''}
                    </div>
                </div>

                {/* ── Progress bar ── */}
                {roomInfo && (
                    <div className={styles.waitingProgress}>
                        <div style={{ width: `${filledPercent}%` }} />
                    </div>
                )}

                {/* ── Players list (joined only) ── */}
                {roomInfo?.players?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {roomInfo.players.map((p, i) => (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '8px 12px',
                                    borderRadius: 8,
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.07)',
                                }}
                            >
                                <span
                                    style={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: '50%',
                                        background: COLOR_DOT[p.color] || '#888',
                                        flexShrink: 0,
                                    }}
                                />
                                <span
                                    style={{
                                        color: 'rgba(255,255,255,0.7)',
                                        fontSize: 14,
                                        textTransform: 'capitalize',
                                    }}
                                >
                                    {p.color} player
                                </span>
                                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#4cff88', fontWeight: 600 }}>
                                    Joined
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Entry fee ── */}
                {roomInfo?.entryFee && (
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 14px',
                            borderRadius: 8,
                            background: 'rgba(255,24,58,0.08)',
                            border: '1px solid rgba(255,24,58,0.18)',
                        }}
                    >
                        <span
                            style={{
                                color: 'rgba(255,255,255,0.45)',
                                fontSize: 12,
                                textTransform: 'uppercase',
                                letterSpacing: 1,
                            }}
                        >
                            Entry Fee
                        </span>
                        <strong style={{ color: '#fff', fontSize: 15 }}>&#8377;{roomInfo.entryFee}</strong>
                    </div>
                )}

                {/* ── Error ── */}
                {actionError && (
                    <div
                        style={{
                            padding: '10px 14px',
                            borderRadius: 8,
                            background: 'rgba(255,24,58,0.1)',
                            border: '1px solid rgba(255,24,58,0.3)',
                            color: '#ff4d6a',
                            fontSize: 13,
                        }}
                    >
                        {actionError}
                    </div>
                )}

                {/* ── Host actions: Start / Cancel ── */}
                {isHost && isActive && (
                    <div style={{ display: 'flex', gap: 10 }}>
                        <BTN variant='green' onClick={onStart} disabled={!isReady || starting || cancelling}>
                            {starting ? 'Starting...' : isReady ? 'Start Game' : 'Waiting for players'}
                        </BTN>
                        <BTN variant='orange' onClick={onCancel} disabled={cancelling || starting}>
                            {cancelling ? 'Cancelling...' : 'Cancel Room'}
                        </BTN>
                    </div>
                )}

                {/* ── Non-host actions: Leave / Refresh ── */}
                <div style={{ display: 'flex', gap: 10 }}>
                    <BTN variant='ghost' onClick={onRefresh}>
                        Refresh
                    </BTN>
                    {!isHost && isActive && (
                        <BTN variant='red' onClick={onLeave} disabled={leaving}>
                            {leaving ? 'Leaving...' : 'Leave Room'}
                        </BTN>
                    )}
                </div>
            </div>
        </div>
    );
});

const EXIT_SECONDS = 60;

const Gameboard = () => {
    const socket = useContext(SocketContext); // port 8081 — old MongoDB game server
    const roomSocket = useContext(RoomSocketContext); // port 8080 — new Fastify room events
    const context = useContext(PlayerDataContext);
    const { authUser } = useAuth();
    const [pawns, setPawns] = useState([]);
    const [players, setPlayers] = useState([]);

    const [rolledNumber, setRolledNumber] = useSocketData('game:roll');
    const [time, setTime] = useState();
    const [isReady, setIsReady] = useState();
    const [nowMoving, setNowMoving] = useState(false);
    const [started, setStarted] = useState(false);

    const [movingPlayer, setMovingPlayer] = useState('red');

    // Pins the dice overlay to whoever just rolled for the full animation
    // duration, so a fast server turn-pass (e.g. no legal move, single pawn
    // stuck) can't yank the dice to a different corner mid-animation. Purely
    // a UI concern — the actual turn/move logic below is unaffected.
    const [pinnedMover, setPinnedMover] = useState(null);
    const pinTimeoutRef = useRef(null);
    useEffect(() => {
        if (rolledNumber === null || rolledNumber === undefined) return undefined;
        setPinnedMover(movingPlayer);
        if (pinTimeoutRef.current) clearTimeout(pinTimeoutRef.current);
        pinTimeoutRef.current = setTimeout(() => setPinnedMover(null), MAX_ROLL_ANIMATION_MS);
        return undefined;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rolledNumber]);
    useEffect(() => () => { if (pinTimeoutRef.current) clearTimeout(pinTimeoutRef.current); }, []);
    const diceMover = pinnedMover || movingPlayer;

    const navigate = useNavigate();

    const [winner, setWinner] = useState(null); // 1st-place color string
    const [winnerInfo, setWinnerInfo] = useState(null); // { color, winnerId, winnerName }
    const [payout, setPayout] = useState(null);
    const [finishPositions, setFinishPositions] = useState([]);
    const [redirectCountdown, setRedirectCountdown] = useState(null);
    // { color → 'DISCONNECTED'|'RECONNECTED'|'ELIMINATED'|'FINISHED'|'WINNER'|'PLAYING' }
    // eslint-disable-next-line no-unused-vars
    const [playerStatuses, setPlayerStatuses] = useState({});
    // [{ id, message, type:'info'|'warn'|'success'|'error' }]
    const [notifications, setNotifications] = useState([]);
    const notifIdRef = useRef(0);
    const notifTimeoutsRef = useRef([]);

    // Push a toast notification that auto-dismisses after `ms` milliseconds
    const pushNotif = useCallback((message, type = 'info', ms = 5000) => {
        const id = ++notifIdRef.current;
        setNotifications(prev => [...prev, { id, message, type }]);
        const tid = setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), ms);
        notifTimeoutsRef.current.push(tid);
    }, []);

    // { [playerId]: { playerName, secondsLeft } } — live reconnect countdowns
    const [disconnectCountdowns, setDisconnectCountdowns] = useState({});
    const countdownIntervalsRef = useRef({});

    // Exit overlay — shown after clicking EXIT; hides when winner declared or player reconnects
    const [showExitOverlay, setShowExitOverlay] = useState(false);
    const [exitSecondsLeft, setExitSecondsLeft] = useState(EXIT_SECONDS);
    const exitIntervalRef = useRef(null);
    const cancelNavTimerRef = useRef(null);

    // Tracks whether room:started fired in this Gameboard instance.
    // Used to guard winner handlers so a freshly-mounted Gameboard for a
    // COMPLETED room never re-shows the result overlay.
    const gameStartedRef = useRef(false);
    // Prevents handleWinner from firing twice when both sockets emit game:winner
    const winnerHandledRef = useRef(false);
    // Lazily-created — avoids loading the sound file before it's ever needed
    const homeAudioRef = useRef(null);

    const startCountdown = useCallback((playerId, playerName, seconds) => {
        if (countdownIntervalsRef.current[playerId]) {
            clearInterval(countdownIntervalsRef.current[playerId]);
        }
        setDisconnectCountdowns(prev => ({ ...prev, [playerId]: { playerName, secondsLeft: seconds } }));
        const id = setInterval(() => {
            setDisconnectCountdowns(prev => {
                const cur = prev[playerId];
                if (!cur || cur.secondsLeft <= 1) {
                    clearInterval(id);
                    delete countdownIntervalsRef.current[playerId];
                    const { [playerId]: _removed, ...rest } = prev;
                    return rest;
                }
                return { ...prev, [playerId]: { ...cur, secondsLeft: cur.secondsLeft - 1 } };
            });
        }, 1000);
        countdownIntervalsRef.current[playerId] = id;
    }, []);

    const clearCountdown = useCallback(playerId => {
        if (countdownIntervalsRef.current[playerId]) {
            clearInterval(countdownIntervalsRef.current[playerId]);
            delete countdownIntervalsRef.current[playerId];
        }
        setDisconnectCountdowns(prev => {
            const { [playerId]: _removed, ...rest } = prev;
            return rest;
        });
    }, []);

    // Shared handler — registered on BOTH sockets (Fastify + MongoDB) so the popup
    // fires regardless of which server emits game:winner first.
    // Guard: only show winner if the game actually started in this component instance.
    // winnerHandledRef prevents double-fire when both sockets emit game:winner.
    const handleWinner = useCallback(({ color, winnerId, winnerName, position } = {}) => {
        if (!color || !gameStartedRef.current || winnerHandledRef.current) return;
        winnerHandledRef.current = true;
        setWinner(color);
        setWinnerInfo({ color, winnerId, winnerName, position });
        setPlayerStatuses(prev => ({ ...prev, [winnerId || color]: 'WINNER' }));
    }, []);

    // When winner is declared: dismiss exit overlay if open, then count down 10s → lobby
    useEffect(() => {
        if (!winner) return;
        if (exitIntervalRef.current) {
            clearInterval(exitIntervalRef.current);
            exitIntervalRef.current = null;
        }
        setShowExitOverlay(false);
        let secs = 10;
        setRedirectCountdown(secs);
        const id = setInterval(() => {
            secs -= 1;
            setRedirectCountdown(secs);
            if (secs <= 0) {
                clearInterval(id);
                setPlayerData(null);
                navigate('/lobby');
            }
        }, 1000);
        return () => clearInterval(id);
    }, [winner]); // eslint-disable-line react-hooks/exhaustive-deps

    const [roomInfo, setRoomInfo] = useState(null);
    const [leaving, setLeaving] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    // null | { hostName: string, secondsLeft: number }
    const [hostDisconnect, setHostDisconnect] = useState(null);
    const hostDisconnectIntervalRef = useRef(null);
    const [starting, setStarting] = useState(false);
    const [actionError, setActionError] = useState('');
    const [gameStarted, setGameStarted] = useState(false); // true after room:started fires
    const [gameStartData, setGameStartData] = useState(null); // data from room:started event
    const setPlayerData = useContext(SetPlayerDataContext);

    // Keep ref in sync so closures (handleWinner, onRoomData) can check current value
    useEffect(() => { gameStartedRef.current = gameStarted; }, [gameStarted]);

    const fetchRoomInfo = useCallback(async () => {
        if (!context?.roomId) return;
        const token = localStorage.getItem('ludo_token');
        if (!token) return;
        try {
            const res = await axios.get(`/api/v1/rooms/${context.roomId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setRoomInfo(res.data?.data || null);
        } catch {}
    }, [context?.roomId]);

    const roomStatus = roomInfo?.roomStatus;
    const isRoomActive = !roomStatus || roomStatus === 'WAITING' || roomStatus === 'READY';

    /* One fetch on mount to get initial room state */
    useEffect(() => {
        fetchRoomInfo();
    }, [fetchRoomInfo]); // eslint-disable-line

    /* Real-time updates via socket — fires once per actual event, no polling */
    useEffect(() => {
        if (!roomSocket || gameStarted) return;
        const refresh = () => fetchRoomInfo();

        // When all players have joined, aggressively re-assert socket room subscription.
        // The host can start the game immediately after room:ready fires; if this socket
        // isn't in the Fastify room at that moment it will miss room:started.
        const onReady = () => {
            fetchRoomInfo();
            if (context?.roomId && authUser?.id) {
                roomSocket.emit('join', {
                    roomId: context.roomId,
                    userId: authUser.id,
                    playerName: authUser.displayName || authUser.id,
                });
            }
        };

        roomSocket.on('room:player_joined', refresh);
        roomSocket.on('room:player_left', refresh);
        roomSocket.on('room:ready', onReady);
        return () => {
            roomSocket.off('room:player_joined', refresh);
            roomSocket.off('room:player_left', refresh);
            roomSocket.off('room:ready', onReady);
        };
    }, [roomSocket, gameStarted, fetchRoomInfo, context?.roomId, authUser?.id, authUser?.displayName]);

    /* Fallback polling — 3s when READY (host about to start), 20s when WAITING */
    useEffect(() => {
        if (!isRoomActive || gameStarted) return;
        const interval = roomStatus === 'READY' ? 3000 : 20000;
        const id = setInterval(fetchRoomInfo, interval);
        return () => clearInterval(id);
    }, [fetchRoomInfo, isRoomActive, gameStarted, roomStatus]);

    /* If the poll detects room was cancelled or completed (socket event missed), auto-navigate */
    useEffect(() => {
        if (gameStarted || (roomStatus !== 'CANCELLED' && roomStatus !== 'COMPLETED')) return;
        const id = setTimeout(() => {
            setPlayerData(null);
            navigate('/lobby');
        }, 3000);
        return () => clearTimeout(id);
    }, [roomStatus, gameStarted]); // eslint-disable-line react-hooks/exhaustive-deps

    // Clear timers on unmount
    useEffect(
        () => () => {
            if (startSafetyTimerRef.current) clearTimeout(startSafetyTimerRef.current);
            if (exitIntervalRef.current) clearInterval(exitIntervalRef.current);
            if (hostDisconnectIntervalRef.current) clearInterval(hostDisconnectIntervalRef.current);
            if (cancelNavTimerRef.current) clearTimeout(cancelNavTimerRef.current);
            notifTimeoutsRef.current.forEach(clearTimeout);
            notifTimeoutsRef.current = [];
        },
        []
    );

    // Drive the exit-overlay countdown. Starts when the overlay opens, resets when it closes.
    useEffect(() => {
        if (!showExitOverlay) {
            setExitSecondsLeft(EXIT_SECONDS);
            return;
        }
        let secs = EXIT_SECONDS;
        const id = setInterval(() => {
            secs -= 1;
            setExitSecondsLeft(secs);
            if (secs <= 0) {
                clearInterval(id);
                exitIntervalRef.current = null;
            }
        }, 1000);
        exitIntervalRef.current = id;
        return () => {
            clearInterval(id);
            exitIntervalRef.current = null;
        };
    }, [showExitOverlay]);

    // Join the Fastify socket room so we receive room lifecycle events (room:started, etc.)
    // Re-emits 'join' on every reconnect so late-connecting sockets still get room:started.
    useEffect(() => {
        if (!roomSocket || !context?.roomId || !authUser?.id) return;
        const emitJoin = () => {
            roomSocket.emit('join', {
                roomId: context.roomId,
                userId: authUser.id,
                playerName: authUser.displayName || authUser.id,
            });
        };
        emitJoin();
        roomSocket.on('connect', emitJoin);
        return () => {
            roomSocket.off('connect', emitJoin);
            roomSocket.emit('leave', context.roomId);
        };
    }, [roomSocket, context?.roomId, authUser?.id, authUser?.displayName]);

    const getToken = () => localStorage.getItem('ludo_token');

    const handleLeave = async () => {
        if (leaving) return;
        const token = getToken();
        if (!token) return;
        setLeaving(true);
        setActionError('');
        try {
            await axios.post(
                '/api/v1/rooms/leave',
                { roomId: context.roomId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (err) {
            setActionError(err.response?.data?.message || 'Failed to leave room');
            setLeaving(false);
            return;
        }
        setPlayerData(null);
    };

    const handleCancel = async () => {
        if (cancelling) return;
        const token = getToken();
        if (!token) return;
        setCancelling(true);
        setActionError('');
        try {
            await axios.post(
                '/api/v1/rooms/cancel',
                { roomId: context.roomId, reason: 'Host cancelled' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setPlayerData(null);
        } catch (err) {
            setActionError(err.response?.data?.message || 'Failed to cancel room');
            setCancelling(false);
        }
    };

    const startSafetyTimerRef = useRef(null);

    const handleStart = async () => {
        if (starting) return;
        const token = getToken();
        if (!token) return;
        setStarting(true);
        setActionError('');
        try {
            await axios.post(
                '/api/v1/rooms/start',
                { roomId: context.roomId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // Safety: if room:started never arrives within 15s, un-stick the button
            startSafetyTimerRef.current = setTimeout(() => {
                setStarting(false);
                setActionError('Game start is taking longer than expected — please try again.');
            }, 15000);
        } catch (err) {
            setActionError(err.response?.data?.message || 'Failed to start game');
            setStarting(false);
        }
    };

    // Clock and ping state now live in <StatusFooter> — their updates no longer
    // trigger re-renders of Gameboard, Map, Navbar, or Dice.

    // room:started fires from Fastify server → transition all players to game board
    // Also handles the re-emit sent to late-joining sockets (race condition recovery)
    useEffect(() => {
        if (!roomSocket || !context?.roomId) return;
        const onStarted = data => {
            // Cancel the 15s safety timer — game is starting normally
            if (startSafetyTimerRef.current) {
                clearTimeout(startSafetyTimerRef.current);
                startSafetyTimerRef.current = null;
            }
            setGameStarted(true);
            setGameStartData(prev => prev || data);
            setStarting(false);
            setActionError('');
            setTimeout(
                () =>
                    socket &&
                    socket.emit('room:data', {
                        roomId: context.roomId,
                        userId: authUser?.id,
                        color: context?.color,
                    }),
                400
            );
        };
        roomSocket.on('room:started', onStarted);
        return () => roomSocket.off('room:started', onStarted);
    }, [roomSocket, socket, context?.roomId, context?.color, authUser?.id]);

    // Frontend fallback: if room:started was missed entirely (e.g. socket connected
    // after the event fired AND the late-join re-emit also failed), the 3-second
    // fetchRoomInfo poll will eventually return roomStatus=PLAYING. Detect that and
    // transition directly without waiting for a socket event.
    useEffect(() => {
        if (gameStarted || roomInfo?.roomStatus !== 'PLAYING') return;
        setGameStarted(true);
        setStarting(false);
        setGameStartData(
            prev =>
                prev || {
                    roomId: roomInfo.roomId,
                    players: roomInfo.players || [],
                    totalPool:
                        roomInfo.entryFee && roomInfo.joinedPlayers
                            ? (parseFloat(roomInfo.entryFee) * roomInfo.joinedPlayers).toFixed(2)
                            : null,
                }
        );
        setTimeout(
            () =>
                socket &&
                socket.emit('room:data', {
                    roomId: context.roomId,
                    userId: authUser?.id,
                    color: context?.color,
                }),
            400
        );
    }, [roomInfo?.roomStatus, gameStarted]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Fastify socket (port 8080) — all game/room lifecycle events ───────────
    useEffect(() => {
        if (!roomSocket) return;

        const onPayout = data => setPayout(data);

        const onPlayerDisconnected = ({ playerId, playerName, remainingReconnectTime }) => {
            setPlayerStatuses(prev => ({ ...prev, [playerId]: 'DISCONNECTED' }));
            pushNotif(`${playerName} disconnected. Has ${remainingReconnectTime}s to reconnect.`, 'warn', 1000);
            startCountdown(playerId, playerName, remainingReconnectTime ?? 60);
        };

        const onPlayerReconnected = ({ playerId, playerName }) => {
            setPlayerStatuses(prev => ({ ...prev, [playerId]: 'RECONNECTED' }));
            clearCountdown(playerId);
            pushNotif(`${playerName} reconnected!`, 'success');
        };

        const onPlayerEliminated = ({ playerId, playerName }) => {
            setPlayerStatuses(prev => ({ ...prev, [playerId]: 'ELIMINATED' }));
            clearCountdown(playerId);
            pushNotif(`${playerName} has been eliminated from the match.`, 'error', 7000);
        };

        const onResults = ({ rankings }) => {
            if (!rankings?.length) return;
            setFinishPositions(rankings.map(r => ({ color: r.color, playerName: r.playerName, position: r.position })));
        };

        const onRefund = ({ userId, amount, reason }) => {
            if (userId === authUser?.id) {
                pushNotif(`₹${amount} refunded to your wallet. (${reason || 'Room cancelled'})`, 'success', 8000);
            }
        };

        const onCancelled = ({ reason }) => {
            if (hostDisconnectIntervalRef.current) {
                clearInterval(hostDisconnectIntervalRef.current);
                hostDisconnectIntervalRef.current = null;
            }
            setHostDisconnect(null);
            pushNotif(`Room cancelled${reason ? `: ${reason}` : ''}. Entry fee refunded.`, 'warn', 4000);
            cancelNavTimerRef.current = setTimeout(() => {
                setPlayerData(null);
                navigate('/lobby');
            }, 3000);
        };

        const onHostDisconnected = ({ hostName, remainingTime }) => {
            if (hostDisconnectIntervalRef.current) clearInterval(hostDisconnectIntervalRef.current);
            let secs = remainingTime ?? 60;
            setHostDisconnect({ hostName: hostName || 'Host', secondsLeft: secs });
            hostDisconnectIntervalRef.current = setInterval(() => {
                secs -= 1;
                setHostDisconnect(prev => prev ? { ...prev, secondsLeft: secs } : null);
                if (secs <= 0) {
                    clearInterval(hostDisconnectIntervalRef.current);
                    hostDisconnectIntervalRef.current = null;
                }
            }, 1000);
        };

        const onHostReconnected = ({ hostName }) => {
            if (hostDisconnectIntervalRef.current) {
                clearInterval(hostDisconnectIntervalRef.current);
                hostDisconnectIntervalRef.current = null;
            }
            setHostDisconnect(null);
            pushNotif(`Host reconnected. Game continues!`, 'success', 4000);
        };

        roomSocket.on('game:winner', handleWinner);
        roomSocket.on('game:payout', onPayout);
        roomSocket.on('game:player_disconnected', onPlayerDisconnected);
        roomSocket.on('game:player_reconnected', onPlayerReconnected);
        roomSocket.on('game:player_eliminated', onPlayerEliminated);
        roomSocket.on('game:results', onResults);
        roomSocket.on('wallet:refund', onRefund);
        roomSocket.on('room:cancelled', onCancelled);
        roomSocket.on('room:host_disconnected', onHostDisconnected);
        roomSocket.on('room:host_reconnected', onHostReconnected);

        return () => {
            roomSocket.off('game:winner', handleWinner);
            roomSocket.off('game:payout', onPayout);
            roomSocket.off('game:player_disconnected', onPlayerDisconnected);
            roomSocket.off('game:player_reconnected', onPlayerReconnected);
            roomSocket.off('game:player_eliminated', onPlayerEliminated);
            roomSocket.off('game:results', onResults);
            roomSocket.off('wallet:refund', onRefund);
            roomSocket.off('room:cancelled', onCancelled);
            roomSocket.off('room:host_disconnected', onHostDisconnected);
            roomSocket.off('room:host_reconnected', onHostReconnected);
            // Clear all running countdown intervals on unmount / socket change
            Object.values(countdownIntervalsRef.current).forEach(clearInterval);
            if (hostDisconnectIntervalRef.current) clearInterval(hostDisconnectIntervalRef.current);
            countdownIntervalsRef.current = {};
        };
    }, [roomSocket, authUser?.id, pushNotif, startCountdown, clearCountdown, handleWinner, navigate, setPlayerData]);

    useEffect(() => {
        if (!socket) return;
        socket.emit('room:data', {
            roomId: context.roomId,
            userId: authUser?.id,
            color: context?.color,
        });

        const onRoomData = raw => {
            let data;
            try {
                data = typeof raw === 'string' ? JSON.parse(raw) : raw;
            } catch {
                return;
            }
            if (!data || data.players == null) return;
            while (data.players.length !== 4) {
                data.players.push({ name: '...' });
            }
            const nowMovingPlayer = data.players.find(player => player.nowMoving === true);
            if (nowMovingPlayer) {
                const isMe = nowMovingPlayer._id === context.playerId || nowMovingPlayer.color === context.color;
                setNowMoving(isMe);
                setMovingPlayer(nowMovingPlayer.color);
            }
            const currentPlayer = data.players.find(
                player => player._id === context.playerId || player.color === context.color
            );
            if (currentPlayer) setIsReady(currentPlayer.ready);
            setRolledNumber(data.rolledNumber);
            setPlayers(data.players);
            // Guard: only set pawns when the array is valid — a null/short array
            // keeps the current state rather than breaking the board render
            if (Array.isArray(data.pawns) && data.pawns.length === 16) {
                setPawns(data.pawns);
            }
            setTime(data.nextMoveTime);
            setStarted(data.started);
            // Reconnection: restore finish order from room snapshot (includes player names).
            // Guard: only restore winner state if the game started in this instance —
            // prevents the result overlay re-appearing when a Gameboard mounts for a
            // COMPLETED room (e.g. accidental rejoin after game ended).
            if (data.finishOrder?.length >= 1 && gameStartedRef.current) {
                setFinishPositions(
                    data.finishOrder.map((color, i) => {
                        const p = data.players?.find(pl => pl.color === color);
                        return { color, position: i + 1, playerName: p?.name || color, playerId: p?.sessionID || '' };
                    })
                );
                setWinner(prev => prev || data.finishOrder[0]);
                setWinnerInfo(prev => {
                    if (prev) return prev;
                    const wp = data.players?.find(pl => pl.color === data.finishOrder[0]);
                    return {
                        color:      data.finishOrder[0],
                        winnerName: wp?.name || data.finishOrder[0],
                        winnerId:   wp?.sessionID || '',
                    };
                });
            }
        };
        // game:player_finished payload: { color, playerId, playerName, position }
        const onPlayerFinished = ({ color, playerId, playerName, position }) => {
            if (!homeAudioRef.current) homeAudioRef.current = new Audio(homeSound);
            homeAudioRef.current.currentTime = 0;
            homeAudioRef.current.play().catch(() => {});
            setPlayerStatuses(prev => ({ ...prev, [playerId || color]: 'FINISHED' }));
            setFinishPositions(prev => {
                const without = prev.filter(p => p.position !== position);
                return [...without, { color, playerId, playerName, position }].sort((a, b) => a.position - b.position);
            });
        };
        // Server sends 'redirect' after player:exit (pre-game only — live game uses the overlay)
        const onRedirect = () => {
            if (gameStartedRef.current) return; // live game: overlay handles navigation
            setPlayerData(null);
            navigate('/lobby');
        };

        socket.on('room:data', onRoomData);
        socket.on('game:winner', handleWinner);
        socket.on('game:player_finished', onPlayerFinished);
        socket.on('redirect', onRedirect);

        return () => {
            socket.off('room:data', onRoomData);
            socket.off('game:winner', handleWinner);
            socket.off('game:player_finished', onPlayerFinished);
            socket.off('redirect', onRedirect);
        };
    }, [
        socket,
        context.playerId,
        context.roomId,
        context?.color,
        authUser?.id,
        setRolledNumber,
        handleWinner,
        navigate,
        setPlayerData,
    ]);

    // Re-request game state when the MongoDB socket reconnects mid-game
    useEffect(() => {
        if (!socket || !context?.roomId) return;
        const onReconnect = () => {
            socket.emit('room:data', {
                roomId: context.roomId,
                userId: authUser?.id,
                color: context?.color,
            });
        };
        socket.on('connect', onReconnect);
        return () => socket.off('connect', onReconnect);
    }, [socket, context?.roomId, authUser?.id, context?.color]);

    // Retry room:data every 4s while gameStarted=true but board hasn't rendered yet
    // (guards against the MongoDB room creation taking longer than expected)
    useEffect(() => {
        if (!gameStarted || !socket || pawns.length === 16) return;
        const id = setInterval(() => {
            if (!socket.connected) return;
            socket.emit('room:data', {
                roomId: context?.roomId,
                userId: authUser?.id,
                color: context?.color,
            });
        }, 4000);
        return () => clearInterval(id);
    }, [gameStarted, socket, pawns.length, context?.roomId, authUser?.id, context?.color]);

    const myColor = gameStartData?.players?.find(p => p.userId === authUser?.id)?.color || context?.color;
    const totalPool =
        gameStartData?.totalPool ||
        (roomInfo?.entryFee && roomInfo?.joinedPlayers
            ? (parseFloat(roomInfo.entryFee) * roomInfo.joinedPlayers).toFixed(2)
            : null);
    const displayRoomId = gameStartData?.roomId || context?.roomId || '...';
    // During an active game prefer gameStartData.players (from room:started, always complete).
    // Before game starts, fall back to roomInfo.joinedPlayers (live SQL value from polling).
    const joinedPlayerCount = gameStarted
        ? (gameStartData?.players?.length || roomInfo?.joinedPlayers || players.filter(p => p.color).length)
        : (roomInfo?.joinedPlayers || gameStartData?.players?.length || players.filter(p => p.color).length);
    const maxPlayerCount = roomInfo?.maxPlayers || joinedPlayerCount;

    return (
        <>
            {pawns.length === 16 ? (
                <main className={styles.gameShell}>
                    <div className={styles.ambientLayer} aria-hidden='true'>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>

                    <div className={styles.gameFrame}>
                        {/* ── HEADER ── */}
                        <header className={styles.gameHeader}>
                            {/* ── LEFT: logo + back ── */}
                            <div className={styles.headerLeft}>
                                <button className={styles.menuButton} type='button' aria-label='Open menu'>
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </button>

                                <div className={styles.brand}>
                                    <div className={styles.brandLogoWrap}>
                                        <img src={logoDice} alt='' />
                                    </div>
                                    <div>
                                        <strong>LUDO</strong>
                                        <span>ARENA</span>
                                    </div>
                                </div>

                                <button className={styles.backButton} type='button' aria-label='Back'>
                                    <GIcon type='arrow-left' size={20} />
                                </button>
                            </div>

                            {/* ── CENTER: match stats ── */}
                            <div className={styles.matchStats} aria-label='Match details'>
                                <article>
                                    <span>Room ID</span>
                                    <strong>
                                        {displayRoomId}
                                        <button className={styles.copyBtn} type='button' aria-label='Copy room ID'>
                                            <GIcon type='copy' size={14} />
                                        </button>
                                    </strong>
                                </article>
                                <article>
                                    <span>Players</span>
                                    <strong>
                                        <GIcon type='users' size={16} className={styles.statIcon} />
                                        {joinedPlayerCount} / {maxPlayerCount}
                                    </strong>
                                </article>
                                <article>
                                    <span>Prize Pool</span>
                                    <strong>
                                        <GIcon type='coin' size={18} className={styles.coinSvg} />₹{totalPool ?? '—'}
                                    </strong>
                                </article>
                            </div>

                            {/* ── RIGHT: exit ── */}
                            <div className={styles.headerRight}>
                                <div className={styles.headerActions}>
                                    {/* <button className={styles.inviteButton} type='button'>
                                    <GIcon type='user-plus' size={16} />
                                    <span>Invite</span>
                                </button>
                                <button className={styles.settingsButton} type='button' aria-label='Settings'>
                                    <GIcon type='settings' size={20} />
                                </button> */}
                                    <button
                                        className={styles.exitButton}
                                        onClick={() => {
                                            const token = localStorage.getItem('ludo_token');
                                            if (gameStarted) {
                                                // Game is live — show 60s reconnect overlay instead of
                                                // navigating immediately. The overlay gives the player a
                                                // chance to change their mind; "Leave Match (Forfeit)"
                                                // inside the overlay handles the permanent exit path.
                                                if (roomSocket?.connected) roomSocket.emit('player:exit');
                                                setShowExitOverlay(true);
                                                return; // do NOT navigate — overlay takes over
                                            }
                                            // Pre-game (WAITING/READY): clean up the room slot via REST
                                            // then navigate. Fire-and-forget; server cleans up after.
                                            if (token && context?.roomId) {
                                                const endpoint = context?.isHost
                                                    ? '/api/v1/rooms/cancel'
                                                    : '/api/v1/rooms/leave';
                                                const body = context?.isHost
                                                    ? { roomId: context.roomId, reason: 'Host left' }
                                                    : { roomId: context.roomId };
                                                axios.post(endpoint, body, {
                                                    headers: { Authorization: `Bearer ${token}` },
                                                }).catch(() => {});
                                            }
                                            // Clean up the MongoDB session (pre-game only)
                                            if (socket?.connected) socket.emit('player:exit');
                                            setPlayerData(null);
                                            navigate('/lobby');
                                        }}
                                    >
                                        <GIcon type='exit' size={16} />
                                        <span>Exit</span>
                                    </button>
                                </div>
                            </div>
                        </header>

                        {/* ── MOBILE STATS ── */}
                        <section className={styles.mobileStats} aria-label='Match details'>
                            <article>
                                <span>Room ID</span>
                                <strong>
                                    {displayRoomId}
                                    <button className={styles.copyBtn} type='button' aria-label='Copy'>
                                        <GIcon type='copy' size={12} />
                                    </button>
                                </strong>
                            </article>
                            <article>
                                <span>Players</span>
                                <strong>
                                    <GIcon type='users' size={14} className={styles.statIcon} />
                                    {joinedPlayerCount} / {maxPlayerCount}
                                </strong>
                            </article>
                            <article>
                                <span>Prize</span>
                                <strong>
                                    <GIcon type='coin' size={14} className={styles.coinSvg} />₹{totalPool ?? '—'}
                                </strong>
                            </article>
                        </section>

                        {/* ── PLAY AREA ── */}
                        <section className={styles.playArea}>
                            <section className={styles.boardGrid}>
                                <div
                                    className={`${styles.boardPanel} ${nowMoving ? styles.yourTurnBoard : ''} ${
                                        nowMoving && rolledNumber ? styles.pickPawnBoard : ''
                                    }`}
                                >
                                    {nowMoving ? (
                                        <div className={styles.turnPrompt}>
                                            {rolledNumber ? 'Pick a pawn' : 'Roll the dice'}
                                        </div>
                                    ) : null}
                                    {players
                                        .filter(p => p.name !== '...')
                                        .map(p => {
                                            // Each player's own compact profile badge sits right at
                                            // their own board corner — wherever that visually lands
                                            // for THIS viewer once the local rotation is applied.
                                            // The dice lives INSIDE that same badge, as one box,
                                            // whenever this is the (pinned) player currently rolling.
                                            const corner = getLocalPerspective(context.color).visualCornerOf(p.color);
                                            if (!corner) return null;
                                            const isCurrentTurn = started && winner === null && p.nowMoving;
                                            const isSelf = context.color === p.color;
                                            const hasReadyAction = isSelf && !started;
                                            const hasDice = p.color === diceMover;
                                            return (
                                                <div
                                                    key={p._id || p.color}
                                                    className={`${styles.playerBadge} ${styles[BADGE_CORNER_CLASS[corner]] || ''} ${
                                                        isCurrentTurn ? styles.playerBadgeActive : ''
                                                    }`}
                                                >
                                                    <NameContainer player={p} time={time} />
                                                    <div className={styles.playerBadgeInfo}>
                                                        {isSelf ? <span className={styles.playerBadgeYou}>You</span> : null}
                                                        {hasReadyAction ? <ReadyButton isReady={isReady} /> : null}
                                                    </div>
                                                    {hasDice ? (
                                                        <div className={styles.playerBadgeDice}>
                                                            <Dice
                                                                variant='dock'
                                                                rolledNumber={rolledNumber}
                                                                nowMoving={nowMoving}
                                                                movingPlayer={diceMover}
                                                                playerColor={diceMover}
                                                                labelSide={CORNER_LABEL_SIDE[corner]}
                                                            />
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    <Map pawns={pawns} nowMoving={nowMoving} rolledNumber={rolledNumber} />
                                </div>
                            </section>

                            <section className={styles.actionDock} aria-label='Game actions'>
                                <div className={styles.turnTimer}>
                                    <span>Your Turn</span>
                                    <strong>18s</strong>
                                </div>
                            </section>
                        </section>

                        {/* ── CHAT DOCK ── */}
                        <section className={styles.chatDock} aria-label='Chat shortcuts'>
                            <button type='button' aria-label='Open chat'>
                                <GIcon type='message' size={22} />
                            </button>
                            <div className={styles.chatInput}>Type a message...</div>
                            <button className={styles.sendButton} type='button' aria-label='Send message'>
                                <GIcon type='send' size={18} />
                            </button>
                            <div className={styles.reactions}>
                                <button type='button'>😀</button>
                                <button type='button'>😂</button>
                                <button type='button'>😮</button>
                                <button type='button'>🔥</button>
                            </div>
                        </section>

                    </div>
                </main>
            ) : gameStarted ? (
                // room:started received — waiting for MongoDB game server to return board data
                // The retry effect above re-requests room:data every 4s if this lingers
                <div
                    style={{
                        minHeight: '100vh',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#0d0d18',
                        color: '#fff',
                        gap: 20,
                    }}
                >
                    <div
                        className={styles.spinner}
                        style={{
                            borderTopColor: myColor
                                ? { red: '#f44', blue: '#48f', green: '#4c4', yellow: '#fc0' }[myColor] || '#ff1a38'
                                : '#ff1a38',
                        }}
                    />
                    <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>Game Starting…</div>
                    {totalPool && (
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Prize Pool: ₹{totalPool}</div>
                    )}
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
                        Loading game board — please wait…
                    </div>
                </div>
            ) : (
                <WaitingRoom
                    roomInfo={roomInfo}
                    isHost={!!context?.isHost}
                    onLeave={handleLeave}
                    leaving={leaving}
                    onCancel={handleCancel}
                    cancelling={cancelling}
                    onStart={handleStart}
                    starting={starting}
                    onRefresh={fetchRoomInfo}
                    actionError={actionError}
                    hostDisconnect={hostDisconnect}
                />
            )}

            {/* ── Toast notifications ── */}
            {notifications.length > 0 && (
                <div
                    style={{
                        position: 'fixed',
                        top: 20,
                        right: 20,
                        zIndex: 50,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        maxWidth: 320,
                    }}
                >
                    {notifications.map(n => {
                        const colors = {
                            info: { bg: 'rgba(30,60,120,0.95)', border: 'rgba(100,160,255,0.4)', text: '#a8ccff' },
                            warn: { bg: 'rgba(80,50,10,0.95)', border: 'rgba(255,180,40,0.4)', text: '#ffd166' },
                            success: { bg: 'rgba(10,60,30,0.95)', border: 'rgba(76,255,136,0.4)', text: '#4cff88' },
                            error: { bg: 'rgba(70,10,20,0.95)', border: 'rgba(255,60,80,0.4)', text: '#ff6b7a' },
                        };
                        const c = colors[n.type] || colors.info;
                        return (
                            <div
                                key={n.id}
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: 10,
                                    background: c.bg,
                                    border: `1px solid ${c.border}`,
                                    color: c.text,
                                    fontSize: 13,
                                    fontWeight: 500,
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                                    backdropFilter: 'blur(8px)',
                                }}
                            >
                                {n.message}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Reconnect countdown banners (persistent, left side) ── */}
            {Object.keys(disconnectCountdowns).length > 0 && (
                <div
                    style={{
                        position: 'fixed',
                        top: 20,
                        left: 20,
                        zIndex: 50,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        maxWidth: 270,
                        pointerEvents: 'none',
                    }}
                >
                    {Object.entries(disconnectCountdowns).map(([playerId, { playerName, secondsLeft }]) => {
                        const pct = Math.round((secondsLeft / 60) * 100);
                        const barColor = secondsLeft <= 15 ? '#ff6b7a' : secondsLeft <= 30 ? '#ffd166' : '#4cff88';
                        return (
                            <div
                                key={playerId}
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: 10,
                                    background: 'rgba(12,14,30,0.97)',
                                    border: `1px solid ${barColor}55`,
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                                    backdropFilter: 'blur(10px)',
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: 7,
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: '#ddd',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            maxWidth: 160,
                                        }}
                                    >
                                        {playerName} disconnected
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 20,
                                            fontWeight: 800,
                                            color: barColor,
                                            marginLeft: 8,
                                            letterSpacing: -1,
                                        }}
                                    >
                                        {secondsLeft}s
                                    </span>
                                </div>
                                {/* Progress bar — drains as time runs out */}
                                <div
                                    style={{
                                        height: 5,
                                        borderRadius: 3,
                                        background: 'rgba(255,255,255,0.08)',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div
                                        style={{
                                            height: '100%',
                                            width: `${pct}%`,
                                            background: barColor,
                                            transition: 'width 0.95s linear, background 0.4s ease',
                                            borderRadius: 3,
                                        }}
                                    />
                                </div>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 5 }}>
                                    Reconnect window — {secondsLeft}s remaining
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Exit overlay — shown after EXIT; player can reconnect within 60s ── */}
            {showExitOverlay && !winner && (
                <Overlay>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 16,
                            textAlign: 'center',
                            padding: '0 8px',
                            maxWidth: 320,
                        }}
                    >
                        <div style={{ fontSize: 44 }}>🚪</div>
                        <h2 style={{ margin: 0, color: '#ffa028', fontSize: 22, fontWeight: 800 }}>
                            You Left the Game
                        </h2>
                        <p style={{ margin: 0, color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.5 }}>
                            Your opponent has a {EXIT_SECONDS}s window. Reconnect now to stay in the match — or
                            forfeit and leave.
                        </p>
                        {/* Countdown bar */}
                        <div
                            style={{
                                width: '100%',
                                height: 8,
                                background: 'rgba(255,255,255,0.08)',
                                borderRadius: 4,
                                overflow: 'hidden',
                            }}
                        >
                            <div
                                style={{
                                    height: '100%',
                                    borderRadius: 4,
                                    width: `${(exitSecondsLeft / 60) * 100}%`,
                                    background:
                                        exitSecondsLeft <= 15
                                            ? '#ff4d6a'
                                            : exitSecondsLeft <= 30
                                              ? '#ffa028'
                                              : '#4cff88',
                                    transition: 'width 0.95s linear, background 0.4s ease',
                                }}
                            />
                        </div>
                        <div
                            style={{
                                fontSize: 36,
                                fontWeight: 800,
                                letterSpacing: -1,
                                color: exitSecondsLeft <= 15 ? '#ff4d6a' : '#fff',
                            }}
                        >
                            {exitSecondsLeft}s
                        </div>
                        <button
                            onClick={() => {
                                if (exitIntervalRef.current) {
                                    clearInterval(exitIntervalRef.current);
                                    exitIntervalRef.current = null;
                                }
                                setShowExitOverlay(false);
                                // Re-joining the Fastify room cancels the backend 60s timer
                                if (roomSocket?.connected) {
                                    roomSocket.emit('join', {
                                        roomId: context.roomId,
                                        userId: authUser.id,
                                        playerName: authUser.displayName || authUser.id,
                                    });
                                }
                            }}
                            style={{
                                width: '100%',
                                padding: '14px 0',
                                borderRadius: 8,
                                border: '1px solid rgba(76,255,136,0.5)',
                                background: 'rgba(76,255,136,0.18)',
                                color: '#4cff88',
                                fontSize: 15,
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            Reconnect to Game
                        </button>
                        <button
                            onClick={() => {
                                if (exitIntervalRef.current) {
                                    clearInterval(exitIntervalRef.current);
                                    exitIntervalRef.current = null;
                                }
                                // Notify backend immediately — other player wins right away
                                if (roomSocket?.connected) roomSocket.emit('player:forfeit');
                                if (socket?.connected) socket.emit('player:exit');
                                setPlayerData(null);
                                navigate('/lobby');
                            }}
                            style={{
                                width: '100%',
                                padding: '12px 0',
                                borderRadius: 8,
                                border: '1px solid rgba(255,24,58,0.4)',
                                background: 'rgba(255,24,58,0.1)',
                                color: '#ff4d6a',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Leave Match (Forfeit)
                        </button>
                    </div>
                </Overlay>
            )}

            {/* ── Winner / Game-Over popup ── */}
            {winner
                ? (() => {
                      const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };
                      const posLabel = ['', '1st', '2nd', '3rd', '4th'];

                      // Build leaderboard rows — prefer payout.results (has amounts + names),
                      // fall back to finishPositions (real-time, no amounts yet)
                      let leaderboard = [];
                      if (payout?.results?.length) {
                          leaderboard = payout.results.map(r => ({
                              position: r.position,
                              color: r.color,
                              playerName: r.playerName || r.color,
                              amount: r.amount,
                              paid: parseFloat(r.amount || 0) > 0,
                              processing: false,
                          }));
                          // Append players who haven't finished yet (3rd/4th in 4-player)
                          const allColors =
                              gameStartData?.players?.map(p => p.color) ||
                              players.filter(p => p.color).map(p => p.color);
                          const ranked = new Set(leaderboard.map(r => r.color));
                          let nextPos = leaderboard.length + 1;
                          for (const color of allColors) {
                              if (color && !ranked.has(color)) {
                                  const ps = players.find(pl => pl.color === color);
                                  leaderboard.push({
                                      position: nextPos++,
                                      color,
                                      playerName: ps?.name || color,
                                      amount: '0',
                                      paid: false,
                                      processing: false,
                                  });
                              }
                          }
                      } else if (finishPositions.length) {
                          leaderboard = finishPositions.map(fp => ({
                              ...fp,
                              playerName: fp.playerName || fp.color,
                              amount: '0',
                              paid: false,
                              processing: true,
                          }));
                      }

                      const myResult = leaderboard.find(r => r.color === myColor);
                      const iWon = myColor === winner;
                      const displayWinnerName = winnerInfo?.winnerName || winner;

                      return (
                          <Overlay>
                              <div className={styles.winnerContainer}>
                                  <img src={trophyImage} alt='trophy' />

                                  {/* Headline — uses real player name */}
                                  {iWon ? (
                                      <h1 style={{ color: '#4cff88' }}>You Won! 🎉</h1>
                                  ) : (
                                      <h1>
                                          <span style={{ color: COLOR_DOT[winner] || '#fff' }}>
                                              {displayWinnerName}
                                          </span>{' '}
                                          wins!
                                      </h1>
                                  )}

                                  {/* Personal result summary */}
                                  {myResult && (
                                      <p className={styles.payoutAmount}>
                                          {myResult.paid
                                              ? iWon
                                                  ? `You won ₹${myResult.amount}!`
                                                  : `You finished ${posLabel[myResult.position]} — ₹${myResult.amount}`
                                              : myResult.processing
                                                ? 'Calculating payouts…'
                                                : `You finished ${posLabel[myResult.position] || myResult.position}`}
                                      </p>
                                  )}

                                  {/* Match leaderboard */}
                                  {leaderboard.length > 0 && (
                                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                          {leaderboard.map(row => {
                                              const isMe = row.color === myColor;
                                              return (
                                                  <div
                                                      key={row.position}
                                                      style={{
                                                          display: 'flex',
                                                          alignItems: 'center',
                                                          gap: 10,
                                                          padding: '9px 12px',
                                                          borderRadius: 8,
                                                          background: isMe
                                                              ? 'rgba(76,255,136,0.09)'
                                                              : 'rgba(255,255,255,0.04)',
                                                          border: `1px solid ${isMe ? 'rgba(76,255,136,0.28)' : 'rgba(255,255,255,0.07)'}`,
                                                      }}
                                                  >
                                                      <span style={{ width: 22, textAlign: 'center', fontSize: 15 }}>
                                                          {MEDAL[row.position] || row.position}
                                                      </span>
                                                      <span
                                                          style={{
                                                              width: 10,
                                                              height: 10,
                                                              borderRadius: '50%',
                                                              background: COLOR_DOT[row.color] || '#888',
                                                              flexShrink: 0,
                                                          }}
                                                      />
                                                      <span
                                                          style={{
                                                              flex: 1,
                                                              fontSize: 13,
                                                              color: isMe ? '#e8ffef' : '#ccc',
                                                              overflow: 'hidden',
                                                              textOverflow: 'ellipsis',
                                                              whiteSpace: 'nowrap',
                                                          }}
                                                      >
                                                          {row.playerName}
                                                          {isMe ? ' (You)' : ''}
                                                      </span>
                                                      <span
                                                          style={{
                                                              fontSize: 13,
                                                              fontWeight: 700,
                                                              flexShrink: 0,
                                                              color: row.paid ? '#ffcf19' : 'rgba(255,255,255,0.25)',
                                                          }}
                                                      >
                                                          {row.processing ? (
                                                              <span style={{ fontSize: 11 }}>…</span>
                                                          ) : row.paid ? (
                                                              `₹${row.amount}`
                                                          ) : (
                                                              '—'
                                                          )}
                                                      </span>
                                                  </div>
                                              );
                                          })}
                                      </div>
                                  )}

                                  {/* Pool + fee footer */}
                                  {totalPool && (
                                      <div
                                          style={{
                                              fontSize: 12,
                                              color: 'rgba(255,255,255,0.35)',
                                              borderTop: '1px solid rgba(255,255,255,0.08)',
                                              paddingTop: 10,
                                          }}
                                      >
                                          Prize Pool: ₹{totalPool}
                                          {payout?.platformFee && (
                                              <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.2)' }}>
                                                  (Platform fee: ₹{payout.platformFee})
                                              </span>
                                          )}
                                      </div>
                                  )}

                                  <button
                                      onClick={() => {
                                          setPlayerData(null);
                                          navigate('/lobby');
                                      }}
                                      style={{
                                          width: '100%',
                                          minHeight: 46,
                                          border: '1px solid rgba(76,255,136,0.5)',
                                          background: 'rgba(76,255,136,0.18)',
                                          color: '#4cff88',
                                          borderRadius: 8,
                                          fontSize: 15,
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                      }}
                                  >
                                      Go to Dashboard
                                      {redirectCountdown !== null && redirectCountdown > 0
                                          ? ` (${redirectCountdown}s)`
                                          : ''}
                                  </button>
                              </div>
                          </Overlay>
                      );
                  })()
                : null}
        </>
    );
};

export default Gameboard;
