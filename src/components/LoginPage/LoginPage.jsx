import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AddServer from './AddServer/AddServer';
import JoinServer from './JoinServer/JoinServer';
import GlobalNavbar from '../GlobalNavbar/GlobalNavbar';
import { SetPlayerDataContext } from '../../App';
import { useAuth } from '../../context/AuthContext';
import heroBoard from '../../images/pages/login-ludo-hero-clean.webp';
import heroBoardMobile from '../../images/pages/login-ludo-3.webp';
import bgImage from '../../images/pages/bg-1.webp';
import diceImg from '../../images/dice/6.png';
import redPawn from '../../images/pawns/login/red-pawn.webp';
import bluePawn from '../../images/pawns/login/blue-pawn.webp';
import greenPawn from '../../images/pawns/login/green-pawn.webp';
import yellowPawn from '../../images/pawns/login/yellow-pawn.webp';
import styles from './LoginPage.module.css';

const Icon = ({ type, className }) => {
    const p = {
        className,
        viewBox: '0 0 48 48',
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg',
        'aria-hidden': 'true',
    };

    switch (type) {
        case 'players':
            return (
                <svg {...p} className={`${className} ${styles.solidSvgIcon}`}>
                    <circle cx='18' cy='15' r='7' />
                    <circle cx='33' cy='17' r='5.5' />
                    <path d='M5 39c.9-8.9 6.2-14 13-14s12.1 5.1 13 14H5z' />
                    <path d='M28 39c.7-5.8 4.2-9.6 8.7-9.6 3.4 0 6.1 2 7.7 5.4.9 1.9-.5 4.2-2.6 4.2H28z' />
                </svg>
            );
        case 'speed':
            return (
                <svg {...p} className={`${className} ${styles.speedSvgIcon}`}>
                    <path d='M8 35a16 16 0 0 1 32 0' />
                    <path d='M13 35h4M31 35h4M15 25l4 4M33 25l-4 4M24 21v5' />
                    <path d='M24 35l10-13' />
                    <circle cx='24' cy='35' r='3.4' />
                </svg>
            );
        case 'lock':
            return (
                <svg {...p}>
                    <rect x='13' y='21' width='22' height='18' rx='3' />
                    <path d='M17 21v-6a7 7 0 0 1 14 0v6' />
                    <path d='M24 28v5' />
                </svg>
            );
        case 'shield':
            return (
                <svg {...p}>
                    <path d='M24 6l16 6v10c0 10-6.5 17-16 20C14.5 39 8 32 8 22V12l16-6z' />
                    <path d='M17 24l5 5 10-11' />
                </svg>
            );
        case 'gamepad':
            return (
                <svg {...p}>
                    <path d='M13 20h22c4.2 0 7 3.2 7 7.4v3.4c0 3.1-2.5 5.2-5.3 4.3l-5.3-1.8H16.6l-5.3 1.8C8.5 36 6 33.9 6 30.8v-3.4C6 23.2 8.8 20 13 20z' />
                    <path d='M17 25v7M13.5 28.5h7M31.5 27.5h.1M36 30.5h.1' />
                </svg>
            );
        case 'crown':
            return (
                <svg {...p}>
                    <path d='M8 36h32l-3-22-9 10-4-14-4 14-9-10-3 22z' />
                    <path d='M11 40h26' />
                </svg>
            );
        case 'home':
            return (
                <svg {...p}>
                    <path d='M7 23L24 9l17 14' />
                    <path d='M13 21v18h22V21' />
                    <path d='M20 39V28h8v11' />
                </svg>
            );
        case 'friends':
            return (
                <svg {...p}>
                    <circle cx='19' cy='16' r='7' />
                    <circle cx='33' cy='18' r='5' />
                    <path d='M7 40c1-8.2 5.5-12 12-12s11 3.8 12 12' />
                    <path d='M29 30c5.5.4 9 3.6 10 10' />
                </svg>
            );
        case 'trophy':
            return (
                <svg {...p}>
                    <path d='M16 8h16v9c0 6-3.4 10-8 10s-8-4-8-10V8z' />
                    <path d='M16 12H8v4c0 4.4 3.4 8 8 8M32 12h8v4c0 4.4-3.4 8-8 8' />
                    <path d='M24 27v8M16 40h16M19 35h10' />
                </svg>
            );
        case 'history':
            return (
                <svg {...p}>
                    <path d='M14 16h-6v-6' />
                    <path d='M9 16a17 17 0 1 1 2 19' />
                    <path d='M24 15v10l7 4' />
                </svg>
            );
        case 'coin':
            return (
                <svg {...p}>
                    <circle cx='24' cy='24' r='16' />
                    <circle cx='24' cy='24' r='11' strokeWidth='1.6' />
                    <path d='M24 16v2.5M24 29.5v2.5' strokeLinecap='round' />
                    <path d='M21 20.5h5c2 0 3.5 1.5 3.5 3.5s-1.5 3.5-3.5 3.5h-3c-2 0-3.5 1.5-3.5 3.5s1.5 3.5 3.5 3.5h5.5' strokeLinecap='round' />
                </svg>
            );
        case 'rooms':
            return (
                <svg {...p}>
                    <rect x='6' y='6' width='15' height='15' rx='2.5' />
                    <rect x='27' y='6' width='15' height='15' rx='2.5' />
                    <rect x='6' y='27' width='15' height='15' rx='2.5' />
                    <rect x='27' y='27' width='15' height='15' rx='2.5' />
                </svg>
            );
        case 'bolt':
            return (
                <svg {...p}>
                    <path d='M28 5L9 27h14l-3 16L39 21H25l3-16z' strokeLinejoin='round' />
                </svg>
            );
        case 'monitor':
        default:
            return (
                <svg {...p}>
                    <rect x='8' y='10' width='32' height='22' rx='2' />
                    <path d='M19 38h10M24 32v6' />
                </svg>
            );
    }
};

