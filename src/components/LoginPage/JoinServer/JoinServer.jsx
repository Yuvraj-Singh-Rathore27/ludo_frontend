import React, { useCallback, useEffect, useRef, useState, useContext } from 'react';
import axios from 'axios';
import { RoomSocketContext, SetPlayerDataContext } from '../../../App';
import { useAuth } from '../../../context/AuthContext';
import refresh from '../../../images/login-page/refresh.png';
import WindowLayout from '../WindowLayout/WindowLayout';
import ServersTable from './ServersTable/ServersTable';
import withLoading from '../../HOC/withLoading';
// randomId, not crypto.randomUUID — that one only exists on https/localhost, so it was
// undefined on the plain-http production site.
import { randomId } from '../../../utils/browser';
import styles from './JoinServer.module.css';

const ServersTableWithLoading = withLoading(ServersTable);

const TABS = ['public', 'pools', 'code'];

// The lobby updates when something actually changes: the server pushes 'lobby:changed'
// the moment a room is created, filled, left, cancelled or started, and the list
// reloads then — no fixed polling loop. A slow safety refresh only covers the case
// where a push is missed (socket down / reconnecting), and it pauses while the tab is
// hidden. Several changes in a row are coalesced into one reload.
const SAFETY_REFRESH_MS = 60000;
const PUSH_DEBOUNCE_MS = 350;
// Coming back to the page fires 'visibilitychange' AND 'focus' together (and every click back
// from another window/DevTools fires 'focus' again), so a return-triggered reload waits at
// least this long after the last reload of any kind.
const RETURN_REFRESH_MIN_MS = 5000;

// Public Match is a disabled-by-default legacy feature (see backend PUBLIC_MATCH_ENABLED —
// its implementation is kept, just hidden from players). publicMatchEnabled comes from
// the backend (via LoginPage's /api/v1/stats poll), never hard-coded here, so enabling
// it again later needs no frontend change.
// matches lists EVERY current match of an entry fee (joinable and full alike); only the
// joinable ones count as open.
const openCount = pool => (pool.matches || []).filter(m => m.joinable).length;
const filledCount = pool => (pool.matches || []).filter(m => !m.joinable).length;
const waitingCount = pool => (pool.matches || []).filter(m => m.joinable).reduce((n, m) => n + m.joinedPlayers, 0);

