import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { SetPlayerDataContext } from '../../../App';
import { useAuth } from '../../../context/AuthContext';
import refresh from '../../../images/login-page/refresh.png';
import WindowLayout from '../WindowLayout/WindowLayout';
import ServersTable from './ServersTable/ServersTable';
import withLoading from '../../HOC/withLoading';
import styles from './JoinServer.module.css';

const ServersTableWithLoading = withLoading(ServersTable);

const TABS = ['public', 'pools', 'code'];

const JoinServer = ({ onRoomsRefreshed }) => {
    const setPlayerData = useContext(SetPlayerDataContext);
    const { authUser } = useAuth();
    const [tab, setTab] = useState('public');

    /* ── Public rooms ─────────────────────────────────────────────────── */
    const [rooms, setRooms]     = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [joiningId, setJoiningId] = useState(null);
    const [roomError, setRoomError] = useState('');

    const fetchRooms = async () => {
        const token = localStorage.getItem('ludo_token');
        if (!token) { setIsLoading(false); return; }
        setIsLoading(true);
        setRoomError('');
        try {
            const res = await axios.get('/api/v1/rooms/', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setRooms(res.data?.data || []);
        } catch { setRoomError('Failed to load rooms'); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchRooms(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleJoinClick = async room => {
        if (joiningId) return;
        const token = localStorage.getItem('ludo_token');
        if (!token) return;
        setJoiningId(room.roomId);
        setRoomError('');
        try {
            const idempotencyKey = crypto.randomUUID();
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
    const [poolError, setPoolError]   = useState('');

    const fetchPools = async () => {
        const token = localStorage.getItem('ludo_token');
        if (!token) return;
        setPoolsLoading(true);
        setPoolError('');
        try {
            const res = await axios.get('/api/v1/pools/', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setPools(res.data?.data || []);
        } catch { setPoolError('Failed to load pools'); }
        finally { setPoolsLoading(false); }
    };

    useEffect(() => {
        if (tab === 'pools' && pools.length === 0) fetchPools();
    }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleJoinPool = async pool => {
        if (joiningPoolId) return;
        const token = localStorage.getItem('ludo_token');
        if (!token) return;
        setJoiningPoolId(pool.id);
        setPoolError('');
        try {
            const idempotencyKey = crypto.randomUUID();
            const res = await axios.post(
                `/api/v1/pools/${pool.id}/join`,
                { idempotencyKey },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const { color, isHost, room } = res.data?.data;
            setPlayerData({ roomId: room.roomId, isHost: !!isHost, color });
            onRoomsRefreshed?.();
        } catch (err) {
            setPoolError(err.response?.data?.message || 'Failed to join pool');
            setJoiningPoolId(null);
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
            const idempotencyKey = crypto.randomUUID();
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
            title='Join A Server'
            titleComponent={
                tab === 'public' && (
                    <div className={styles.refresh}>
                        <img src={refresh} alt='refresh' onClick={fetchRooms} />
                    </div>
                )
            }
            content={
                <div className={styles.serversTableContainer}>
                    {/* Tabs */}
                    <div className={styles.tabs}>
                        <button type='button'
                            className={`${styles.tabBtn} ${tab === 'public' ? styles.tabActive : ''}`}
                            onClick={() => setTab('public')}>
                            Public
                        </button>
                        <button type='button'
                            className={`${styles.tabBtn} ${tab === 'pools' ? styles.tabActive : ''}`}
                            onClick={() => setTab('pools')}>
                            Pools
                        </button>
                        <button type='button'
                            className={`${styles.tabBtn} ${tab === 'code' ? styles.tabActive : ''}`}
                            onClick={() => setTab('code')}>
                            🔒 Code
                        </button>
                    </div>

                    {/* ── Public Rooms ── */}
                    {tab === 'public' && (
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
                                    No active pools right now
                                </p>
                            ) : (
                                pools.map(pool => (
                                    <div key={pool.id} className={styles.poolCard}>
                                        <div className={styles.poolInfo}>
                                            <span className={styles.poolName}>{pool.name}</span>
                                            {pool.description && (
                                                <span className={styles.poolDesc}>{pool.description}</span>
                                            )}
                                            <div className={styles.poolMeta}>
                                                <span>₹{pool.entryFee} entry</span>
                                                <span className={styles.poolDot}>·</span>
                                                <span>{pool.maxPlayers} players</span>
                                                <span className={styles.poolDot}>·</span>
                                                <span className={styles.poolPrize}>₹{pool.prizePool} prize</span>
                                            </div>
                                        </div>
                                        <button
                                            type='button'
                                            className={styles.poolJoinBtn}
                                            disabled={!!joiningPoolId}
                                            onClick={() => handleJoinPool(pool)}
                                        >
                                            {joiningPoolId === pool.id ? 'Joining…' : 'Join'}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* ── Join by Code ── */}
                    {tab === 'code' && (
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