const LoginPage = () => {
    const [mobileTab, setMobileTab] = useState('join');
    const [stats, setStats] = useState({ activeRooms: null, playersOnline: null });
    const [activeRoom, setActiveRoom] = useState(null);
    const dismissedRef = useRef(false); // true after user clicks Dismiss — stops re-showing
    const setPlayerData = useContext(SetPlayerDataContext);
    const { authUser } = useAuth();

    const fetchStats = useCallback(async (signal) => {
        try {
            const res = await fetch('/api/v1/stats', { signal });
            const json = await res.json();
            if (json?.data) setStats(json.data);
        } catch (e) {
            if (e.name !== 'AbortError') { /* silently ignore — fallback stays */ }
        }
    }, []);

    useEffect(() => {
        const ctrl = new AbortController();
        fetchStats(ctrl.signal);
        const id = setInterval(() => fetchStats(ctrl.signal), 30000);
        return () => { clearInterval(id); ctrl.abort(); };
    }, [fetchStats]);

    const myRoomIntervalRef = useRef(null);

    useEffect(() => {
        if (!authUser?.id) return;

        let active = true; // prevents stale callbacks after cleanup

        const checkActiveRoom = () => {
            if (!active || dismissedRef.current) return;
            const token = localStorage.getItem('ludo_token');
            if (!token) return;
            fetch('/api/v1/rooms/my-room', { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.json())
                .then(json => {
                    if (!active || dismissedRef.current) return;
                    const room = json?.data || null;
                    // Discard if the room is already finished — guards the race window
                    // where endGame hasn't committed yet when the lobby first loads.
                    if (room && (room.roomStatus === 'COMPLETED' || room.roomStatus === 'CANCELLED')) return;
                    setActiveRoom(room);
                })
                .catch(() => {});
        };

        // Delay the first check by 3 s so a just-completed game's endGame call
        // has time to commit before we query — avoids the banner flashing after
        // "Go to Dashboard" from the winner popup.
        const initTimer = setTimeout(() => {
            checkActiveRoom();
            myRoomIntervalRef.current = setInterval(checkActiveRoom, 30000);
        }, 3000);

        return () => {
            active = false;
            clearTimeout(initTimer);
            clearInterval(myRoomIntervalRef.current);
            myRoomIntervalRef.current = null;
        };
    }, [authUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className={styles.pageRoot} style={{ '--bg-img': `url(${bgImage})` }}>

            {/* ── TOP NAV BAR — outside container so sticky works through overflow-x: hidden ── */}
            <GlobalNavbar activePage='home' />

            <div className={styles.container}>

            {/* ── LUDO BG CANVAS ── */}
            <div className={styles.bgCanvas} aria-hidden='true'>
                <img src={diceImg}    className={`${styles.bgEl} ${styles.bgDice1}`}  alt='' />
                <img src={redPawn}    className={`${styles.bgEl} ${styles.bgPawn1}`}  alt='' />
                <img src={bluePawn}   className={`${styles.bgEl} ${styles.bgPawn2}`}  alt='' />
                <img src={greenPawn}  className={`${styles.bgEl} ${styles.bgPawn3}`}  alt='' />
                <img src={yellowPawn} className={`${styles.bgEl} ${styles.bgPawn4}`}  alt='' />
            </div>

            {/* ── HERO ── */}
            <section className={styles.hero}>
                <div className={styles.heroText}>
                    <p className={styles.heroPill}>
                        <Icon type='bolt' className={styles.heroPillIcon} />
                        {stats.playersOnline !== null ? stats.playersOnline.toLocaleString() : '—'} players online now
                    </p>
                    <h1>
                        Play the <span className={styles.boardText}>board.</span>
                        <br />
                        Own the <span className={styles.tableText}>table.</span>
                    </h1>
                    <p className={styles.heroDesc}>
                        Join a live Ludo board or host your own table with smooth turns, private rooms, and fast classic matches.
                    </p>
                    <div className={styles.heroCta}>
                        <button type='button' className={styles.heroBtn}>
                            <Icon type='bolt' className={styles.heroBtnIcon} />
                            Quick Match
                        </button>
                        <button type='button' className={styles.heroBtnOutline}>
                            <Icon type='gamepad' className={styles.heroBtnIcon} />
                            Browse Rooms
                        </button>
                    </div>
                </div>
                <picture>
                    <source media='(max-width: 767px)' srcSet={heroBoardMobile} />
                    <img src={heroBoard} alt='Ludo board game' />
                </picture>
            </section>

            {/* ── STATS STRIP ── */}
            <section className={styles.stats}>
                <article>
                    <Icon type='players' className={styles.statSvgIcon} />
                    <div>
                        <strong>{stats.playersOnline !== null ? stats.playersOnline.toLocaleString() : '—'}</strong>
                        <span>Players Online</span>
                    </div>
                </article>
                <article>
                    <Icon type='rooms' className={styles.statSvgIcon} />
                    <div>
                        <strong>{stats.activeRooms !== null ? stats.activeRooms.toLocaleString() : '—'}</strong>
                        <span>Active Rooms</span>
                    </div>
                </article>
                <article>
                    <Icon type='bolt' className={styles.statSvgIcon} />
                    <div>
                        <strong>Fast Match</strong>
                        <span>Quick Join</span>
                    </div>
                </article>
            </section>

            {/* ── RESUME ROOM BANNER (fixed overlay — always visible) ── */}
            {activeRoom && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 24,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                        padding: '16px 24px',
                        borderRadius: 14,
                        background: 'linear-gradient(135deg, rgba(20,10,0,0.97) 0%, rgba(40,20,0,0.97) 100%)',
                        border: '1.5px solid rgba(255, 160, 40, 0.6)',
                        boxShadow: '0 8px 40px rgba(255,160,40,0.25)',
                        flexWrap: 'wrap',
                        maxWidth: 600,
                        width: 'calc(100vw - 48px)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span style={{ fontSize: 26 }}>⚡</span>
                        <div>
                            <div style={{ color: '#ffa028', fontWeight: 800, fontSize: 15, marginBottom: 3 }}>
                                You have an active room!
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
                                {activeRoom.roomId} &nbsp;·&nbsp; ₹{activeRoom.entryFee} entry &nbsp;·&nbsp;
                                {activeRoom.joinedPlayers}/{activeRoom.maxPlayers} players &nbsp;·&nbsp;
                                {activeRoom.isHost ? 'You are the host' : `Color: ${activeRoom.color}`}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            type='button'
                            onClick={() => setPlayerData({ roomId: activeRoom.roomId, isHost: activeRoom.isHost, color: activeRoom.color })}
                            style={{
                                padding: '10px 22px',
                                borderRadius: 8,
                                background: '#ffa028',
                                color: '#000',
                                fontWeight: 800,
                                fontSize: 14,
                                border: 'none',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            Resume Room
                        </button>
                        <button
                            type='button'
                            onClick={() => { dismissedRef.current = true; setActiveRoom(null); }}
                            style={{
                                padding: '10px 14px',
                                borderRadius: 8,
                                background: 'rgba(255,255,255,0.07)',
                                color: 'rgba(255,255,255,0.45)',
                                fontWeight: 600,
                                fontSize: 13,
                                border: '1px solid rgba(255,255,255,0.12)',
                                cursor: 'pointer',
                            }}
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* ── MOBILE QUICK-MATCH (hidden on desktop) ── */}
            <button className={styles.quickMatch} type='button'>
                <Icon type='bolt' className={styles.quickMatchSvgIcon} />
                Quick Match
            </button>

            {/* ── MOBILE TABS (hidden on desktop) ── */}
            <div className={styles.mobileTabs}>
                <button
                    className={mobileTab === 'join' ? styles.activeTab : ''}
                    onClick={() => setMobileTab('join')}
                    type='button'
                >
                    <Icon type='gamepad' className={styles.navSvgIcon} />
                    Join A Server
                </button>
                <button
                    className={mobileTab === 'host' ? styles.activeTab : ''}
                    onClick={() => setMobileTab('host')}
                    type='button'
                >
                    <Icon type='crown' className={styles.navSvgIcon} />
                    Host A Server
                </button>
            </div>

            {/* ── JOIN / HOST PANELS ── */}
            <section className={`${styles.panelGrid} ${styles[`show${mobileTab}`]}`}>
                <div className={styles.joinPanel}>
                    <JoinServer onRoomsRefreshed={fetchStats} />
                </div>
                <div className={styles.hostPanel}>
                    <AddServer />
                </div>
            </section>

            {/* ── FEATURE STRIP ── */}
            <section className={styles.features}>
                <article>
                    <Icon type='speed' className={styles.featureIcon} />
                    <div>
                        <strong>Smooth Gameplay</strong>
                        <span>No Lag, Just Fun</span>
                    </div>
                </article>
                <article>
                    <Icon type='lock' className={styles.featureIcon} />
                    <div>
                        <strong>Private Rooms</strong>
                        <span>Play with Friends</span>
                    </div>
                </article>
                <article>
                    <Icon type='shield' className={styles.featureIcon} />
                    <div>
                        <strong>Secure & Safe</strong>
                        <span>100% Fair Play</span>
                    </div>
                </article>
                <article>
                    <Icon type='monitor' className={styles.featureIcon} />
                    <div>
                        <strong>Cross Platform</strong>
                        <span>Play Anywhere</span>
                    </div>
                </article>
            </section>

        </div>
        </div>
    );
};

export default LoginPage;
