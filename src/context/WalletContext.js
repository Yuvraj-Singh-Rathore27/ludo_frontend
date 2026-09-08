import { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';

const WalletContext = createContext(null);

const API              = '/api/v1/wallet';
const STORAGE_TOKEN_KEY = 'ludo_token';

const readToken = () => localStorage.getItem(STORAGE_TOKEN_KEY) || null;

const authHeaders = () => {
    const token = readToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
};

/* Extract backend envelope: { error, message, data } */
const unwrap = response => {
    const { error, message, data } = response.data;
    if (error) {
        const err = new Error(message || 'Something went wrong');
        err.data  = data;
        throw err;
    }
    return { message, data };
};

const apiCall = async fn => {
    try {
        return await fn();
    } catch (err) {
        if (err.data !== undefined) throw err;          // already unwrapped
        const backendMsg = err.response?.data?.message;
        const e = new Error(backendMsg || err.message || 'Something went wrong');
        e.data  = err.response?.data?.data ?? null;
        throw e;
    }
};

/* Stable idempotency key for each request */
const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const normalizeBalance = data => {
    const source = data?.balance ?? data?.wallet ?? data ?? {};
    if (typeof source === 'number' || typeof source === 'string') {
        return { totalBalance: source };
    }

    return {
        ...source,
        totalBalance: source.totalBalance ?? source.availableBalance ?? source.balance ?? 0,
    };
};

export const WalletProvider = ({ children }) => {
    const [balance,  setBalance]  = useState(null);
    const [history,  setHistory]  = useState([]);
    const [balLoading, setBalLoading] = useState(false);
    const [histLoading, setHistLoading] = useState(false);
    const balanceInFlight = useRef(null); // deduplicates concurrent fetchBalance calls

    const refreshBalance = useCallback(async () => {
        const res    = await axios.get(`${API}/balance`, { headers: authHeaders() });
        const result = unwrap(res);
        const nextBalance = normalizeBalance(result.data);
        setBalance(nextBalance);
        return { ...result, data: nextBalance };
    }, []);

    /* ── GET /wallet/balance ── */
    const fetchBalance = useCallback(() => {
        /* If a fetch is already in flight, return the same promise — no second request */
        if (balanceInFlight.current) return balanceInFlight.current;
        const promise = apiCall(async () => {
            setBalLoading(true);
            try { return await refreshBalance(); }
            finally {
                setBalLoading(false);
                balanceInFlight.current = null;
            }
        });
        balanceInFlight.current = promise;
        return promise;
    }, [refreshBalance]);

    /* ── GET /wallet/history ── */
    const fetchHistory = useCallback(() =>
        apiCall(async () => {
            setHistLoading(true);
            try {
                const res    = await axios.get(`${API}/history`, { headers: authHeaders() });
                const result = unwrap(res);
                setHistory(result.data?.transactions ?? result.data ?? []);
                return result;
            } finally { setHistLoading(false); }
        }), []);

    /* ── POST /wallet/deposit ──
     * payload: { amount, paymentGateway, gatewayOrderId, idempotencyKey? }
     */
    const deposit = useCallback(({ amount, paymentGateway, gatewayOrderId, idempotencyKey }) =>
        apiCall(async () => {
            const res = await axios.post(
                `${API}/deposit`,
                { amount: String(amount), paymentGateway, gatewayOrderId, idempotencyKey: idempotencyKey || newKey() },
                { headers: authHeaders() },
            );
            const result = unwrap(res);
            const balanceResult = await refreshBalance();
            return { ...result, balance: balanceResult.data };
        }), [refreshBalance]);

    /* ── POST /wallet/withdraw ──
     * payload: { amount, paymentMethod, paymentDetails?, idempotencyKey? }
     */
    const withdraw = useCallback(({ amount, paymentMethod = 'UPI', paymentDetails = {}, idempotencyKey }) =>
        apiCall(async () => {
            const res = await axios.post(
                `${API}/withdraw`,
                { amount: String(amount), paymentMethod, paymentDetails, idempotencyKey: idempotencyKey || newKey() },
                { headers: authHeaders() },
            );
            const result = unwrap(res);
            const balanceResult = await refreshBalance();
            return { ...result, balance: balanceResult.data };
        }), [refreshBalance]);

    /* ── POST /wallet/game-entry ──
     * payload: { amount, idempotencyKey? }
     */
    const gameEntry = useCallback(({ amount, idempotencyKey }) =>
        apiCall(async () => {
            const res = await axios.post(
                `${API}/game-entry`,
                { amount: String(amount), idempotencyKey: idempotencyKey || newKey() },
                { headers: authHeaders() },
            );
            const result = unwrap(res);
            const balanceResult = await refreshBalance();
            return { ...result, balance: balanceResult.data };
        }), [refreshBalance]);

    const value = useMemo(() => ({
        balance,
        history,
        balLoading,
        histLoading,
        fetchBalance,
        fetchHistory,
        deposit,
        withdraw,
        gameEntry,
    }), [balance, history, balLoading, histLoading, fetchBalance, fetchHistory, deposit, withdraw, gameEntry]);

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    );
};

export const useWallet = () => useContext(WalletContext);
export default WalletContext;
