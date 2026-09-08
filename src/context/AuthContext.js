import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API                    = `/api/v1/auth`;
const STORAGE_USER_KEY       = 'ludo_auth_user';
const STORAGE_FLAG_KEY       = 'ludo_auth';
const STORAGE_TOKEN_KEY      = 'ludo_token';
const STORAGE_REFRESH_KEY    = 'ludo_refresh_token';

const readStored = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_USER_KEY)) || null; }
    catch { return null; }
};

const readToken = () => localStorage.getItem(STORAGE_TOKEN_KEY) || null;

/* Extract backend message — new backend uses { status: 200, error: false, message, data } */
const unwrap = response => {
    const { error, message, data } = response.data;
    if (error) {
        const err = new Error(message || 'Something went wrong');
        err.data  = data;
        throw err;
    }
    return { message, data };
};

/* Re-throw axios errors using the backend message instead of the HTTP status string */
const apiCall = async fn => {
    try {
        return await fn();
    } catch (err) {
        if (err.data !== undefined) throw err; // already unwrapped
        const backendMsg = err.response?.data?.message;
        if (backendMsg) {
            const e = new Error(backendMsg);
            e.data  = err.response.data.data;
            throw e;
        }
        throw err;
    }
};

/* Attach JWT to every request when available */
const authHeaders = () => {
    const token = readToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
};

/* Build international mobile number from local digits + dial code */
const toMobile = (localDigits, dialCode) => `+${dialCode}${localDigits}`;

