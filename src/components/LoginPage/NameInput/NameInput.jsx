import React, { useState, useContext, useEffect } from 'react';
import { SocketContext } from '../../../App';
import useInput from '../../../hooks/useInput';
import useKeyPress from '../../../hooks/useKeyPress';
import styles from './NameInput.module.css';

const NameInput = ({ isRoomPrivate, roomId }) => {
    const socket = useContext(SocketContext);
    const nickname = useInput('');
    const password = useInput('');
    const [isPasswordWrong, setIsPasswordWrong] = useState(false);
    const [serverError,     setServerError]     = useState('');

    const handleButtonClick = () => {
        if (!nickname.value.trim() || !socket) return;
        setServerError('');
        socket.emit('player:login', {
            name:     nickname.value.trim(),
            password: password.value,
            roomId,
        });
    };

    useKeyPress('Enter', handleButtonClick);

    useEffect(() => {
        if (!socket) return;
        socket.on('error:wrongPassword', () => setIsPasswordWrong(true));
        socket.on('error:server',        msg => setServerError(msg));
        return () => {
            socket.off('error:wrongPassword');
            socket.off('error:server');
        };
    }, [socket]);

    return (
        <div className={styles.container}>
            <input placeholder='Nickname' type='text' {...nickname} />
            {isRoomPrivate && (
                <input
                    placeholder='Room password'
                    type='text'
                    {...password}
                    style={{ backgroundColor: isPasswordWrong ? 'red' : null }}
                />
            )}
            {serverError && (
                <p style={{ color: '#ff6b6b', fontSize: 13, margin: '4px 0 0', textAlign: 'center' }}>
                    {serverError}
                </p>
            )}
            <button onClick={handleButtonClick}>JOIN</button>
        </div>
    );
};

export default NameInput;
