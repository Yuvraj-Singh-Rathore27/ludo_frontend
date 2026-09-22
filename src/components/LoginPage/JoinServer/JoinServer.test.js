import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import { RoomSocketContext, SetPlayerDataContext } from '../../../App';
import JoinServer from './JoinServer';

jest.mock('axios');
jest.mock('../../../context/AuthContext', () => ({
    useAuth: () => ({ authUser: { id: 'player-a' } }),
}));

// A tiny stand-in for the server: the ₹25 Quick Match fee with 4 matches of 2 players, and
// a ₹50 fee, exactly the shape GET /api/v1/pools/?quickMatch=true returns.
const makeRoom = (n, joined = 0, status = 'WAITING') => ({
    number: n,
    roomId: `ROOM_25_${n}`,
    joinedPlayers: joined,
    maxPlayers: 2,
    state: joined >= 2 ? 'FULL' : joined > 0 ? 'FILLING' : 'WAITING',
    joinable: status === 'WAITING' && joined < 2,
});

let rooms25;
const poolsPayload = () => ([
    {
        id: 'pool-25', name: '₹25', entryFee: '25.00', maxPlayers: 2, prizePool: '42.50',
        matches: rooms25,
    },
    {
        id: 'pool-50', name: '₹50', entryFee: '50.00', maxPlayers: 2, prizePool: '85.00',
        matches: [1, 2, 3].map(n => ({ number: n, roomId: `ROOM_50_${n}`, joinedPlayers: 0, maxPlayers: 2, state: 'WAITING', joinable: true })),
    },
]);

const lobbyHandlers = {};
const fakeSocket = {
    on: (ev, cb) => { lobbyHandlers[ev] = cb; },
    off: () => {},
    emit: () => {},
};

const renderLobby = () => {
    const setPlayerData = jest.fn();
    render(
        <RoomSocketContext.Provider value={fakeSocket}>
            <SetPlayerDataContext.Provider value={setPlayerData}>
                <JoinServer />
            </SetPlayerDataContext.Provider>
        </RoomSocketContext.Provider>
    );
    return setPlayerData;
};

const matchRows = () => screen.getAllByText(/^Match #\d+$/).map(el => el.closest('div').parentElement);

describe('Quick Match list keeps every match after a join', () => {
    beforeEach(() => {
        localStorage.setItem('ludo_token', 'test-token');
        rooms25 = [1, 2, 3, 4].map(n => makeRoom(n));
        axios.get.mockImplementation(() => Promise.resolve({ data: { data: poolsPayload() } }));
        axios.post.mockImplementation((url, body) => {
            const target = rooms25.find(r => r.roomId === body.roomId);
            // What the server does: only that match's count/state changes.
            target.joinedPlayers += 1;
            target.state = target.joinedPlayers >= 2 ? 'FULL' : 'FILLING';
            target.joinable = target.joinedPlayers < 2;
            return Promise.resolve({ data: { data: { color: 'red', isHost: false, room: { roomId: target.roomId } } } });
        });
    });

    it('shows only the chosen fee, then keeps all 4 matches (1/2, 0/2, 0/2, 0/2) after joining Match #1', async () => {
        const setPlayerData = renderLobby();

        // Step 1: money options only — no individual matches yet.
        fireEvent.click(await screen.findByText('₹25', { selector: 'span' }));
        await screen.findByText('₹25 Quick Match');

        // Step 2: only ₹25 matches (none of the ₹50 ones).
        expect(screen.queryByText('ROOM_50_1')).not.toBeInTheDocument();
        expect(matchRows()).toHaveLength(4);
        expect(screen.getAllByText('0/2')).toHaveLength(4);

        // Join Match #1.
        const firstRow = matchRows()[0];
        fireEvent.click(within(firstRow).getByRole('button', { name: 'Join' }));
        await waitFor(() => expect(setPlayerData).toHaveBeenCalledWith(expect.objectContaining({ roomId: 'ROOM_25_1' })));
        expect(axios.post.mock.calls[0][1]).toEqual(expect.objectContaining({ roomId: 'ROOM_25_1' }));
        // The client never sends an amount.
        expect(axios.post.mock.calls[0][1]).not.toHaveProperty('entryFee');

        // The server pushes lobby:changed; the screen reloads the WHOLE list.
        await act(async () => { lobbyHandlers['lobby:changed']?.({ reason: 'pool_player_joined' }); });
        await waitFor(() => expect(screen.getByText('1/2')).toBeInTheDocument());

        expect(matchRows()).toHaveLength(4);
        expect(screen.getAllByText('0/2')).toHaveLength(3);
        expect(screen.getByText('1/2')).toBeInTheDocument();
        ['ROOM_25_1', 'ROOM_25_2', 'ROOM_25_3', 'ROOM_25_4'].forEach(id => expect(screen.getByText(id)).toBeInTheDocument());
    });

    it('keeps a full match visible as FULL (2/2, Join disabled) with the other matches still there', async () => {
        renderLobby();
        fireEvent.click(await screen.findByText('₹25', { selector: 'span' }));
        await screen.findByText('₹25 Quick Match');

        // Player B fills Match #1 on the server side, then the push arrives.
        rooms25[0].joinedPlayers = 2; rooms25[0].state = 'FULL'; rooms25[0].joinable = false;
        await act(async () => { lobbyHandlers['lobby:changed']?.({ reason: 'pool_player_joined' }); });
        await waitFor(() => expect(screen.getByText('2/2')).toBeInTheDocument());

        expect(matchRows()).toHaveLength(4);
        const first = matchRows()[0];
        expect(within(first).getByText('FULL')).toBeInTheDocument();
        expect(within(first).getByRole('button', { name: 'Full' })).toBeDisabled();
        expect(screen.getAllByText('0/2')).toHaveLength(3);
        matchRows().slice(1).forEach(row => expect(within(row).getByRole('button', { name: 'Join' })).toBeEnabled());
    });

});
