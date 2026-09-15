import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Dice from './Dice';
import { PlayerDataContext, SocketContext } from '../../../App';

const mockSocket = {
    emit: jest.fn(),
};

describe('Dice component', () => {
    let props;
    const MOVING_PLAYER = 'blue';
    const NOT_MOVING_PLAYER = 'red';
    const THIS_PLAYER_MOVING = true;
    
    beforeEach(() => {
        props = {
            rolledNumber: null,
            nowMoving: false,
            playerColor: '',
            movingPlayer: '',
        };
    });

    it('should render correct rolledNumber next to moving player', () => {
        props.rolledNumber = 5;
        props.movingPlayer = MOVING_PLAYER;
        props.playerColor = MOVING_PLAYER;
        render(<Dice {...props} />);
        expect(screen.queryByAltText(props.rolledNumber)).toBeInTheDocument();
    });

    it('should not render rolledNumber next to not moving player', () => {
        props.rolledNumber = 5;
        props.movingPlayer = MOVING_PLAYER;
        props.playerColor = NOT_MOVING_PLAYER;
        render(<Dice {...props} />);
        expect(screen.queryByAltText(props.rolledNumber)).not.toBeInTheDocument();
    });

    it('should render roll icon next to moving player', () => {
        props.rolledNumber = null;
        props.movingPlayer = MOVING_PLAYER;
        props.playerColor = MOVING_PLAYER;
        props.nowMoving = THIS_PLAYER_MOVING;
        render(<Dice {...props} />);
        expect(screen.queryByAltText('roll')).toBeInTheDocument();
    });

    it('should not render roll icon next to not moving player', () => {
        props.rolledNumber = null;
        props.movingPlayer = MOVING_PLAYER;
        props.playerColor = MOVING_PLAYER;
        props.nowMoving = !THIS_PLAYER_MOVING;
        render(<Dice {...props} />);
        expect(screen.queryByAltText('roll')).not.toBeInTheDocument();
    });

    it('should send data on click', () => {
        props.rolledNumber = null;
        props.movingPlayer = MOVING_PLAYER;
        props.playerColor = MOVING_PLAYER;
        props.nowMoving = THIS_PLAYER_MOVING;
        render(
            <PlayerDataContext.Provider value={{ roomId: 'ROOM_TEST01' }}>
                <SocketContext.Provider value={mockSocket}>
                    <Dice {...props} />
                </SocketContext.Provider>
            </PlayerDataContext.Provider>
        );
        const dice = screen.getByAltText('roll');
        fireEvent.click(dice);
        // The room code rides along so a roll still lands after a session-less reconnect
        expect(mockSocket.emit).toHaveBeenCalledWith('game:roll', 'ROOM_TEST01');
    });

    it('should not start a roll while the game socket is reconnecting', () => {
        props.movingPlayer = MOVING_PLAYER;
        props.playerColor = MOVING_PLAYER;
        props.nowMoving = THIS_PLAYER_MOVING;
        const offlineSocket = { emit: jest.fn(), on: jest.fn(), off: jest.fn(), connected: false };
        render(
            <SocketContext.Provider value={offlineSocket}>
                <Dice {...props} />
            </SocketContext.Provider>
        );
        fireEvent.click(screen.getByAltText('roll'));
        expect(offlineSocket.emit).not.toHaveBeenCalled();
        expect(screen.getByText('Reconnecting…')).toBeInTheDocument();
        // Still ready for the next tap
        expect(screen.getByAltText('roll')).toBeInTheDocument();
    });

    it('should reset the dice immediately when the server rejects the roll', () => {
        props.movingPlayer = MOVING_PLAYER;
        props.playerColor = MOVING_PLAYER;
        props.nowMoving = THIS_PLAYER_MOVING;
        const listeners = {};
        const liveSocket = {
            connected: true,
            emit: jest.fn(),
            on: jest.fn((event, fn) => (listeners[event] = fn)),
            off: jest.fn(),
        };
        render(
            <SocketContext.Provider value={liveSocket}>
                <Dice {...props} />
            </SocketContext.Provider>
        );
        fireEvent.click(screen.getByAltText('roll'));
        expect(screen.queryByAltText('roll')).not.toBeInTheDocument(); // spinning
        act(() => listeners['game:roll_rejected']({ reason: 'not_your_turn' }));
        expect(screen.getByAltText('roll')).toBeInTheDocument(); // ready again, no 6s wait
    });

    it('should still send the roll when audio playback is unavailable', () => {
        props.movingPlayer = MOVING_PLAYER;
        props.playerColor = MOVING_PLAYER;
        props.nowMoving = THIS_PLAYER_MOVING;
        const play = jest.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => {
            throw new Error('not supported');
        });
        mockSocket.emit.mockClear();
        render(
            <SocketContext.Provider value={mockSocket}>
                <Dice {...props} />
            </SocketContext.Provider>
        );
        fireEvent.click(screen.getByAltText('roll'));
        expect(mockSocket.emit).toHaveBeenCalledWith('game:roll', undefined);
        play.mockRestore();
    });
});
