import React, { useEffect, useState, createContext } from 'react';
import { io } from 'socket.io-client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Gameboard       from './components/Gameboard/Gameboard';
import GlobalLoader    from './components/GlobalLoader/GlobalLoader';
import LoginPage       from './components/LoginPage/LoginPage';
import ProfilePage     from './components/Profile/ProfilePage';
import WalletPage      from './components/Wallet/WalletPage';
import HistoryPage     from './components/History/HistoryPage';
import SignupScreen    from './components/Auth/SignupScreen/SignupScreen';
import AuthLoginScreen from './components/Auth/AuthLoginScreen/AuthLoginScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WalletProvider }        from './context/WalletContext';
import { AudioProvider }         from './context/AudioContext';

export const PlayerDataContext    = createContext();
export const SetPlayerDataContext = createContext();
export const SocketContext        = createContext();
export const RoomSocketContext    = createContext(); // new Fastify socket (port 8080) for room events

const AppRoutes = () => {
    const { authUser } = useAuth();
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
            // Send the JWT so the game server can verify identity (spectator
            // prevention); function form picks up the latest token on reconnect.
            auth: cb => cb({ token: localStorage.getItem('ludo_token') }),
        });

        setPlayerSocket(socket);

        socket.on('connect', () => {
            console.log('Socket Connected');
            setLoading(false);
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
            // Use function form so each reconnect attempt picks up the latest token
            auth: cb => cb({ token: localStorage.getItem('ludo_token') }),
        });

        setRoomSocket(rs);

        return () => {
            rs.disconnect();
            setRoomSocket(null);
        };
    }, [loggedIn]);

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
                <WalletProvider>
                    <Router>
                        <AppRoutes />
                    </Router>
                </WalletProvider>
            </AuthProvider>
        </AudioProvider>
    );
}

export default App;
