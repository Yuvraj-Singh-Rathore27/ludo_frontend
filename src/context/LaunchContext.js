import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

/*
 * Daba Fantasy launch flow.
 * DABBA opens  /lobby?data=<encrypted>  — an AES-256-GCM payload with user_id +
 * access_token that only the Ludo backend can decrypt. The browser just forwards
 * `data`; the backend verifies with DABBA and returns Ludo tokens + the DABBA profile.
 * Old plain launch  /lobby?user_id=..&access_token=..&source=dabba  still works for
 * local testing when the backend has DABBA_PLAIN_LAUNCH_ENABLED=true.
 */

const LaunchContext = createContext(null);

const LAUNCH_API = `${process.env.REACT_APP_DABA_API_URL || 'https://dev-api.dabafantasy.com'}/api/auth/ludo/launch`;

const STORAGE_USER_ID_KEY = 'daba_user_id';
const STORAGE_TOKEN_KEY   = 'daba_access_token';
const STORAGE_INFO_KEY    = 'daba_user_info';

const safeGet = key => {
    try { return localStorage.getItem(key); } catch { return null; }
};
const safeSet = (key, value) => {
    try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
};
const safeRemove = key => {
    try { localStorage.removeItem(key); } catch { /* storage blocked */ }
};

const readStoredInfo = () => {
    try { return JSON.parse(safeGet(STORAGE_INFO_KEY)) || null; }
    catch { return null; }
};