const JoinServer = ({ onRoomsRefreshed, publicMatchEnabled = false }) => {
    const setPlayerData = useContext(SetPlayerDataContext);
    const roomSocket = useContext(RoomSocketContext); // Fastify socket — pushes lobby changes
    const { authUser } = useAuth();
    // DABBA launch: only Quick Match is shown (join-by-Code hidden) and the panel is titled
    // "Join Room". Normal Ludo users keep every tab.
    const isDabbaUser = !!authUser?.dabaUserId;
    // Quick Match (the Pools tab) is the default/primary way to play now — Public Match,
    // when enabled, is an extra option rather than the first thing a player sees.
    const [tab, setTab] = useState('pools');

    // If Public Match is (or becomes) disabled while it's the active tab — e.g. an admin
    // flips the flag while this page is open — fall back to Quick Match immediately.
    useEffect(() => {
        if (tab === 'public' && !publicMatchEnabled) setTab('pools');
    }, [tab, publicMatchEnabled]);

    // DABBA: the Code tab doesn't exist for them — never leave it active.
    useEffect(() => {
        if (tab === 'code' && isDabbaUser) setTab('pools');
    }, [tab, isDabbaUser]);

    /* ── Public rooms ─────────────────────────────────────────────────── */
    const [rooms, setRooms]     = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [joiningId, setJoiningId] = useState(null);
    const [roomError, setRoomError] = useState('');

    // `quiet` is used by the background refresh: it must not flip the table back to its
    // loading state (the list would flicker while the player is reading it) and must not
    // replace a visible error with a new one on a single failed poll.
    const roomsInFlight = useRef(false);
    const fetchRooms = useCallback(async ({ quiet = false } = {}) => {
        const token = localStorage.getItem('ludo_token');
        if (!token) { setIsLoading(false); return; }
        if (roomsInFlight.current) return; // never stack requests
        roomsInFlight.current = true;
        if (!quiet) {
            setIsLoading(true);
            setRoomError('');
        }
        try {
            const res = await axios.get('/api/v1/rooms/', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setRooms(res.data?.data || []);
            setRoomError('');
        } catch {
            if (!quiet) setRoomError('Failed to load rooms');
        } finally {
            roomsInFlight.current = false;
            if (!quiet) setIsLoading(false);
        }
    }, []);

    // Skip the fetch entirely while Public Match is disabled — nothing renders it, so
    // there is no reason to ask the backend for a list nobody will see.
    useEffect(() => { if (publicMatchEnabled) fetchRooms(); }, [fetchRooms, publicMatchEnabled]);

    const handleJoinClick = async room => {
        if (joiningId) return;
        const token = localStorage.getItem('ludo_token');
        if (!token) return;
        setJoiningId(room.roomId);
        setRoomError('');
        try {
            const idempotencyKey = randomId();
            const joinRes = await axios.post(
                '/api/v1/rooms/join',
                { roomId: room.roomId, idempotencyKey },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setPlayerData({ roomId: room.roomId, isHost: false, color: joinRes.data?.data?.color });
            onRoomsRefreshed?.();
        } catch (err) {
            if (err.response?.data?.code === 'ROOM_004') {
                try {
                    const roomRes = await axios.get(`/api/v1/rooms/${room.roomId}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const color = roomRes.data?.data?.players?.find(p => p.userId === authUser?.id)?.color;
                    setPlayerData({ roomId: room.roomId, isHost: false, color });
                    return;
                } catch {
                    setRoomError('You have already joined this room, but it could not be reopened');
                    setJoiningId(null);
                    return;
                }
            }
            setRoomError(err.response?.data?.message || 'Failed to join room');
            setJoiningId(null);
        }
    };

    /* ── Pools ────────────────────────────────────────────────────────── */
    const [pools, setPools]           = useState([]);
    const [poolsLoading, setPoolsLoading] = useState(false);
    const [joiningPoolId, setJoiningPoolId] = useState(null);
    const [joiningMatchId, setJoiningMatchId] = useState(null);
    // Step 1 shows the entry fees; picking one opens step 2 with only that fee's matches.
    const [selectedPoolId, setSelectedPoolId] = useState(null);
    const [poolError, setPoolError]   = useState('');

    const poolsInFlight = useRef(false);
    const fetchPools = useCallback(async ({ quiet = false } = {}) => {
        const token = localStorage.getItem('ludo_token');
        if (!token) return;
        if (poolsInFlight.current) return;
        poolsInFlight.current = true;
        if (!quiet) {
            setPoolsLoading(true);
            setPoolError('');
        }
        try {
            // quickMatch=true: only entry fees an admin has enabled as a Quick Match option
            // (the Private Room picker asks for the full approved list instead).
            const res = await axios.get('/api/v1/pools/', {
                params: { quickMatch: 'true' },
                headers: { Authorization: `Bearer ${token}` },
            });
            setPools(res.data?.data || []);
            setPoolError('');
        } catch {
            if (!quiet) setPoolError('Failed to load pools');
        } finally {
            poolsInFlight.current = false;
            if (!quiet) setPoolsLoading(false);
        }
    }, []);

    // First open of the Pools tab loads it; the live effect below keeps it current.
    useEffect(() => {
        if (tab === 'pools' && pools.length === 0) fetchPools();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, fetchPools]);

    /* ── Live lobby ───────────────────────────────────────────────────── */
    // Reload the open list whenever the server says it changed. Reloading (rather than
    // patching the list from the event) keeps one source of truth — the same endpoint
    // the manual refresh uses — so the list can never drift out of sync.
    const pushTimerRef = useRef(null);
    useEffect(() => {
        if (tab !== 'public' && tab !== 'pools') return undefined;

        let lastReloadAt = 0;
        const reload = () => {
            lastReloadAt = Date.now();
            return tab === 'public' ? fetchRooms({ quiet: true }) : fetchPools({ quiet: true });
        };
        const reloadIfVisible = () => {
            if (document.visibilityState === 'visible') reload();
        };
        const reloadOnReturn = () => {
            if (Date.now() - lastReloadAt < RETURN_REFRESH_MIN_MS) return;
            reloadIfVisible();
        };

        // A burst of changes (several players joining at once) triggers one reload.
        const onLobbyChanged = () => {
            if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
            pushTimerRef.current = setTimeout(() => {
                pushTimerRef.current = null;
                reloadIfVisible();
            }, PUSH_DEBOUNCE_MS);
        };

        // Subscribe to the lobby channel, and re-subscribe after any socket reconnect.
        const subscribe = () => roomSocket?.emit('lobby:join');
        subscribe();
        roomSocket?.on('connect', subscribe);
        roomSocket?.on('lobby:changed', onLobbyChanged);

        // Safety net only — covers a push missed while the socket was down.
        const safetyId = setInterval(reloadIfVisible, SAFETY_REFRESH_MS);
        // Returning to the lobby (tab switch / app resumed) shows fresh rooms at once.
        document.addEventListener('visibilitychange', reloadOnReturn);
        window.addEventListener('focus', reloadOnReturn);

        return () => {
            if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
            clearInterval(safetyId);
            roomSocket?.off('connect', subscribe);
            roomSocket?.off('lobby:changed', onLobbyChanged);
            roomSocket?.emit('lobby:leave');
            document.removeEventListener('visibilitychange', reloadOnReturn);
            window.removeEventListener('focus', reloadOnReturn);
        };
    }, [tab, roomSocket, fetchRooms, fetchPools]);

    const selectedPool = pools.find(p => p.id === selectedPoolId) || null;

    const handleJoinPool = async (pool, match = null) => {
        if (joiningPoolId) return;
        const token = localStorage.getItem('ludo_token');
        if (!token) return;
        setJoiningPoolId(pool.id);
        setJoiningMatchId(match ? match.roomId : null);
        setPoolError('');
        try {
            const idempotencyKey = randomId();
            const res = await axios.post(
                `/api/v1/pools/${pool.id}/join`,
                { idempotencyKey, ...(match ? { roomId: match.roomId } : {}) },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const { color, isHost, room } = res.data?.data;
            setPlayerData({ roomId: room.roomId, isHost: !!isHost, color });
            onRoomsRefreshed?.();
        } catch (err) {
            setPoolError(err.response?.data?.message || 'Failed to join pool');
            setJoiningPoolId(null);
            setJoiningMatchId(null);
            // A match may have just filled — reload so the list shows what is really open.
            fetchPools({ quiet: true });
        }
    };

    /* ── Join by Code ─────────────────────────────────────────────────── */
    const [roomCode, setRoomCode]   = useState('');
    const [codeError, setCodeError] = useState('');
    const [joiningByCode, setJoiningByCode] = useState(false);

    const handleJoinByCode = async e => {
        e.preventDefault();
        const code = roomCode.trim().toUpperCase();
        if (code.length !== 6) { setCodeError('Enter the full 6-letter room code'); return; }
        const token = localStorage.getItem('ludo_token');
        if (!token) return;
        setJoiningByCode(true);
        setCodeError('');
        try {
            const idempotencyKey = randomId();
            const res = await axios.post(
                '/api/v1/rooms/join-by-code',
                { roomCode: code, idempotencyKey },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const { color, room } = res.data?.data;
            setPlayerData({ roomId: room.roomId, isHost: false, color });
        } catch (err) {
            setCodeError(err.response?.data?.message || 'Invalid or expired room code');
            setJoiningByCode(false);
        }
    };

    return (
        <WindowLayout
            title={isDabbaUser ? 'Join Room' : 'Join A Server'}
            titleComponent={
                // The list keeps itself up to date; this stays for an on-demand refresh
                // and spins while a request is in flight so a tap visibly does something.
                ((tab === 'public' && publicMatchEnabled) || tab === 'pools') && (
                    <div className={styles.refresh}>
                        <img
                            src={refresh}
                            alt='Refresh list'
                            title='Refresh now'
                            className={tab === 'public' ? (isLoading ? styles.spinning : '') : poolsLoading ? styles.spinning : ''}
                            onClick={() => (tab === 'public' ? fetchRooms() : fetchPools())}
                        />
                    </div>
                )
            }
            content={
                <div className={styles.serversTableContainer}>
                    {/* Tabs */}
                    <div className={styles.tabs}>
                        {/* Public Match: hidden while disabled, not deleted — the tab, its
                            data fetching and its panel all come back the moment the backend
                            flag (PUBLIC_MATCH_ENABLED) is switched on again. */}
                        {publicMatchEnabled && (
                            <button type='button'
                                className={`${styles.tabBtn} ${tab === 'public' ? styles.tabActive : ''}`}
                                onClick={() => setTab('public')}>
                                Public
                            </button>
                        )}
                        <button type='button'
                            className={`${styles.tabBtn} ${tab === 'pools' ? styles.tabActive : ''}`}
                            onClick={() => setTab('pools')}>
                            ⚡ Quick Match
                        </button>
                        {/* DABBA: Code tab hidden (normal users still see it) */}
                        {!isDabbaUser && (
                            <button type='button'
                                className={`${styles.tabBtn} ${tab === 'code' ? styles.tabActive : ''}`}
                                onClick={() => setTab('code')}>
                                🔒 Code
                            </button>
                        )}
                    </div>

                    {/* ── Public Rooms (hidden unless re-enabled — see publicMatchEnabled) ── */}
                    {tab === 'public' && publicMatchEnabled && (
                        <>
                            {roomError && <p style={{ color: '#ff4d6a', fontSize: 14, padding: '8px 16px', margin: 0 }}>{roomError}</p>}
                            <ServersTableWithLoading
                                isLoading={isLoading}
                                rooms={rooms}
                                handleJoinClick={handleJoinClick}
                                joiningId={joiningId}
                            />
                        </>
                    )}

                    {/* ── Pools ── */}
                    {tab === 'pools' && (
                        <div className={styles.poolsContainer}>
                            {poolError && <p className={styles.codeError} style={{ textAlign: 'left', padding: '4px 0' }}>{poolError}</p>}
                            {poolsLoading ? (
                                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '28px 0', margin: 0, fontSize: 14 }}>
                                    Loading pools…
                                </p>
                            ) : pools.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', padding: '28px 0', margin: 0, fontSize: 14 }}>
                                    No Quick Match options right now
                                </p>
                            ) : (
                                selectedPool ? (
                                    <div className={styles.poolGroup}>
                                        <div className={styles.poolDetailHead}>
                                            <button type='button' className={styles.poolBack} onClick={() => setSelectedPoolId(null)}>
                                                ‹ Back
                                            </button>
                                            <div className={styles.poolDetailTitle}>
                                                <span className={styles.poolName}>₹{Number(selectedPool.entryFee)} Quick Match</span>
                                                <div className={styles.poolMeta}>
                                                    <span>{selectedPool.maxPlayers} players/match</span>
                                                    <span className={styles.poolDot}>·</span>
                                                    <span className={styles.poolPrize}>₹{selectedPool.prizePool} prize</span>
                                                </div>
                                            </div>
                                            <button
                                                type='button'
                                                className={styles.poolJoinBtn}
                                                disabled={!!joiningPoolId || !openCount(selectedPool)}
                                                onClick={() => handleJoinPool(selectedPool)}
                                            >
                                                {joiningPoolId === selectedPool.id && !joiningMatchId ? 'Finding…' : 'Find Match'}
                                            </button>
                                        </div>
                                        <div className={styles.poolStats}>
                                            <div className={styles.poolStat}>
                                                <span className={styles.poolStatValue}>{selectedPool.matches?.length || 0}</span>
                                                <span className={styles.poolStatLabel}>Total</span>
                                            </div>
                                            <div className={styles.poolStat}>
                                                <span className={styles.poolStatValue}>{openCount(selectedPool)}</span>
                                                <span className={styles.poolStatLabel}>Open</span>
                                            </div>
                                            <div className={styles.poolStat}>
                                                <span className={styles.poolStatValue}>{filledCount(selectedPool)}</span>
                                                <span className={styles.poolStatLabel}>Filled</span>
                                            </div>
                                            <div className={styles.poolStat}>
                                                <span className={styles.poolStatValue}>
                                                    {waitingCount(selectedPool)}/{openCount(selectedPool) * selectedPool.maxPlayers}
                                                </span>
                                                <span className={styles.poolStatLabel}>Players waiting</span>
                                            </div>
                                        </div>
                                        {selectedPool.matches?.length > 0 ? (
                                            <div className={styles.poolMatchList}>
                                                {selectedPool.matches.map(m => (
                                                    <div key={m.roomId} className={styles.poolMatchRow}>
                                                        <div className={styles.poolMatchLeft}>
                                                            <span className={styles.poolMatchName}>Match #{m.number}</span>
                                                            <span className={styles.poolMatchId}>{m.roomId}</span>
                                                        </div>
                                                        <span className={styles.poolMatchCount}>{m.joinedPlayers}/{m.maxPlayers}</span>
                                                        <span className={`${styles.poolMatchState} ${styles['poolState' + m.state]}`}>{m.state}</span>
                                                        <button
                                                            type='button'
                                                            className={styles.poolMatchBtn}
                                                            disabled={!!joiningPoolId || !m.joinable}
                                                            onClick={() => handleJoinPool(selectedPool, m)}
                                                        >
                                                            {joiningMatchId === m.roomId ? 'Joining…' : m.joinable ? 'Join' : 'Full'}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', padding: '20px 0', margin: 0, fontSize: 14 }}>
                                                No open matches for ₹{Number(selectedPool.entryFee)} right now
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    pools.map(pool => (
                                        <div
                                            key={pool.id}
                                            className={`${styles.poolCard} ${styles.poolCardClickable}`}
                                            role='button'
                                            tabIndex={0}
                                            onClick={() => setSelectedPoolId(pool.id)}
                                            onKeyDown={e => { if (e.key === 'Enter') setSelectedPoolId(pool.id); }}
                                        >
                                            <div className={styles.poolInfo}>
                                                <span className={styles.poolName}>{pool.name}</span>
                                                {pool.description && (
                                                    <span className={styles.poolDesc}>{pool.description}</span>
                                                )}
                                                <div className={styles.poolMeta}>
                                                    <span>₹{pool.entryFee} entry</span>
                                                    <span className={styles.poolDot}>·</span>
                                                    <span>{pool.maxPlayers} players/match</span>
                                                    <span className={styles.poolDot}>·</span>
                                                    <span className={styles.poolPrize}>₹{pool.prizePool} prize</span>
                                                    {Array.isArray(pool.matches) && (
                                                        <>
                                                            <span className={styles.poolDot}>·</span>
                                                            <span>{openCount(pool)} open match{openCount(pool) === 1 ? '' : 'es'}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={styles.poolOpenLink}>View matches ›</span>
                                        </div>
                                    ))
                                )
                            )}
                        </div>
                    )}

                    {/* ── Join by Code ── */}
                    {tab === 'code' && !isDabbaUser && (
                        <form className={styles.codeForm} onSubmit={handleJoinByCode}>
                            <p className={styles.codeHint}>
                                Ask the room host for their 6-letter private room code
                            </p>
                            <input
                                type='text'
                                className={styles.codeInput}
                                placeholder='e.g. AB3K7M'
                                value={roomCode}
                                maxLength={6}
                                onChange={e => {
                                    setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                                    setCodeError('');
                                }}
                                autoComplete='off'
                                spellCheck={false}
                            />
                            {codeError && <span className={styles.codeError}>{codeError}</span>}
                            <button
                                type='submit'
                                className={styles.joinCodeBtn}
                                disabled={joiningByCode || roomCode.length !== 6}
                            >
                                {joiningByCode ? 'Joining...' : 'Join Private Room'}
                            </button>
                        </form>
                    )}
                </div>
            }
        />
    );
};

export default JoinServer;
