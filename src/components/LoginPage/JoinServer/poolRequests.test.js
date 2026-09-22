import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import { RoomSocketContext, SetPlayerDataContext } from '../../../App';
import JoinServer from './JoinServer';
import AddServer from '../AddServer/AddServer';

jest.mock('axios');
jest.mock('../../../context/AuthContext', () => ({
    useAuth: () => ({ authUser: { id: 'player-a', displayName: 'A' } }),
}));

const fees = [5, 10, 25].map(n => ({
    id: `pool-${n}`, name: `₹${n}`, entryFee: `${n}.00`, maxPlayers: 2, prizePool: '1.00',
    matches: [1, 2].map(i => ({ number: i, roomId: `ROOM_${n}_${i}`, joinedPlayers: 0, maxPlayers: 2, state: 'WAITING', joinable: true })),
}));

const handlers = {};
const fakeSocket = { on: (ev, cb) => { handlers[ev] = cb; }, off: () => {}, emit: () => {} };

const quickMatchCalls = () => axios.get.mock.calls.filter(([url, cfg]) => url === '/api/v1/pools/' && cfg?.params?.quickMatch === 'true').length;
const feeListCalls = () => axios.get.mock.calls.filter(([url, cfg]) => url === '/api/v1/pools/' && !cfg?.params).length;

describe('pool list requests are not repeated by unrelated interaction', () => {
    beforeEach(() => {
        localStorage.setItem('ludo_token', 'test-token');
        axios.get.mockImplementation(() => Promise.resolve({ data: { data: fees } }));
    });

    it('choosing fees in the Host form does not re-request the Quick Match list', async () => {
        render(
            <RoomSocketContext.Provider value={fakeSocket}>
                <SetPlayerDataContext.Provider value={jest.fn()}>
                    <JoinServer />
                    <AddServer publicMatchEnabled={false} />
                </SetPlayerDataContext.Provider>
            </RoomSocketContext.Provider>
        );

        await screen.findAllByText('₹5');
        await waitFor(() => expect(quickMatchCalls()).toBeGreaterThan(0));
        const quickBefore = quickMatchCalls();
        const feeBefore = feeListCalls();
        expect(quickBefore).toBe(1);
        expect(feeBefore).toBe(1);

        // Tap through the fee buttons and the player-count buttons several times.
        const feeButtons = await screen.findAllByRole('button', { name: /₹\d+\.00/ });
        for (let i = 0; i < 6; i++) fireEvent.click(feeButtons[i % feeButtons.length]);
        fireEvent.click(screen.getByRole('button', { name: '4' }));
        fireEvent.click(screen.getByRole('button', { name: '2' }));
        await act(async () => { await new Promise(r => setTimeout(r, 50)); });

        expect(quickMatchCalls()).toBe(quickBefore);
        expect(feeListCalls()).toBe(feeBefore);
    });

    it('a burst of server pushes reloads the Quick Match list once, not once per push', async () => {
        render(
            <RoomSocketContext.Provider value={fakeSocket}>
                <SetPlayerDataContext.Provider value={jest.fn()}>
                    <JoinServer />
                </SetPlayerDataContext.Provider>
            </RoomSocketContext.Provider>
        );
        await waitFor(() => expect(quickMatchCalls()).toBe(1));
        await act(async () => {
            for (let i = 0; i < 5; i++) handlers['lobby:changed']?.({ reason: 'burst' });
            await new Promise(r => setTimeout(r, 700));
        });
        expect(quickMatchCalls()).toBe(2);
    });

    it('returning to the page (visibilitychange + focus, repeated) reloads the list once, not per event', async () => {
        render(
            <RoomSocketContext.Provider value={fakeSocket}>
                <SetPlayerDataContext.Provider value={jest.fn()}>
                    <JoinServer />
                </SetPlayerDataContext.Provider>
            </RoomSocketContext.Provider>
        );
        await waitFor(() => expect(quickMatchCalls()).toBe(1));
        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
            window.dispatchEvent(new Event('focus'));
            window.dispatchEvent(new Event('focus'));
            window.dispatchEvent(new Event('focus'));
            await new Promise(r => setTimeout(r, 100));
        });
        expect(quickMatchCalls()).toBe(2);
    });
});
