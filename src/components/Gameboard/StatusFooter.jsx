import React, { useState, useEffect } from 'react';
import styles from './Gameboard.module.css';

// Inline only the five icons needed in the footer so this file stays self-contained
// and avoids a circular import with Gameboard.jsx.
const FIcon = React.memo(({ type, size = 13 }) => {
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
        'aria-hidden': 'true',
    };
    switch (type) {
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
        default:
            return null;
    }
});

// ── StatusFooter ──────────────────────────────────────────────────────────────
// Owns pingMs and clockTime state so their frequent updates (every 4s and 30s)
// never touch Gameboard or its children (Map, Navbar, Dice).
const StatusFooter = React.memo(({ socket, gameStarted }) => {
    const [pingMs, setPingMs] = useState(null);
    const [clockTime, setClockTime] = useState(() =>
        new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    );

    // Clock — updates every 30 seconds
    useEffect(() => {
        const update = () =>
            setClockTime(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
        const id = setInterval(update, 30000);
        return () => clearInterval(id);
    }, []);

    // Ping — measures round-trip latency every 4 seconds during active game only
    useEffect(() => {
        if (!socket || !gameStarted) return;
        let timedOut = false;

        const measure = () => {
            if (!socket.connected) return;
            const sentAt = Date.now();
            timedOut = false;
            const timeoutId = setTimeout(() => {
                timedOut = true;
            }, 4000);
            socket.emit('ping:check', sentAt, () => {
                if (timedOut) return;
                clearTimeout(timeoutId);
                setPingMs(Date.now() - sentAt);
            });
        };

        measure();
        const id = setInterval(measure, 4000);
        return () => clearInterval(id);
    }, [socket, gameStarted]);

    return (
        <footer className={styles.statusFooter} aria-label='Connection status'>
            <span className={styles.statusPing}>
                <FIcon type='wifi' /> Ping: {pingMs !== null ? `${pingMs}ms` : '—'}
            </span>
            <span className={styles.statusSecure}>
                <FIcon type='shield' /> Secure
            </span>
            <span className={styles.statusServer}>
                <FIcon type='server' /> IN-MUM
            </span>
            <span className={styles.statusSmooth}>
                <FIcon type='zap' /> Ultra Smooth
            </span>
            <span className={styles.statusTime}>
                <FIcon type='clock' /> {clockTime}
            </span>
        </footer>
    );
});

StatusFooter.displayName = 'StatusFooter';
export default StatusFooter;
