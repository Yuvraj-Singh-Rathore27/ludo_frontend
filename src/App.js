import React, { useEffect, useState, createContext } from 'react';
import { io } from 'socket.io-client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Gameboard       from './components/Gameboard/Gameboard';
import GlobalLoader    from './components/GlobalLoader/GlobalLoader';
import loaderStyles    from './components/GlobalLoader/GlobalLoader.module.css';
import LoginPage       from './components/LoginPage/LoginPage';
import ProfilePage     from './components/Profile/ProfilePage';
import WalletPage      from './components/Wallet/WalletPage';
import HistoryPage     from './components/History/HistoryPage';
import SignupScreen    from './components/Auth/SignupScreen/SignupScreen';
import AuthLoginScreen from './components/Auth/AuthLoginScreen/AuthLoginScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WalletProvider }        from './context/WalletContext';
import { AudioProvider }         from './context/AudioContext';
import { LaunchProvider, useLaunch } from './context/LaunchContext';

// Shown when a DABBA launch link fails. "Continue" drops the link and falls back to the
// normal flow (Lobby if a Ludo session exists, otherwise Login).
const LaunchError = ({ onContinue }) => (
    <main className={loaderStyles.container} role='alert'>
        <div className={loaderStyles.card}>
            <div className={loaderStyles.mark}>L</div>
            <div className={loaderStyles.copy}>
                <h1>Link expired or invalid</h1>
                <p>Please open Ludo again from the DABBA app.</p>
            </div>
            <button
                type='button'
                onClick={onContinue}
                style={{
                    marginTop: 8, padding: '10px 22px', borderRadius: 8, border: 'none',
                    background: '#ffd670', color: '#1a0d00', fontWeight: 800, cursor: 'pointer',
                }}
            >
                Continue
            </button>
        </div>
    </main>
);

export const PlayerDataContext    = createContext();
export const SetPlayerDataContext = createContext();
export const SocketContext        = createContext();
export const RoomSocketContext    = createContext(); // new Fastify socket (port 8080) for room events

