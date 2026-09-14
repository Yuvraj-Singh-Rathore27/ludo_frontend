import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWallet } from '../../context/WalletContext';
import { useAudioSettings } from '../../context/AudioContext';
import logoDice from '../../images/pages/ludi-profile.png';
import styles from './GlobalNavbar.module.css';

const getInitials = user => {
    if (!user?.displayName) return '';
    const parts = user.displayName.trim().split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
};

const NavIcon = ({ type, className }) => {
    const p = { className, viewBox: '0 0 48 48', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': 'true' };
    switch (type) {
        case 'home':
            return (
                <svg {...p}>
                    <path d='M7 23L24 9l17 14' /><path d='M13 21v18h22V21' /><path d='M20 39V28h8v11' />
                </svg>
            );
        case 'trophy':
            return (
                <svg {...p}>
                    <path d='M16 8h16v9c0 6-3.4 10-8 10s-8-4-8-10V8z' />
                    <path d='M16 12H8v4c0 4.4 3.4 8 8 8M32 12h8v4c0 4.4-3.4 8-8 8' />
                    <path d='M24 27v8M16 40h16M19 35h10' />
                </svg>
            );
        case 'history':
            return (
                <svg {...p}>
                    <path d='M14 16h-6v-6' /><path d='M9 16a17 17 0 1 1 2 19' /><path d='M24 15v10l7 4' />
                </svg>
            );
        case 'coin':
            return (
                <svg {...p}>
                    <circle cx='24' cy='24' r='16' /><circle cx='24' cy='24' r='11' strokeWidth='1.6' />
                    <path d='M24 16v2.5M24 29.5v2.5' strokeLinecap='round' />
                    <path d='M21 20.5h5c2 0 3.5 1.5 3.5 3.5s-1.5 3.5-3.5 3.5h-3c-2 0-3.5 1.5-3.5 3.5s1.5 3.5 3.5 3.5h5.5' strokeLinecap='round' />
                </svg>
            );
        case 'wallet':
            return (
                <svg {...p}>
                    <rect x='6' y='12' width='36' height='26' rx='4' /><path d='M6 20h36' />
                    <circle cx='34' cy='31' r='3' fill='currentColor' stroke='none' /><path d='M14 8h20' />
                </svg>
            );
        case 'profile':
            return (
                <svg {...p}>
                    <circle cx='24' cy='17' r='8' /><path d='M8 42c0-8 7-13 16-13s16 5 16 13' />
                </svg>
            );
        case 'sound-on':
            return (
                <svg {...p} strokeWidth='2.4' strokeLinecap='round' strokeLinejoin='round'>
                    <path d='M6 18v12h8l12 9V9L14 18H6z' />
                    <path d='M33 16a11 11 0 0 1 0 16' />
                    <path d='M38 11a18 18 0 0 1 0 26' />
                </svg>
            );
        case 'sound-off':
            return (
                <svg {...p} strokeWidth='2.4' strokeLinecap='round' strokeLinejoin='round'>
                    <path d='M6 18v12h8l12 9V9L14 18H6z' />
                    <path d='M31 19l10 10M41 19l-10 10' />
                </svg>
            );
        default:
            return null;
    }
};

const fmt = n => {
    const num = parseFloat(n);
    return isNaN(num) ? '0' : num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

const GlobalNavbar = ({ activePage = 'home' }) => {
    const { authUser, logout } = useAuth();
    const { balance, fetchBalance } = useWallet();
    const { muted, toggleMute } = useAudioSettings();
    const navigate = useNavigate();
    const location = useLocation();
    const [profileOpen, setProfileOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
    const profileRef = useRef(null);
    const toggleRef = useRef(null);
    const menuButtonRef = useRef(null);
    const drawerRef = useRef(null);

    const initials = useMemo(() => getInitials(authUser), [authUser]);
    const displayName = useMemo(() => (authUser?.displayName || '')
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' '), [authUser?.displayName]);

    const totalBalance   = balance?.totalBalance  ?? 0;
    const blockedBalance = balance?.lockedBalance ?? 0;

    useEffect(() => {
        if (authUser) fetchBalance().catch(() => {});
    }, [authUser, fetchBalance]);

    const handleToggle = () => {
        if (!profileOpen && toggleRef.current) {
            const rect = toggleRef.current.getBoundingClientRect();
            setDropPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
        }
        setProfileOpen(o => !o);
    };

    const closeMenu = useCallback(() => setMenuOpen(false), []);

    const handleMenuToggle = () => {
        setProfileOpen(false);
        setMenuOpen(o => !o);
    };

    const handleLogout = async () => {
        try { await logout(); } catch {}
        setProfileOpen(false);
        setMenuOpen(false);
        navigate('/auth/login', { replace: true });
    };

    /* close the drawer whenever the route changes */
    useEffect(() => { setMenuOpen(false); }, [location.pathname]);

    /* Escape closes, focus returns to the hamburger; lock page scroll while open */
    useEffect(() => {
        if (!menuOpen) return undefined;

        const onKeyDown = e => {
            if (e.key === 'Escape') {
                setMenuOpen(false);
                menuButtonRef.current?.focus();
            }
        };
        const onResize = () => {
            if (window.innerWidth > 900) setMenuOpen(false);
        };

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onKeyDown);
        window.addEventListener('resize', onResize);
        drawerRef.current?.focus();

        return () => {
            document.body.style.overflow = prevOverflow;
            document.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('resize', onResize);
        };
    }, [menuOpen]);

    useEffect(() => {
        const handler = e => {
            if (
                profileRef.current && !profileRef.current.contains(e.target) &&
                toggleRef.current  && !toggleRef.current.contains(e.target)
            ) setProfileOpen(false);
        };
        document.addEventListener('pointerdown', handler);
        return () => document.removeEventListener('pointerdown', handler);
    }, []);

    return (
        <>
            <header className={styles.topbar}>
                <button
                    ref={menuButtonRef}
                    className={`${styles.menuButton} ${menuOpen ? styles.menuButtonOpen : ''}`}
                    type='button'
                    aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={menuOpen}
                    aria-controls='global-side-drawer'
                    onClick={handleMenuToggle}
                >
                    <span /><span /><span />
                </button>

                <div className={styles.brandRow}>
                    <div className={styles.logoWrap}>
                        <img src={logoDice} alt='Ludo Arena' />
                    </div>
                    <div>
                        <strong>LUDO</strong>
                        <span>ARENA</span>
                    </div>
                </div>

                <nav className={styles.nav}>
                    <Link className={activePage === 'home' ? styles.active : ''} to='/lobby'>
                        <NavIcon type='home' className={styles.navLinkIcon} />
                        <span>Home</span>
                    </Link>
                    <Link to='/lobby' className={styles.navDisabled} onClick={e => e.preventDefault()} title='Coming soon'>
                        <NavIcon type='trophy' className={styles.navLinkIcon} />
                        <span>Leaderboard</span>
                    </Link>
                    <Link className={activePage === 'history' ? styles.active : ''} to='/history'>
                        <NavIcon type='history' className={styles.navLinkIcon} />
                        <span>History</span>
                    </Link>
                </nav>

                <div className={styles.wallet}>
                    <button
                        className={styles.soundToggle}
                        type='button'
                        aria-label={muted ? 'Unmute music' : 'Mute music'}
                        aria-pressed={muted}
                        onClick={toggleMute}
                        title={muted ? 'Unmute music' : 'Mute music'}
                    >
                        <NavIcon type={muted ? 'sound-off' : 'sound-on'} />
                    </button>
                    <button className={styles.coinBox} type='button' onClick={() => navigate('/wallet')}>
                        <span className={styles.rupeeIcon} aria-hidden='true'>₹</span>
                        <span className={styles.coinDivider} aria-hidden='true' />
                        <span className={styles.coinBalances}>
                            <span className={styles.coinTotal}>{fmt(totalBalance)}</span>
                            <span className={styles.coinBlocked}>
                                <svg viewBox='0 0 16 16' fill='none' aria-hidden='true'>
                                    <rect x='3' y='7' width='10' height='7' rx='1.5' stroke='currentColor' strokeWidth='1.5'/>
                                    <path d='M5.5 7V5a2.5 2.5 0 0 1 5 0v2' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round'/>
                                </svg>
                                ₹{fmt(blockedBalance)}
                            </span>
                            <span className={styles.balanceTooltip} aria-hidden='true'>
                                <span className={styles.balanceTooltipRow}>
                                    <span className={styles.balanceTooltipLabel}>Available</span>
                                    <span className={styles.balanceTooltipValue}>₹{fmt(totalBalance - blockedBalance)}</span>
                                </span>
                                <span className={styles.balanceTooltipRow}>
                                    <span className={styles.balanceTooltipLabel}>🔒 Locked</span>
                                    <span className={styles.balanceTooltipValue} style={{ color: 'rgba(255,150,30,0.9)' }}>₹{fmt(blockedBalance)}</span>
                                </span>
                                <span className={styles.balanceTooltipArrow} />
                            </span>
                        </span>
                        <span className={styles.coinAdd} aria-hidden='true'>+</span>
                    </button>
                    <div className={styles.profileWrap}>
                        <button
                            ref={toggleRef}
                            className={`${styles.profileToggle} ${profileOpen ? styles.profileToggleOpen : ''}`}
                            type='button'
                            aria-label='Profile menu'
                            aria-expanded={profileOpen}
                            onClick={handleToggle}
                        >
                            <div className={styles.profileAvatarCircle}>
                                {initials ? (
                                    <span>{initials}</span>
                                ) : (
                                    <svg viewBox='0 0 48 48' fill='none' aria-hidden='true'>
                                        <circle cx='24' cy='17' r='9' fill='currentColor' />
                                        <path d='M5 44c1.3-11 8-16.5 19-16.5S42.7 33 44 44' fill='currentColor' fillOpacity='0.8' />
                                    </svg>
                                )}
                            </div>
                            {displayName && <span className={styles.profileToggleName}>{displayName}</span>}
                            <svg className={styles.profileChevron} viewBox='0 0 16 16' fill='none' aria-hidden='true'>
                                <path d='M4 6l4 4 4-4' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            {profileOpen && (
                <div
                    ref={profileRef}
                    className={styles.profileDropdown}
                    style={{ position: 'fixed', top: dropPos.top, right: dropPos.right, zIndex: 9999 }}
                >
                    <div className={styles.dropdownUser}>
                        <div className={styles.dropdownAvatar}>
                            {initials || (
                                <svg viewBox='0 0 48 48' fill='none' aria-hidden='true'>
                                    <circle cx='24' cy='17' r='9' fill='currentColor' />
                                    <path d='M5 44c1.3-11 8-16.5 19-16.5S42.7 33 44 44' fill='currentColor' fillOpacity='0.8' />
                                </svg>
                            )}
                        </div>
                        <div>
                            <strong>{displayName || 'Player'}</strong>
                            {authUser?.mobile && <span>{authUser.mobile}</span>}
                        </div>
                    </div>
                    <hr className={styles.dropdownDivider} />
                    <Link to='/profile' className={styles.dropdownProfile} onClick={() => setProfileOpen(false)}>
                        <svg viewBox='0 0 24 24' fill='none' aria-hidden='true'>
                            <circle cx='12' cy='8' r='4' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' />
                            <path d='M4 20c0-4 3.6-7 8-7s8 3 8 7' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' />
                        </svg>
                        Profile
                    </Link>
                    <hr className={styles.dropdownDivider} />
                    <button className={styles.dropdownLogout} type='button' onClick={handleLogout}>
                        <svg viewBox='0 0 24 24' fill='none' aria-hidden='true'>
                            <path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' />
                            <polyline points='16 17 21 12 16 7' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' />
                            <line x1='21' y1='12' x2='9' y2='12' strokeWidth='2' strokeLinecap='round' stroke='currentColor' />
                        </svg>
                        Logout
                    </button>
                </div>
            )}

            {/* ── MOBILE SIDE DRAWER ── */}
            {menuOpen && (
                <>
                    <div
                        className={styles.drawerBackdrop}
                        role='presentation'
                        onClick={closeMenu}
                    />
                    <aside
                        id='global-side-drawer'
                        ref={drawerRef}
                        className={styles.sideDrawer}
                        aria-label='Main menu'
                        tabIndex={-1}
                    >
                        <div className={styles.drawerHeader}>
                            <div className={styles.drawerAvatar}>
                                {initials || (
                                    <svg viewBox='0 0 48 48' fill='none' aria-hidden='true'>
                                        <circle cx='24' cy='17' r='9' fill='currentColor' />
                                        <path d='M5 44c1.3-11 8-16.5 19-16.5S42.7 33 44 44' fill='currentColor' fillOpacity='0.8' />
                                    </svg>
                                )}
                            </div>
                            <div className={styles.drawerIdentity}>
                                <strong>{displayName || 'Player'}</strong>
                                {authUser?.mobile && <span>{authUser.mobile}</span>}
                            </div>
                        </div>

                        <button
                            className={styles.drawerBalance}
                            type='button'
                            onClick={() => { closeMenu(); navigate('/wallet'); }}
                        >
                            <span>
                                <small>Balance</small>
                                <strong>₹{fmt(totalBalance)}</strong>
                            </span>
                            <span className={styles.drawerBalanceAdd} aria-hidden='true'>+</span>
                        </button>

                        <nav className={styles.drawerNav}>
                            <Link to='/lobby' className={activePage === 'home' ? styles.drawerActive : ''} onClick={closeMenu}>
                                <NavIcon type='home' className={styles.drawerIcon} />
                                <span>Home</span>
                            </Link>
                            <Link to='/lobby' className={styles.drawerDisabled} onClick={e => e.preventDefault()} title='Coming soon'>
                                <NavIcon type='trophy' className={styles.drawerIcon} />
                                <span>Leaderboard</span>
                            </Link>
                            <Link to='/history' className={activePage === 'history' ? styles.drawerActive : ''} onClick={closeMenu}>
                                <NavIcon type='history' className={styles.drawerIcon} />
                                <span>History</span>
                            </Link>
                            <Link to='/wallet' className={activePage === 'wallet' ? styles.drawerActive : ''} onClick={closeMenu}>
                                <NavIcon type='wallet' className={styles.drawerIcon} />
                                <span>Wallet</span>
                            </Link>
                            <Link to='/profile' className={activePage === 'profile' ? styles.drawerActive : ''} onClick={closeMenu}>
                                <NavIcon type='profile' className={styles.drawerIcon} />
                                <span>Profile</span>
                            </Link>
                            <button type='button' onClick={toggleMute} aria-pressed={muted}>
                                <NavIcon type={muted ? 'sound-off' : 'sound-on'} className={styles.drawerIcon} />
                                <span>{muted ? 'Sound off' : 'Sound on'}</span>
                            </button>
                        </nav>

                        <div className={styles.drawerFooter}>
                            <button className={styles.drawerLogout} type='button' onClick={handleLogout}>
                                <svg viewBox='0 0 24 24' fill='none' aria-hidden='true'>
                                    <path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' />
                                    <polyline points='16 17 21 12 16 7' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' />
                                    <line x1='21' y1='12' x2='9' y2='12' strokeWidth='2' strokeLinecap='round' stroke='currentColor' />
                                </svg>
                                Logout
                            </button>
                        </div>
                    </aside>
                </>
            )}

            {/* ── MOBILE BOTTOM NAV ── */}
            <nav className={styles.bottomNav} aria-label='Mobile navigation'>
                <Link className={activePage === 'home' ? styles.bottomActive : ''} to='/lobby'>
                    <NavIcon type='home' className={styles.bottomIcon} />
                    <span>Home</span>
                </Link>
                <Link className={styles.bottomDisabled} to='/lobby' onClick={e => e.preventDefault()} title='Coming soon'>
                    <NavIcon type='trophy' className={styles.bottomIcon} />
                    <span>Leaderboard</span>
                </Link>
                <Link className={activePage === 'history' ? styles.bottomActive : ''} to='/history'>
                    <NavIcon type='history' className={styles.bottomIcon} />
                    <span>History</span>
                </Link>
                <Link className={activePage === 'wallet' ? styles.bottomActive : ''} to='/wallet'>
                    <svg className={styles.bottomIcon} viewBox='0 0 48 48' fill='none' aria-hidden='true'>
                        <rect x='6' y='12' width='36' height='26' rx='4' stroke='currentColor' strokeWidth='3.2'/>
                        <path d='M6 20h36' stroke='currentColor' strokeWidth='3.2' strokeLinecap='round'/>
                        <circle cx='34' cy='31' r='3' fill='currentColor'/>
                        <path d='M14 8h20' stroke='currentColor' strokeWidth='3.2' strokeLinecap='round'/>
                    </svg>
                    <span>Wallet</span>
                </Link>
            </nav>
        </>
    );
};

export default GlobalNavbar;
