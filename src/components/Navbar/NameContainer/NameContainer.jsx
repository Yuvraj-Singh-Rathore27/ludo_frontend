import React from 'react';
import PropTypes from 'prop-types';
import AnimatedOverlay from './AnimatedOverlay/AnimatedOverlay';
import styles from './NameContainer.module.css';

const NameContainer = ({ player, time }) => {
    const isEmptySeat = player.name === '...';
    const displayName = isEmptySeat ? player.seatNumber || 'Open' : player.name?.charAt(0).toUpperCase();
    const classes = `${styles.container} ${player.ready ? styles.ready : styles.waiting} ${
        player.nowMoving ? styles.nowMoving : ''
    } ${isEmptySeat ? styles.empty : ''}`;

    return (
        <div className={classes} style={{ '--player-color': player.color }}>
            <p className={isEmptySeat ? styles.emptySeatName : ''}>{displayName}</p>
            {player.nowMoving ? <AnimatedOverlay time={time} /> : null}
        </div>
    );
};

NameContainer.propTypes = {
    player: PropTypes.object,
    time: PropTypes.number,
    testId: PropTypes.string,
};

export default NameContainer;