const AppRoutes = () => {
    const { authUser } = useAuth();
    const { dabaLoginPending, dabaLaunchError, dismissLaunchError } = useLaunch();
    const loggedIn = !!authUser;

    const [playerData,   setPlayerData]   = useState(null);
    const [playerSocket, setPlayerSocket] = useState(null);
    const [roomSocket,   setRoomSocket]   = useState(null);
    const [loading,      setLoading]      = useState(loggedIn); // show loader only if already authed on mount

    // Old MongoDB game socket — handles actual Ludo gameplay events
    useEffect(() => {
        if (!loggedIn) {
            setPlayerData(null);
            return;
        }

        setLoading(true);

        const socket = io(`http://${window.location.hostname}:8081`, {
            withCredentials: true,
            // WebSocket first, polling only as a fallback (same as the room socket
            // below). The default starts on HTTP long-polling and upgrades later, so
            // every early game event paid extra HTTP round trips — each one also
            // loading and re-saving the session on the server — which is the
            // slowest possible path on a slow or flaky mobile connection.
            transports: ['websocket', 'polling'],
            // Without this the client never falls back to polling when WebSocket is
            // blocked (some mobile carriers / proxies) and just keeps failing.
            tryAllTransports: true,
            // Send the JWT so the game server can verify identity (spectator
            // prevention); function form picks up the latest token on reconnect.
            auth: cb => cb({ token: localStorage.getItem('ludo_token') }),
        });

        setPlayerSocket(socket);

        // This effect creates exactly one game socket per login (no StrictMode
        // double-invoke; cleanup disconnects it). socket.io fires 'connect' again on
        // every automatic reconnect of that same socket, so label the two cases —
        // otherwise a reconnect reads like a duplicate connection in the console.
        let connectedBefore = false;
        socket.on('connect', () => {
            console.log(connectedBefore ? 'Socket Reconnected' : 'Socket Connected');
            connectedBefore = true;
            setLoading(false);
        });
        socket.on('disconnect', reason => {
            console.log('Socket Disconnected:', reason);
        });

        socket.on('player:data', data => {
            try {
                if (typeof data === 'string') data = JSON.parse(data);

                // Server already verified the room is active before emitting player:data.
                // If it was completed/cancelled, the server emits 'redirect' instead.
                // No client-side room status check needed here.
                setPlayerData(prev => {
                    if (prev?.roomId && data.roomId && prev.roomId !== data.roomId) {
                        return prev;
                    }
                    return prev ? { ...prev, ...data, isHost: prev.isHost } : data;
                });
            } catch (err) {
                console.log(err);
            }
            setLoading(false);
        });

        socket.on('connect_error', err => {
            console.log(err);
            setLoading(false);
        });

        const timeout = setTimeout(() => setLoading(false), 2000);

        return () => {
            clearTimeout(timeout);
            socket.disconnect();
            setPlayerSocket(null);
        };
    }, [loggedIn]);

    // New Fastify room socket — handles room lifecycle events (room:started, room:player_joined, etc.)
    useEffect(() => {
        if (!loggedIn) {
            setRoomSocket(null);
            return;
        }

        const rs = io(`http://${window.location.hostname}:8080`, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
            // Without this the client never falls back to polling when WebSocket is
            // blocked (some mobile carriers / proxies) and just keeps failing.
            tryAllTransports: true,
            // Use function form so each reconnect attempt picks up the latest token
            auth: cb => cb({ token: localStorage.getItem('ludo_token') }),
        });

        setRoomSocket(rs);

        return () => {
            rs.disconnect();
            setRoomSocket(null);
        };
    }, [loggedIn]);

    // DABBA launch link: wait for the Ludo login instead of bouncing to the Login page.
    if (dabaLoginPending) {
        return <GlobalLoader title='Loading Ludo Arena' message='Logging you in...' />;
    }

    // DABBA launch link rejected (expired / tampered / not verified by DABBA).
    if (dabaLaunchError) {
        return <LaunchError onContinue={dismissLaunchError} />;
    }

    if (loading) {
        return <GlobalLoader title='Loading Ludo Arena' message='Connecting players...' />;
    }

    return (
        <SetPlayerDataContext.Provider value={setPlayerData}>
        <RoomSocketContext.Provider value={roomSocket}>
        <SocketContext.Provider value={playerSocket}>
            <Routes>
                {/* ── AUTH SCREENS ── */}
                <Route
                    path='/signup'
                    element={loggedIn ? <Navigate to='/lobby' replace /> : <SignupScreen />}
                />
                <Route
                    path='/auth/login'
                    element={loggedIn ? <Navigate to='/lobby' replace /> : <AuthLoginScreen />}
                />

                {/* ── HOME ── */}
                <Route
                    path='/'
                    element={
                        !loggedIn          ? <Navigate to='/auth/login' replace /> :
                        playerData?.roomId ? <Navigate to='/game' /> :
                                             <Navigate to='/lobby' replace />
                    }
                />

                {/* ── LOBBY ── */}
                <Route
                    path='/lobby'
                    element={
                        !loggedIn          ? <Navigate to='/auth/login' replace /> :
                        playerData?.roomId ? <Navigate to='/game' /> :
                                             <LoginPage />
                    }
                />

                {/* ── PROFILE ── */}
                <Route
                    path='/profile'
                    element={!loggedIn ? <Navigate to='/auth/login' replace /> : <ProfilePage />}
                />

                {/* ── WALLET ── */}
                <Route
                    path='/wallet'
                    element={!loggedIn ? <Navigate to='/auth/login' replace /> : <WalletPage />}
                />

                {/* ── HISTORY ── */}
                <Route
                    path='/history'
                    element={!loggedIn ? <Navigate to='/auth/login' replace /> : <HistoryPage />}
                />

                {/* ── GAME ── */}
                <Route
                    path='/game'
                    element={
                        !loggedIn ? (
                            <Navigate to='/auth/login' replace />
                        ) : playerData?.roomId ? (
                            <PlayerDataContext.Provider value={playerData}>
                                <Gameboard key={playerData.roomId} />
                            </PlayerDataContext.Provider>
                        ) : (
                            <Navigate to='/lobby' />
                        )
                    }
                />
            </Routes>
        </SocketContext.Provider>
        </RoomSocketContext.Provider>
        </SetPlayerDataContext.Provider>
    );
};

function App() {
    return (
        <AudioProvider>
            <AuthProvider>
            <LaunchProvider>
                <WalletProvider>
                    <Router>
                        <AppRoutes />
                    </Router>
                </WalletProvider>
            </LaunchProvider>
            </AuthProvider>
        </AudioProvider>
    );
}

export default App;
