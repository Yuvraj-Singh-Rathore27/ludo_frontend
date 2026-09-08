import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import bgMusic from '../assets/music/primary_game_sound.mp3';

const AudioSettingsContext = createContext();
const STORAGE_KEY = 'ludo_music_muted';

export const AudioProvider = ({ children }) => {
    const audioRef = useRef(null);
    const [muted, setMuted] = useState(() => {
        try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
    });

    // Create the element once and keep it alive for the whole session —
    // this component wraps the Router, so it never unmounts on navigation.
    useEffect(() => {
        const audio = new Audio(bgMusic);
        audio.loop = true;
        audio.volume = 0.35;
        audioRef.current = audio;
        return () => {
            audio.pause();
            audioRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (audioRef.current) audioRef.current.muted = muted;
        try { localStorage.setItem(STORAGE_KEY, String(muted)); } catch {}
    }, [muted]);

    // Browsers block autoplay-with-sound until the page has received a real
    // user gesture — start playback on the first click/keypress anywhere on
    // the site so it plays continuously from that point on, on every screen.
    useEffect(() => {
        const start = () => {
            audioRef.current?.play().catch(() => {});
            document.removeEventListener('pointerdown', start);
            document.removeEventListener('keydown', start);
        };
        document.addEventListener('pointerdown', start);
        document.addEventListener('keydown', start);
        return () => {
            document.removeEventListener('pointerdown', start);
            document.removeEventListener('keydown', start);
        };
    }, []);

    const toggleMute = useCallback(() => setMuted(m => !m), []);

    return (
        <AudioSettingsContext.Provider value={{ muted, toggleMute }}>
            {children}
        </AudioSettingsContext.Provider>
    );
};

export const useAudioSettings = () => useContext(AudioSettingsContext);
