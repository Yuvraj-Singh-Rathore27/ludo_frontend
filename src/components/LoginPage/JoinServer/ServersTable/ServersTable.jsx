import styles from './ServersTable.module.css';

const ServerListTable = ({ rooms, handleJoinClick, joiningId }) => {
    if (!rooms?.length) {
        return (
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', padding: '32px 0', margin: 0 }}>
                No rooms available — host one above!
            </p>
        );
    }

    return (
        <table className={styles.rooms}>
            <thead>
                <tr>
                    <th>Room ID</th>
                    <th>Entry Fee</th>
                    <th>Players</th>
                    <th>Status</th>
                    <th className={styles.lastColumn}></th>
                </tr>
            </thead>
            <tbody>
                {rooms.map((room, index) => (
                    <tr key={room.roomId || index}>
                        <td className={styles.roomName}>{room.roomId}</td>
                        <td>&#8377;{room.entryFee}</td>
                        <td>
                            <span className={styles.playerCount}>
                                {room.joinedPlayers}/{room.maxPlayers}
                            </span>
                        </td>
                        <td>
                            <span className={`${styles.status} ${room.roomStatus !== 'WAITING' ? styles.statusStarted : ''}`}>
                                {room.roomStatus?.toLowerCase() || 'waiting'}
                            </span>
                        </td>
                        <td className={styles.lastColumn}>
                            <button
                                onClick={() => handleJoinClick(room)}
                                disabled={!!joiningId || room.roomStatus !== 'WAITING'}
                            >
                                {joiningId === room.roomId ? 'Joining...' : 'Join'}
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default ServerListTable;