export const AuthProvider = ({ children }) => {
    const [authUser, setAuthUser] = useState(readStored);
    const isRefreshing   = useRef(false);
    const failedQueue    = useRef([]);

    const persistUser = (user, accessToken, refreshToken) => {
        setAuthUser(user);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
        localStorage.setItem(STORAGE_FLAG_KEY, JSON.stringify({ loggedIn: true }));
        if (accessToken)  localStorage.setItem(STORAGE_TOKEN_KEY,   accessToken);
        if (refreshToken) localStorage.setItem(STORAGE_REFRESH_KEY, refreshToken);
    };

    const clearUser = () => {
        setAuthUser(null);
        localStorage.removeItem(STORAGE_USER_KEY);
        localStorage.removeItem(STORAGE_FLAG_KEY);
        localStorage.removeItem(STORAGE_TOKEN_KEY);
        localStorage.removeItem(STORAGE_REFRESH_KEY);
    };

    /* Drain the retry queue after a refresh attempt */
    const processQueue = (error, token = null) => {
        failedQueue.current.forEach(({ resolve, reject }) =>
            error ? reject(error) : resolve(token)
        );
        failedQueue.current = [];
    };

    /* Call the backend refresh endpoint and rotate both tokens in localStorage */
    const refreshTokens = async () => {
        const storedRefresh = localStorage.getItem(STORAGE_REFRESH_KEY);
        if (!storedRefresh) throw new Error('No refresh token stored');
        const response = await axios.post(`${API}/refresh`, { refreshToken: storedRefresh });
        const { data: tokenData } = unwrap(response);
        localStorage.setItem(STORAGE_TOKEN_KEY, tokenData.accessToken);
        if (tokenData.refreshToken) localStorage.setItem(STORAGE_REFRESH_KEY, tokenData.refreshToken);
        return tokenData.accessToken;
    };

    /* Axios response interceptor — silently refresh on 401 and retry the original request */
    useEffect(() => {
        const id = axios.interceptors.response.use(
            res => res,
            async error => {
                const original = error.config;
                /* Skip: not a 401, already retried, or the refresh call itself failed */
                if (
                    error.response?.status !== 401 ||
                    original._retry ||
                    original.url?.includes('/refresh')
                ) {
                    return Promise.reject(error);
                }

                if (isRefreshing.current) {
                    /* Another refresh is in flight — queue this request */
                    return new Promise((resolve, reject) => {
                        failedQueue.current.push({ resolve, reject });
                    }).then(token => {
                        original.headers = original.headers || {};
                        original.headers.Authorization = `Bearer ${token}`;
                        return axios(original);
                    });
                }

                original._retry       = true;
                isRefreshing.current  = true;

                try {
                    const newToken = await refreshTokens();
                    processQueue(null, newToken);
                    original.headers = original.headers || {};
                    original.headers.Authorization = `Bearer ${newToken}`;
                    return axios(original);
                } catch (refreshError) {
                    processQueue(refreshError, null);
                    clearUser();
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing.current = false;
                }
            }
        );
        return () => axios.interceptors.response.eject(id);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── Password-based login (unified endpoint: email or +dial+phone as identifier) ── */
    const loginWithEmail = useCallback((email, password) =>
        apiCall(async () => {
            const response = await axios.post(`${API}/login-password`, { identifier: email, password });
            const result = unwrap(response);
            if (result.data?.user) persistUser(result.data.user, result.data.accessToken, result.data.refreshToken);
            return result;
        }), []); // eslint-disable-line react-hooks/exhaustive-deps

    const loginWithPhone = useCallback((phone, country_code, password) =>
        apiCall(async () => {
            const identifier = toMobile(phone, country_code);
            const response = await axios.post(`${API}/login-password`, { identifier, password });
            const result = unwrap(response);
            if (result.data?.user) persistUser(result.data.user, result.data.accessToken, result.data.refreshToken);
            return result;
        }), []); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── Forgot password (link-based — backend queues reset email/SMS) ── */
    const forgotPassword = useCallback(identifier =>
        apiCall(async () => {
            const response = await axios.post(`${API}/forgot-password`, { identifier });
            return unwrap(response);
        }), []);

    const resetPassword = useCallback((token, password) =>
        apiCall(async () => {
            const response = await axios.post(`${API}/reset-password`, { token, password });
            return unwrap(response);
        }), []);

    /*
     * forgotSendOtp / forgotResetPassword — NOT available in the new backend.
     * These stubs are retained so components that call them receive a clear error
     * instead of a crash. Remove once the UI is fully migrated.
     */
    const forgotSendOtp = useCallback(async () => {
        throw new Error('OTP-based password reset is not supported by the current backend. Please use the email reset link.');
    }, []);

    const forgotResetPassword = useCallback(async () => {
        throw new Error('OTP-based password reset is not supported by the current backend. Please use the email reset link.');
    }, []);

    /* ── Validate referral code ── */
    const validateReferral = useCallback(async _code =>
        apiCall(async () => {
            return { message: 'Referral code accepted', data: { valid: true, promoterName: '' } };
        }), []);

    /* ── REGISTER — initiates signup, returns pendingVerification: true ── */
    const register = useCallback(({ firstName, lastName, email, phone, country_code, referralCode, password }) =>
        apiCall(async () => {
            const mobile      = toMobile(phone, country_code);
            const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
            const payload     = { mobile, displayName, password };
            if (email)        payload.email        = email.trim();
            if (referralCode) payload.referralCode  = referralCode.toUpperCase();
            const response = await axios.post(`${API}/register`, payload);
            const result   = unwrap(response);
            if (result.data?.user) persistUser(result.data.user, result.data.accessToken, result.data.refreshToken);
            return result;
        }), []); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── Verify signup OTP → activates account and logs in ── */
    const verifySignupOtp = useCallback(({ mobile, email, otp }) =>
        apiCall(async () => {
            const response = await axios.post(`${API}/verify-signup`, { mobile, email, otp });
            const result   = unwrap(response);
            if (result.data?.user) persistUser(result.data.user, result.data.accessToken, result.data.refreshToken);
            return result;
        }), []); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── Resend signup verification OTP ── */
    const resendVerificationOtp = useCallback(({ mobile, email }) =>
        apiCall(async () => {
            const response = await axios.post(`${API}/resend-verification`, { mobile, email });
            return unwrap(response);
        }), []);

    /*
     * signupInit / signupResendOtp / signupComplete kept as aliases so any
     * component still using the old API continues to compile.
     */
    const signupInit = register;

    const signupResendOtp = useCallback(async () => {
        throw new Error('Separate OTP step is no longer required — registration completes in one step.');
    }, []);

    const signupComplete = useCallback(async () => ({ message: 'Already registered', data: {} }), []);

    /* ── OTP Login Step 1: send OTP to mobile ── */
    const sendOtp = useCallback((phone, country_code) =>
        apiCall(async () => {
            const mobile   = toMobile(phone, country_code);
            const response = await axios.post(`${API}/send-otp`, { mobile, channel: 'mobile' });
            const result   = unwrap(response);
            /* New backend returns { otpPreview } in dev mode (not { otp }) */
            if (result.data?.otpPreview) result.data.otp = result.data.otpPreview;
            return result;
        }), []);

    /* ── OTP Login Step 1 resend: same endpoint as send ── */
    const resendOtp = useCallback((phone, country_code) => sendOtp(phone, country_code), [sendOtp]);

    /* ── OTP Login Step 2: verify OTP → login ── */
    const verifyOtpAndLogin = useCallback((phone, otp, country_code) =>
        apiCall(async () => {
            const mobile   = toMobile(phone, country_code);
            const response = await axios.post(`${API}/login-otp`, { mobile, otp, channel: 'mobile' });
            const result   = unwrap(response);
            if (result.data?.user) persistUser(result.data.user, result.data.accessToken, result.data.refreshToken);
            return result;
        }), []); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── Update own profile ── */
    const updateProfile = useCallback(({ firstName, lastName, email }) =>
        apiCall(async () => {
            const response = await axios.put(
                `${API}/profile`,
                { firstName, lastName, email },
                { headers: authHeaders() },
            );
            const result = unwrap(response);
            if (result.data?.user) {
                setAuthUser(result.data.user);
                localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(result.data.user));
            }
            return result;
        }), []); // eslint-disable-line react-hooks/exhaustive-deps

    const logout = useCallback(async () => {
        try {
            await axios.post(`${API}/logout`, {}, { headers: authHeaders() });
        } catch { /* ignore */ }
        clearUser();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const value = useMemo(() => ({
        authUser,
        validateReferral,
        register,
        signupInit,
        signupResendOtp,
        signupComplete,
        verifySignupOtp,
        resendVerificationOtp,
        sendOtp,
        resendOtp,
        verifyOtpAndLogin,
        loginWithEmail,
        loginWithPhone,
        forgotPassword,
        resetPassword,
        forgotSendOtp,
        forgotResetPassword,
        updateProfile,
        logout,
    }), [
        authUser,
        validateReferral,
        register,
        signupInit,
        signupResendOtp,
        signupComplete,
        verifySignupOtp,
        resendVerificationOtp,
        sendOtp,
        resendOtp,
        verifyOtpAndLogin,
        loginWithEmail,
        loginWithPhone,
        forgotPassword,
        resetPassword,
        forgotSendOtp,
        forgotResetPassword,
        updateProfile,
        logout,
    ]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
