import React, { useEffect, useState } from 'react';
import styles from './ConnectionBanner.module.css';

// Wait a moment before announcing a drop so a brief reconnect doesn't flash the banner.
const SHOW_DELAY_MS = 1500;

const readOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

// Tells the player when their connection is down. Without it, a dropped connection
// just looks like the dice "not moving" and the player thinks the game is broken.
const ConnectionBanner = ({ socket }) => {
    const [online, setOnline] = useState(readOnline);
    const [socketUp, setSocketUp] = useState(() => (socket ? socket.connected : true));
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const goOnline = () => setOnline(true);
        const goOffline = () => setOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    useEffect(() => {
        if (!socket) {
            setSocketUp(true);
            return undefined;
        }
        const up = () => setSocketUp(true);
        const down = () => setSocketUp(false);
        setSocketUp(socket.connected);
        socket.on('connect', up);
        socket.on('disconnect', down);
        socket.on('connect_error', down);
        return () => {
            socket.off('connect', up);
            socket.off('disconnect', down);
            socket.off('connect_error', down);
        };
    }, [socket]);

    const disconnected = !online || !socketUp;

    useEffect(() => {
        if (!disconnected) {
            setVisible(false);
            return undefined;
        }
        const t = setTimeout(() => setVisible(true), online ? SHOW_DELAY_MS : 0);
        return () => clearTimeout(t);
    }, [disconnected, online]);

    if (!visible) return null;

    return (
        <div className={styles.banner} role='alert' aria-live='assertive'>
            <span className={styles.spinner} aria-hidden='true' />
            <span>
                {online
                    ? 'Connection lost. Reconnecting to the game…'
                    : 'No internet connection. The game will resume when you are back online.'}
            </span>
        </div>
    );
};

export default ConnectionBanner;