/* Remove the one-time `data` param from the address bar (keeps the page, no reload) */
const removeLaunchDataFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('data')) return;
    params.delete('data');
    const rest = params.toString();
    window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`,
    );
};

/* Pick the DABBA launch params from the URL */
const consumeUrlCredentials = () => {
    const params      = new URLSearchParams(window.location.search);

    // Encrypted launch — nothing readable in the browser, so nothing to store here.
    const launchData = params.get('data');
    if (launchData) {
        console.log('Launch source: dabba (encrypted data)');
        // Drop any plain DABBA credentials left over from old-style launches.
        safeRemove(STORAGE_USER_ID_KEY);
        safeRemove(STORAGE_TOKEN_KEY);
        return { userId: null, accessToken: null, launchData, fromUrl: true };
    }

    const isDabba     = params.get('source') === 'dabba';
    const userId      = isDabba ? params.get('user_id') : null;
    const accessToken = isDabba ? params.get('access_token') : null;

    if (userId && accessToken) {
        console.log('Launch source: dabba');
        console.log('Launch user_id:', userId);
        console.log('Launch access_token:', accessToken);

        // A different player launched — drop the old cached profile.
        if (safeGet(STORAGE_USER_ID_KEY) !== userId) safeRemove(STORAGE_INFO_KEY);

        safeSet(STORAGE_USER_ID_KEY, userId);
        safeSet(STORAGE_TOKEN_KEY, accessToken);

        // LOCAL TESTING: URL cleanup disabled so user_id & access_token stay visible in the
        // address bar. Re-enable for production to keep the token out of browser history,
        // bookmarks and Referer headers.
        // params.delete('user_id');
        // params.delete('access_token');
        // const rest = params.toString();
        // window.history.replaceState(
        //     window.history.state,
        //     '',
        //     `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`,
        // );
    }

    return {
        userId:      safeGet(STORAGE_USER_ID_KEY),
        accessToken: safeGet(STORAGE_TOKEN_KEY),
        launchData:  null,
        // Only a link with source=dabba + user_id + access_token is a DABBA launch.
        // Any other link keeps the normal Ludo Login / Signup flow.
        fromUrl:     !!(userId && accessToken),
    };
};

/* Map the API's user_info block into the shape the UI uses */
const normalizeUserInfo = (userId, userInfo) => {
    // user_info comes flat ({ teamname, ... }) or nested ({ result: { value: [ {...} ] } }).
    const raw = userInfo?.result?.value?.[0] ?? userInfo;
    if (!raw || !('teamname' in raw || 'walletamaount' in raw)) return null;
    const wallet = parseFloat(raw.walletamaount); // (sic) API field name
    return {
        userId:          Number(userId),
        name:            raw.name && raw.name !== 'N/A' ? raw.name : '',
        teamName:        raw.teamname || '',
        image:           raw.image || '',
        email:           raw.email || '',
        mobile:          raw.mobile || '',
        walletAmount:    isNaN(wallet) ? 0 : wallet,
        verified:        raw.verified === 1,
        createdAt:       raw.created_at || '',
        totalChallenges: Number(raw.totalchallenges) || 0,
        totalWon:        parseFloat(raw.totalwon) || 0,
    };
};

export const LaunchProvider = ({ children }) => {
    const { authUser, loginWithDaba } = useAuth();
    const [credentials] = useState(consumeUrlCredentials);
    const [launchUser, setLaunchUser] = useState(readStoredInfo);
    // True while a DABBA launch link is logging in to Ludo — routes wait instead of
    // redirecting to the Login page. Not needed if already logged in as this DABBA user.
    // (Encrypted launch: the user is unknown until the backend decrypts, so always wait.)
    // Set when an encrypted launch link is rejected (expired / tampered / not verified).
    const [dabaLaunchError, setDabaLaunchError] = useState(null);
    const [dabaLoginPending, setDabaLoginPending] = useState(() =>
        credentials.fromUrl &&
        (!!credentials.launchData ||
         !(authUser?.dabaUserId === Number(credentials.userId) && safeGet('ludo_token')))
    );

    // Fetch fresh profile/balance on every page load (cached copy shows instantly meanwhile).
    useEffect(() => {
        const { userId, accessToken, launchData } = credentials;

        // Encrypted launch: the backend decrypts, verifies with DABBA, syncs user + balance,
        // and returns Ludo tokens plus the DABBA profile for display.
        if (launchData) {
            loginWithDaba({ data: launchData })
                .then(result => {
                    const profile = result?.data?.dabbaProfile;
                    console.log('Ludo login:', result?.message, {
                        ludoUserId: result?.data?.user?.id,
                        created:    result?.data?.created,
                        balance:    result?.data?.balance,
                    });
                    console.log('Launch user_info:', profile);
                    if (profile) {
                        setLaunchUser(profile);
                        safeSet(STORAGE_INFO_KEY, JSON.stringify(profile));
                    }
                    // Decrypt once per launch: drop `data` from the address bar so a refresh
                    // uses the Ludo session instead of the (5-minute) launch link.
                    removeLaunchDataFromUrl();
                })
                .catch(err => {
                    console.log('Ludo login error:', err.message);
                    setDabaLaunchError(err.message);
                })
                .finally(() => setDabaLoginPending(false));
            return;
        }

        if (!userId || !accessToken) return;

        axios.post(LAUNCH_API, { user_id: Number(userId), access_token: accessToken })
            .then(({ data: body }) => {
                if (body?.status !== 1) throw new Error(body?.message || 'Game launch failed');
                const info = normalizeUserInfo(body.data?.user_id ?? userId, body.data?.user_info);
                console.log('Launch user_info:', info);
                if (info) {
                    setLaunchUser(info);
                    safeSet(STORAGE_INFO_KEY, JSON.stringify(info));
                }
            })
            .catch(err => console.log('Launch error:', err.response?.data?.message || err.message));

        // Ludo login + balance sync (DABBA token → Ludo token) — only for a DABBA launch link.
        // The backend verifies the DABBA token, creates/updates the Ludo user, syncs the
        // Ludo balance to the DABBA balance and returns Ludo's own tokens. Runs on every
        // DABBA launch so the balance is fresh; if already logged in as this DABBA user it
        // runs in the background (no loader).
        if (!credentials.fromUrl) return;
        loginWithDaba({ user_id: Number(userId), access_token: accessToken })
            .then(result => console.log('Ludo login:', result?.message, {
                ludoUserId: result?.data?.user?.id,
                created:    result?.data?.created,
                balance:    result?.data?.balance,
            }))
            .catch(err => console.log('Ludo login error:', err.message)) // no Ludo login → normal Login page
            .finally(() => setDabaLoginPending(false));
    }, [credentials]); // eslint-disable-line react-hooks/exhaustive-deps -- run once per launch

    const clearLaunch = useCallback(() => {
        safeRemove(STORAGE_USER_ID_KEY);
        safeRemove(STORAGE_TOKEN_KEY);
        safeRemove(STORAGE_INFO_KEY);
        setLaunchUser(null);
    }, []);

    const dismissLaunchError = useCallback(() => {
        removeLaunchDataFromUrl();
        setDabaLaunchError(null);
    }, []);

    const value = useMemo(
        () => ({ launchUser, dabaLoginPending, dabaLaunchError, dismissLaunchError, clearLaunch }),
        [launchUser, dabaLoginPending, dabaLaunchError, dismissLaunchError, clearLaunch],
    );

    return (
        <LaunchContext.Provider value={value}>
            {children}
        </LaunchContext.Provider>
    );
};

const NO_LAUNCH = {
    launchUser: null, dabaLoginPending: false, dabaLaunchError: null,
    dismissLaunchError: () => {}, clearLaunch: () => {},
};

export const useLaunch = () => useContext(LaunchContext) || NO_LAUNCH;
export default LaunchContext;
