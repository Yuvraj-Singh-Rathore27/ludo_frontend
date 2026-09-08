import React, { useState, useContext } from 'react';
import axios from 'axios';
import { SetPlayerDataContext } from '../../../App';
import WindowLayout from '../WindowLayout/WindowLayout';
import styles from './AddServer.module.css';

const WhatsAppIcon = () => (
    <svg viewBox='0 0 24 24' fill='currentColor' width='20' height='20' aria-hidden='true'>
        <path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z' />
    </svg>
);

const AddServer = () => {
    const setPlayerData = useContext(SetPlayerDataContext);
    const [entryFee, setEntryFee] = useState('');
    const [maxPlayers, setMaxPlayers] = useState(2);
    const [isPrivate, setIsPrivate] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [createdRoom, setCreatedRoom] = useState(null);
    const [copied, setCopied] = useState(false);

    const handleSubmit = async e => {
        e.preventDefault();
        const fee = entryFee.trim();
        if (!fee || !/^\d+(\.\d{1,2})?$/.test(fee) || Number(fee) <= 0) {
            setError('Enter a valid entry fee (e.g. 10)');
            return;
        }
        const token = localStorage.getItem('ludo_token');
        if (!token) { setError('Not logged in'); return; }

        setLoading(true);
        setError('');

        try {
            const createRes = await axios.post(
                '/api/v1/rooms/create',
                { entryFee: fee, maxPlayers, isPrivate },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const { roomId, roomCode } = createRes.data?.data;

            const idempotencyKey = crypto.randomUUID();
            const joinRes = await axios.post(
                '/api/v1/rooms/join',
                { roomId, idempotencyKey },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const color = joinRes.data?.data?.color;

            if (isPrivate) {
                setCreatedRoom({ roomId, roomCode, color });
            } else {
                setPlayerData({ roomId, isHost: true, color });
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create room');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(createdRoom.roomCode).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleWhatsApp = () => {
        const msg = encodeURIComponent(
            `🎲 Join my private Ludo game!\n\nRoom Code: *${createdRoom.roomCode}*\n\nOpen ${window.location.origin} → Join a Server → enter the code above.`
        );
        window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener,noreferrer');
    };

    const handleEnterGame = () => {
        setPlayerData({ roomId: createdRoom.roomId, isHost: true, color: createdRoom.color });
    };

    if (createdRoom) {
        return (
            <WindowLayout
                title='Private Room Created!'
                content={
                    <div className={styles.inviteContainer}>
                        <p className={styles.inviteHint}>Share this code with friends to let them join</p>

                        <div className={styles.codeBox}>
                            <span className={styles.codeLetters}>{createdRoom.roomCode}</span>
                            <button type='button' className={styles.copyBtn} onClick={handleCopy}>
                                {copied ? '✓ Copied' : 'Copy'}
                            </button>
                        </div>

                        <button type='button' className={styles.whatsappBtn} onClick={handleWhatsApp}>
                            <WhatsAppIcon />
                            Share on WhatsApp
                        </button>

                        <button type='button' className={styles.enterBtn} onClick={handleEnterGame}>
                            Enter Game
                        </button>
                    </div>
                }
            />
        );
    }

    return (
        <WindowLayout
            title='Host A Server'
            content={
                <form className={styles.formContainer} onSubmit={handleSubmit}>
                    <input
                        type='text'
                        placeholder='Entry Fee (e.g. 10)'
                        value={entryFee}
                        onChange={e => { setEntryFee(e.target.value); setError(''); }}
                        style={{ border: error && !entryFee.trim() ? '1px solid red' : undefined }}
                    />

                    <div className={styles.privateContainer}>
                        <span>Max Players</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {[2, 4].map(n => (
                                <button
                                    key={n}
                                    type='button'
                                    onClick={() => setMaxPlayers(n)}
                                    style={{
                                        padding: '4px 18px',
                                        borderRadius: 6,
                                        border: `1px solid ${maxPlayers === n ? '#ff1a38' : 'rgba(255,255,255,0.2)'}`,
                                        background: maxPlayers === n ? 'rgba(255,24,58,0.22)' : 'transparent',
                                        color: '#fff',
                                        fontWeight: maxPlayers === n ? 700 : 400,
                                        cursor: 'pointer',
                                        fontSize: 16,
                                    }}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Room Type toggle */}
                    <div className={styles.roomTypeRow}>
                        <button
                            type='button'
                            className={`${styles.roomTypeBtn} ${!isPrivate ? styles.roomTypeActive : ''}`}
                            onClick={() => setIsPrivate(false)}
                        >
                            <svg viewBox='0 0 20 20' fill='currentColor' width='15' height='15' aria-hidden='true'>
                                <path d='M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4.418 0-8 1.79-8 4v1h16v-1c0-2.21-3.582-4-8-4z' />
                            </svg>
                            Public
                        </button>
                        <button
                            type='button'
                            className={`${styles.roomTypeBtn} ${isPrivate ? styles.roomTypeActive : ''}`}
                            onClick={() => setIsPrivate(true)}
                        >
                            <svg viewBox='0 0 20 20' fill='currentColor' width='15' height='15' aria-hidden='true'>
                                <path fillRule='evenodd' d='M5 8V6a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h1zm2-2a3 3 0 0 1 6 0v2H7V6zm3 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2z' />
                            </svg>
                            Private
                        </button>
                    </div>

                    {isPrivate && (
                        <p className={styles.privateNote}>
                            A 6-letter code will be generated. Share it with friends to invite them.
                        </p>
                    )}

                    {error && (
                        <span style={{ color: '#ff4d6a', fontSize: 14, marginTop: -8 }}>{error}</span>
                    )}

                    <button type='submit' disabled={loading}>
                        {loading ? 'Creating...' : 'Host Server'}
                    </button>
                </form>
            }
        />
    );
};

export default AddServer;
