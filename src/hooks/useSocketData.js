import { useState, useContext, useEffect } from 'react';
import { SocketContext } from '../App';

const useSocketData = eventName => {
    const socket = useContext(SocketContext);
    const [data, setData] = useState(null);

    // Reset stale data when the socket instance changes
    useEffect(() => {
        setData(null);
    }, [socket]);

    useEffect(() => {
        if (!socket) return;
        const handler = res => {
            let parsedData;
            try {
                parsedData = JSON.parse(res);
            } catch (error) {
                parsedData = res;
            }
            setData(parsedData);
        };
        socket.on(eventName, handler);
        return () => socket.off(eventName, handler);
    }, [socket, eventName]);

    return [data, setData];
};

export default useSocketData;
