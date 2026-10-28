// Testing Mode on the DABBA launch: when the backend answers TEST_001 the app must show the
// "Coming Soon" screen (testModeBlocked) and drop any older Ludo login on this device. Any
// other launch failure must keep the old behaviour (dabaLaunchError).
import { render, screen, waitFor } from '@testing-library/react';
import { LaunchProvider, useLaunch } from './LaunchContext';
import { useAuth } from './AuthContext';

jest.mock('./AuthContext', () => ({ useAuth: jest.fn() }));

const Probe = () => {
    const { testModeBlocked, dabaLaunchError, dabaLoginPending } = useLaunch();
    return <p data-testid='state'>{JSON.stringify({ testModeBlocked, dabaLaunchError, dabaLoginPending })}</p>;
};
const state = () => JSON.parse(screen.getByTestId('state').textContent);
const launchError = (message, code) => Object.assign(new Error(message), { code });

beforeEach(() => {
    window.history.replaceState(null, '', '/?data=' + 'x'.repeat(40)); // an encrypted DABBA launch link
    localStorage.clear();
});

test('TEST_001: shows the testing screen and logs out an older Ludo login', async () => {
    const logout = jest.fn();
    useAuth.mockReturnValue({
        authUser: { id: 'old-user' }, logout,
        loginWithDaba: jest.fn().mockRejectedValue(launchError('Ludo is under testing. ...', 'TEST_001')),
    });
    render(<LaunchProvider><Probe /></LaunchProvider>);
    await waitFor(() => expect(state().dabaLoginPending).toBe(false));
    expect(state()).toEqual({ testModeBlocked: true, dabaLaunchError: null, dabaLoginPending: false });
    expect(logout).toHaveBeenCalledTimes(1);
    expect(window.location.search).toContain('data='); // kept, so a refresh checks again
});

test('TEST_001 with no older login: testing screen, nothing to log out', async () => {
    const logout = jest.fn();
    useAuth.mockReturnValue({
        authUser: null, logout,
        loginWithDaba: jest.fn().mockRejectedValue(launchError('Ludo is under testing. ...', 'TEST_001')),
    });
    render(<LaunchProvider><Probe /></LaunchProvider>);
    await waitFor(() => expect(state().testModeBlocked).toBe(true));
    expect(logout).not.toHaveBeenCalled();
});

test('any other launch error keeps the old "link expired" behaviour', async () => {
    const logout = jest.fn();
    useAuth.mockReturnValue({
        authUser: { id: 'old-user' }, logout,
        loginWithDaba: jest.fn().mockRejectedValue(launchError('Launch link expired', 'AUTH_002')),
    });
    render(<LaunchProvider><Probe /></LaunchProvider>);
    await waitFor(() => expect(state().dabaLoginPending).toBe(false));
    expect(state()).toEqual({ testModeBlocked: false, dabaLaunchError: 'Launch link expired', dabaLoginPending: false });
    expect(logout).not.toHaveBeenCalled();
});

test('allowed player: no testing screen, no error', async () => {
    useAuth.mockReturnValue({
        authUser: null, logout: jest.fn(),
        loginWithDaba: jest.fn().mockResolvedValue({ message: 'ok', data: {} }),
    });
    render(<LaunchProvider><Probe /></LaunchProvider>);
    await waitFor(() => expect(state().dabaLoginPending).toBe(false));
    expect(state()).toEqual({ testModeBlocked: false, dabaLaunchError: null, dabaLoginPending: false });
});

// ── Already logged in (no launch link in the address bar) ───────────────────────────────────────
describe('player already logged in', () => {
    const axios = require('axios');
    beforeEach(() => {
        window.history.replaceState(null, '', '/lobby');
        localStorage.setItem('ludo_token', 'tok');
    });
    afterEach(() => jest.restoreAllMocks());

    test('reload after admin removed / blocked them: Coming Soon screen, NOT logged out', async () => {
        const get = jest.spyOn(axios, 'get').mockResolvedValue({ data: { data: { blocked: true } } });
        const logout = jest.fn();
        useAuth.mockReturnValue({ authUser: { id: 'u1' }, logout, loginWithDaba: jest.fn() });
        render(<LaunchProvider><Probe /></LaunchProvider>);
        await waitFor(() => expect(state().testModeBlocked).toBe(true));
        expect(get).toHaveBeenCalledWith('/api/v1/auth/test-mode', { headers: { Authorization: 'Bearer tok' } });
        expect(logout).not.toHaveBeenCalled(); // stays logged in: next reload checks again
    });

    test('reload while allowed (or still in a match): normal app', async () => {
        jest.spyOn(axios, 'get').mockResolvedValue({ data: { data: { blocked: false } } });
        useAuth.mockReturnValue({ authUser: { id: 'u1' }, logout: jest.fn(), loginWithDaba: jest.fn() });
        render(<LaunchProvider><Probe /></LaunchProvider>);
        await new Promise(r => setTimeout(r, 20));
        expect(state().testModeBlocked).toBe(false);
    });

    test('check fails (offline / old backend): never blocks', async () => {
        jest.spyOn(axios, 'get').mockRejectedValue(new Error('Network Error'));
        useAuth.mockReturnValue({ authUser: { id: 'u1' }, logout: jest.fn(), loginWithDaba: jest.fn() });
        render(<LaunchProvider><Probe /></LaunchProvider>);
        await new Promise(r => setTimeout(r, 20));
        expect(state().testModeBlocked).toBe(false);
    });

    test('in the lobby: a join refused with TEST_001 switches to the Coming Soon screen', async () => {
        jest.spyOn(axios, 'get').mockResolvedValue({ data: { data: { blocked: false } } });
        useAuth.mockReturnValue({ authUser: { id: 'u1' }, logout: jest.fn(), loginWithDaba: jest.fn() });
        render(<LaunchProvider><Probe /></LaunchProvider>);
        const refused = () => Promise.reject(Object.assign(new Error('403'), { response: { status: 403, data: { code: 'TEST_001' } } }));
        await expect(axios.request({ url: '/api/v1/rooms/join', adapter: refused })).rejects.toBeTruthy();
        await waitFor(() => expect(state().testModeBlocked).toBe(true));
    });

    test('in the lobby: any other error leaves the app as it is', async () => {
        jest.spyOn(axios, 'get').mockResolvedValue({ data: { data: { blocked: false } } });
        useAuth.mockReturnValue({ authUser: { id: 'u1' }, logout: jest.fn(), loginWithDaba: jest.fn() });
        render(<LaunchProvider><Probe /></LaunchProvider>);
        const failed = () => Promise.reject(Object.assign(new Error('400'), { response: { status: 400, data: { code: 'ROOM_002' } } }));
        await expect(axios.request({ url: '/api/v1/rooms/join', adapter: failed })).rejects.toBeTruthy();
        await new Promise(r => setTimeout(r, 20));
        expect(state().testModeBlocked).toBe(false);
    });
});
