// A failed Quick Match join (e.g. "Insufficient balance") must stay on screen. The
// list reload that runs right after every failed join used to clear it within a moment.
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import { RoomSocketContext, SetPlayerDataContext } from '../../../App';
import JoinServer from './JoinServer';

jest.mock('axios');
jest.mock('../../../context/AuthContext', () => ({
    useAuth: () => ({ authUser: { id: 'player-a', displayName: 'A' } }),
}));

const pools = [
    {
        id: 'pool-10', name: '₹10', entryFee: '10.00', maxPlayers: 2, prizePool: '18.00',
        matches: [{ number: 1, roomId: 'ROOM_AAAAAA', joinedPlayers: 1, maxPlayers: 2, state: 'FILLING', joinable: true }],
    },
];

const handlers = {};
const fakeSocket = { on: (ev, cb) => { handlers[ev] = cb; }, off: () => {}, emit: () => {} };

describe('Quick Match join errors', () => {
    beforeEach(() => {
        localStorage.setItem('ludo_token', 'test-token');
        axios.get.mockImplementation(() => Promise.resolve({ data: { data: pools } }));
        axios.post.mockRejectedValue({ response: { data: { message: 'Insufficient balance to join this room' } } });
    });

    const renderJoin = () =>
        render(
            <RoomSocketContext.Provider value={fakeSocket}>
                <SetPlayerDataContext.Provider value={jest.fn()}>
                    <JoinServer />
                </SetPlayerDataContext.Provider>
            </RoomSocketContext.Provider>
        );

    it('keeps the insufficient-balance message through the list reloads that follow', async () => {
        renderJoin();
        fireEvent.click(await screen.findByText('₹10'));
        fireEvent.click(await screen.findByText('Join'));
        expect(await screen.findByText('Insufficient balance to join this room')).toBeInTheDocument();

        // The post-failure reload and a lobby push both complete successfully…
        await act(async () => {
            handlers['lobby:changed']?.({ reason: 'player_joined' });
            await new Promise(r => setTimeout(r, 600));
        });
        // …and the message is still there.
        expect(screen.getByText('Insufficient balance to join this room')).toBeInTheDocument();
    });

    it('can be dismissed by the player', async () => {
        renderJoin();
        fireEvent.click(await screen.findByText('₹10'));
        fireEvent.click(await screen.findByText('Join'));
        await screen.findByText('Insufficient balance to join this room');
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
        expect(screen.queryByText('Insufficient balance to join this room')).not.toBeInTheDocument();
    });
});
