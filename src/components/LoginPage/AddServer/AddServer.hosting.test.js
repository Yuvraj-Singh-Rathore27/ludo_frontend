import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import { SetPlayerDataContext } from '../../../App';
import AddServer from './AddServer';

jest.mock('axios');

const FEES = [
    { id: 'pool-10', entryFee: '10.00' },
    { id: 'pool-50', entryFee: '50.00' },
];

const setup = () => {
    const setPlayerData = jest.fn();
    render(
        <SetPlayerDataContext.Provider value={setPlayerData}>
            <AddServer />
        </SetPlayerDataContext.Provider>
    );
    return setPlayerData;
};

describe('AddServer — hosting a private room', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        localStorage.setItem('ludo_token', 'tok-123');
    });
    afterEach(() => localStorage.clear());

    it('loads the entry fees with the login token', async () => {
        axios.get.mockResolvedValue({ data: { data: FEES } });
        setup();
        await screen.findByText('₹10.00');
        expect(axios.get).toHaveBeenCalledWith('/api/v1/pools/', {
            headers: { Authorization: 'Bearer tok-123' },
        });
    });

    it('keeps Host Server disabled and says why until a fee is selected', async () => {
        axios.get.mockResolvedValue({ data: { data: FEES } });
        setup();
        await screen.findByText('₹10.00');
        expect(screen.getByText('Host Server')).toBeDisabled();
        expect(screen.getByText('Select an entry fee to host.')).toBeInTheDocument();
        fireEvent.click(screen.getByText('₹10.00'));
        expect(screen.getByText('Host Server')).toBeEnabled();
        expect(screen.queryByText('Select an entry fee to host.')).not.toBeInTheDocument();
    });

    it('shows a clear message when no entry fee is active', async () => {
        axios.get.mockResolvedValue({ data: { data: [] } });
        setup();
        expect(await screen.findByText('No entry fees are available right now.')).toBeInTheDocument();
        expect(screen.getByText('Host Server')).toBeDisabled();
    });

    it('does not call the API without a login and says so', () => {
        localStorage.clear();
        setup();
        expect(axios.get).not.toHaveBeenCalled();
        expect(screen.getByText(/Not logged in/)).toBeInTheDocument();
        expect(screen.getByText('Host Server')).toBeDisabled();
    });

    it('shows a load error when the fee request fails', async () => {
        axios.get.mockRejectedValue(new Error('boom'));
        setup();
        expect(await screen.findByText(/Could not load entry fees/)).toBeInTheDocument();
    });

    it('creates the room with the chosen fee id, then joins it as host', async () => {
        axios.get.mockResolvedValue({ data: { data: FEES } });
        axios.post
            .mockResolvedValueOnce({ data: { data: { roomId: 'ROOM_ABC123', roomCode: 'ABC123' } } })
            .mockResolvedValueOnce({ data: { data: { color: 'red' } } });
        setup();
        fireEvent.click(await screen.findByText('₹50.00'));
        fireEvent.click(screen.getByText('Host Server'));

        await screen.findByText('ABC123');
        const [createUrl, createBody, createCfg] = axios.post.mock.calls[0];
        expect(createUrl).toBe('/api/v1/rooms/create');
        expect(createBody).toEqual({ entryFeeId: 'pool-50', maxPlayers: 2, isPrivate: true });
        expect(createCfg.headers.Authorization).toBe('Bearer tok-123');
        expect(axios.post.mock.calls[1][0]).toBe('/api/v1/rooms/join');
    });

    it('surfaces the backend error (e.g. insufficient balance) instead of failing silently', async () => {
        axios.get.mockResolvedValue({ data: { data: FEES } });
        axios.post
            .mockResolvedValueOnce({ data: { data: { roomId: 'ROOM_ABC123', roomCode: 'ABC123' } } })
            .mockRejectedValueOnce({ response: { data: { message: 'Insufficient balance' } } });
        const setPlayerData = setup();
        fireEvent.click(await screen.findByText('₹10.00'));
        fireEvent.click(screen.getByText('Host Server'));
        expect(await screen.findByText('Insufficient balance')).toBeInTheDocument();
        expect(setPlayerData).not.toHaveBeenCalled();
        // The room the host could not join is closed again, not left open and empty.
        await waitFor(() =>
            expect(axios.post).toHaveBeenCalledWith(
                '/api/v1/rooms/cancel',
                { roomId: 'ROOM_ABC123', reason: 'Host could not join' },
                { headers: { Authorization: 'Bearer tok-123' } }
            )
        );
    });

    it('offers a retry when the entry fees fail to load, and recovers', async () => {
        axios.get.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ data: { data: FEES } });
        setup();
        fireEvent.click(await screen.findByText('Try again'));
        expect(await screen.findByText('₹10.00')).toBeInTheDocument();
        expect(screen.queryByText(/Could not load entry fees/)).not.toBeInTheDocument();
    });

    it('enters the game as host from the created-room screen', async () => {
        axios.get.mockResolvedValue({ data: { data: FEES } });
        axios.post
            .mockResolvedValueOnce({ data: { data: { roomId: 'ROOM_ABC123', roomCode: 'ABC123' } } })
            .mockResolvedValueOnce({ data: { data: { color: 'blue' } } });
        const setPlayerData = setup();
        fireEvent.click(await screen.findByText('₹10.00'));
        fireEvent.click(screen.getByText('Host Server'));
        fireEvent.click(await screen.findByText('Enter Game'));
        await waitFor(() =>
            expect(setPlayerData).toHaveBeenCalledWith({ roomId: 'ROOM_ABC123', isHost: true, color: 'blue' })
        );
    });
});
