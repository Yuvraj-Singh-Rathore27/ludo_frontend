import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link }          from 'react-router-dom';
import { useAuth }                    from '../../../context/AuthContext';
import styles                         from './AuthLoginScreen.module.css';
import logoDice                       from '../../../images/pages/ludi-profile.png';

/* ─── country list ─────────────────────────────────────── */
const COUNTRIES = [
    { code: 'IN', name: 'India',       dial: '91',  flag: '🇮🇳', len: 10 },
    { code: 'US', name: 'USA',         dial: '1',   flag: '🇺🇸', len: 10 },
    { code: 'GB', name: 'UK',          dial: '44',  flag: '🇬🇧', len: 10 },
    { code: 'AE', name: 'UAE',         dial: '971', flag: '🇦🇪', len: 9  },
    { code: 'AU', name: 'Australia',   dial: '61',  flag: '🇦🇺', len: 9  },
    { code: 'CA', name: 'Canada',      dial: '1',   flag: '🇨🇦', len: 10 },
    { code: 'SG', name: 'Singapore',   dial: '65',  flag: '🇸🇬', len: 8  },
    { code: 'DE', name: 'Germany',     dial: '49',  flag: '🇩🇪', len: 10 },
    { code: 'PK', name: 'Pakistan',    dial: '92',  flag: '🇵🇰', len: 10 },
    { code: 'BD', name: 'Bangladesh',  dial: '880', flag: '🇧🇩', len: 10 },
];

/* ─── icons ─────────────────────────────────────────────── */
const ShieldIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/><path d='M9 12l2 2 4-4'/></svg>;
const BoltIcon    = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><path d='M13 2L3 14h9l-1 8 10-12h-9l1-8z'/></svg>;
const TrophyIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><path d='M8 21h8m-4-4v4M7 4H5v4c0 2.2 1.8 4 4 4M17 4h2v4c0 2.2-1.8 4-4 4'/><path d='M7 4h10v6c0 2.8-2.2 5-5 5s-5-2.2-5-5V4z'/></svg>;
const CheckIcon   = () => <svg viewBox='0 0 52 52' fill='none' strokeWidth='2.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><circle cx='26' cy='26' r='23'/><path d='M14 26l9 9 15-17'/></svg>;
const ChevronDown = () => <svg viewBox='0 0 16 16' fill='none' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><path d='M4 6l4 4 4-4'/></svg>;
const MailIcon    = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><rect x='2' y='4' width='20' height='16' rx='2.5'/><path d='M2 8l10 7 10-7'/></svg>;
const LockIcon    = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><rect x='3' y='11' width='18' height='11' rx='2'/><path d='M7 11V7a5 5 0 0 1 10 0v4'/></svg>;
const EyeOpen     = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/><circle cx='12' cy='12' r='3'/></svg>;
const EyeOff      = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><path d='M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58'/><path d='M9.88 4.24A10.72 10.72 0 0 1 12 4c7 0 11 8 11 8a18.2 18.2 0 0 1-3.18 4.24'/><path d='M6.61 6.61A18.7 18.7 0 0 0 1 12s4 8 11 8a10.8 10.8 0 0 0 5.39-1.39'/><line x1='3' y1='3' x2='21' y2='21'/></svg>;

/* ─── helpers ────────────────────────────────────────────── */
const digitsOnly = v => v.replace(/\D/g, '');

const validateLocal = (local, country) => {
    const n = digitsOnly(local);
    if (!n) return 'Phone number is required';
    if (n.length < 7)          return 'Too short — enter local number without country code';
    if (n.length > 15)         return 'Too long';
    if (n.length !== country.len && country.len) return `${country.name} numbers must be ${country.len} digits`;
    return '';
};

/* ─── CountryPicker ─────────────────────────────────────── */
const CountryPicker = ({ value, onChange, disabled }) => {
    const [open, setOpen] = useState(false);
    const ref             = useRef(null);

    useEffect(() => {
        if (!open) return;
        const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, [open]);

    return (
        <div className={styles.picker} ref={ref}>
            <button
                type='button'
                className={`${styles.pickerBtn} ${open ? styles.pickerBtnOpen : ''}`}
                onClick={() => !disabled && setOpen(o => !o)}
                disabled={disabled}
                aria-label='Select country code'
            >
                <span className={styles.pickerFlag}>{value.flag}</span>
                <span className={styles.pickerDial}>+{value.dial}</span>
                <span className={`${styles.pickerChevron} ${open ? styles.pickerChevronOpen : ''}`}>
                    <ChevronDown />
                </span>
            </button>

            {open && (
                <ul className={styles.pickerDropdown} role='listbox'>
                    {COUNTRIES.map(c => (
                        <li key={c.code} role='option' aria-selected={c.code === value.code}
                            className={`${styles.pickerItem} ${c.code === value.code ? styles.pickerItemActive : ''}`}
                            onClick={() => { onChange(c); setOpen(false); }}
                        >
                            <span>{c.flag}</span>
                            <span className={styles.pickerItemName}>{c.name}</span>
                            <span className={styles.pickerItemDial}>+{c.dial}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

/* ─── OtpBoxes ──────────────────────────────────────────── */
const OtpBoxes = ({ value, onChange, count = 6 }) => {
    const refs = useRef([]);

    const handleInput = (i, e) => {
        const v   = digitsOnly(e.target.value).slice(-1);
        const arr = Array.from({ length: count }, (_, idx) => (value || '')[idx] || '');
        arr[i] = v;
        onChange(arr.join(''));
        if (v && i < count - 1) refs.current[i + 1]?.focus();
    };

    const handleKeyDown = (i, e) => {
        const arr = Array.from({ length: count }, (_, idx) => (value || '')[idx] || '');
        if (e.key === 'Backspace') {
            if (!arr[i] && i > 0) { refs.current[i - 1]?.focus(); return; }
            arr[i] = '';
            onChange(arr.join(''));
        }
        if (e.key === 'ArrowLeft'  && i > 0)          refs.current[i - 1]?.focus();
        if (e.key === 'ArrowRight' && i < count - 1)  refs.current[i + 1]?.focus();
    };

    const handlePaste = e => {
        const pasted = digitsOnly(e.clipboardData.getData('text')).slice(0, count);
        onChange(pasted);
        refs.current[Math.min(pasted.length, count - 1)]?.focus();
        e.preventDefault();
    };

    return (
        <div className={styles.otpBoxes}>
            {Array.from({ length: count }, (_, i) => {
                const filled = !!((value || '')[i]);
                return (
                    <input
                        key={i}
                        ref={el => refs.current[i] = el}
                        type='text'
                        inputMode='numeric'
                        maxLength={1}
                        value={(value || '')[i] || ''}
                        onChange={e => handleInput(i, e)}
                        onKeyDown={e => handleKeyDown(i, e)}
                        onPaste={i === 0 ? handlePaste : undefined}
                        className={`${styles.otpDigit} ${filled ? styles.otpDigitFilled : ''}`}
                        placeholder='•'
                        autoFocus={i === 0}
                        autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    />
                );
            })}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════
   AuthLoginScreen
═══════════════════════════════════════════════════════════ */
const AuthLoginScreen = () => {
    const navigate = useNavigate();
    const { sendOtp, resendOtp, verifyOtpAndLogin, loginWithEmail, loginWithPhone, forgotPassword, verifySignupOtp, resendVerificationOtp } = useAuth();

    /* Login method: 'otp' | 'email-pass' | 'phone-pass' */
    const [method,      setMethod]      = useState('otp');
    const [step,        setStep]        = useState('phone');   // 'phone' | 'otp'
    const [country,     setCountry]     = useState(COUNTRIES[0]);
    const [local,       setLocal]       = useState('');
    const [otp,         setOtp]         = useState('');
    const [devOtp,      setDevOtp]      = useState('');
    const [localErr,    setLocalErr]    = useState('');
    const [touched,     setTouched]     = useState(false);
    const [apiError,    setApiError]    = useState('');
    const [loading,     setLoading]     = useState(false);
    const [success,     setSuccess]     = useState(false);
    const [userName,    setUserName]    = useState('');
    const [resendTimer, setResendTimer] = useState(0);
    const [otpKey,      setOtpKey]      = useState(0);
    const [toast,       setToast]       = useState({ msg: '', visible: false });
    /* Password login state */
    const [pwdEmail,    setPwdEmail]    = useState('');
    const [pwdPhone,    setPwdPhone]    = useState('');
    const [password,    setPassword]    = useState('');
    const [showPwd,     setShowPwd]     = useState(false);
    /* Forgot password — link-based flow: 'off' | 'input' | 'sent' */
    const [forgotStep,       setForgotStep]       = useState('off');
    const [forgotIdentifier, setForgotIdentifier] = useState('');
    const [forgotDevToken,   setForgotDevToken]   = useState('');

    /* Pending-verification OTP step (when password login returns 403 pendingVerification) */
    const [verifyStep,      setVerifyStep]      = useState(false);
    const [verifyMobile,    setVerifyMobile]    = useState('');
    const [verifyEmail,     setVerifyEmail]     = useState('');
    const [verifyHint,      setVerifyHint]      = useState('');
    const [verifyOtp,       setVerifyOtp]       = useState('');
    const [verifyErr,       setVerifyErr]       = useState('');
    const [verifyLoading,   setVerifyLoading]   = useState(false);
    const [resendCooldown,  setResendCooldown]  = useState(0);
    const resendTimerRef = useRef(null);
    useEffect(() => () => clearInterval(resendTimerRef.current), []);

    const startResendTimer = () => {
        setResendCooldown(60);
        clearInterval(resendTimerRef.current);
        resendTimerRef.current = setInterval(() =>
            setResendCooldown(c => { if (c <= 1) clearInterval(resendTimerRef.current); return Math.max(0, c - 1); }),
        1000);
    };

    const handleVerifySignupOtp = async () => {
        if (verifyOtp.length !== 6) { setVerifyErr('Enter the 6-digit OTP'); return; }
        setVerifyLoading(true); setVerifyErr('');
        try {
            const result = await verifySignupOtp({ mobile: verifyMobile || undefined, email: verifyEmail || undefined, otp: verifyOtp });
            setUserName(result.data?.user?.displayName || '');
            if (result.message) showToast(result.message);
            setTimeout(() => setSuccess(true), 400);
            setTimeout(() => navigate('/lobby'), 1800);
        } catch (e) {
            setVerifyErr(e.message || 'Invalid or expired OTP. Please try again.');
        } finally { setVerifyLoading(false); }
    };

    const handleResendVerifyOtp = async () => {
        if (resendCooldown > 0) return;
        setVerifyLoading(true); setVerifyErr('');
        try {
            const res = await resendVerificationOtp({ mobile: verifyMobile || undefined, email: verifyEmail || undefined });
            const preview = res.data?.otpPreview;
            if (preview) setVerifyHint(preview);
            startResendTimer();
        } catch (e) {
            setVerifyErr(e.message || 'Could not resend OTP. Please try again.');
        } finally { setVerifyLoading(false); }
    };

    const showToast = msg => {
        setToast({ msg, visible: true });
        setTimeout(() => setToast(t => ({ ...t, visible: false })), 2800);
    };

    /* tick down resend cooldown */
    useEffect(() => {
        if (resendTimer <= 0) return;
        const t = setTimeout(() => setResendTimer(s => s - 1), 1000);
        return () => clearTimeout(t);
    }, [resendTimer]);

    const fullPhone = `${country.dial}${digitsOnly(local)}`;

    /* Validate on change if already touched */
    const handleLocalChange = e => {
        const v = digitsOnly(e.target.value).slice(0, 15);
        setLocal(v);
        if (touched) setLocalErr(validateLocal(v, country));
        setApiError('');
    };

    const handleCountryChange = c => {
        setCountry(c);
        if (touched) setLocalErr(validateLocal(local, c));
    };

    /* Step 1 — send OTP */
    const handleSendOtp = async () => {
        setTouched(true);
        const err = validateLocal(local, country);
        setLocalErr(err);
        if (err) return;

        setLoading(true);
        setApiError('');
        try {
            const result = await sendOtp(digitsOnly(local), country.dial);
            setDevOtp(result.data?.otp || '');
            setStep('otp');
            setOtp('');
            setResendTimer(60);
        } catch (e) {
            setApiError(e.message || 'Failed to send OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    /* Resend OTP — stays on OTP step, restarts 60s timer */
    const handleResendOtp = async () => {
        setLoading(true);
        setApiError('');
        try {
            const result = await resendOtp(digitsOnly(local), country.dial);
            setDevOtp(result.data?.otp || '');
            setOtp('');
            setResendTimer(60);
        } catch (e) {
            setApiError(e.message || 'Failed to resend OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    /* Clear API error as soon as user starts retyping OTP */
    const handleOtpChange = v => {
        setOtp(v);
        if (apiError) setApiError('');
    };

    /* Step 2 — verify OTP against DB */
    const handleVerifyOtp = async () => {
        setApiError('');
        if (otp.replace(/\D/g, '').length < 1) { setApiError('Please enter the OTP'); return; }
        setLoading(true);
        try {
            const result = await verifyOtpAndLogin(digitsOnly(local), otp, country.dial);
            setUserName(result.data?.user?.displayName || result.data?.user?.firstName || '');
            if (result.message) showToast(result.message);
            setTimeout(() => setSuccess(true), 400);
            setTimeout(() => navigate('/lobby'), 1800);
        } catch (e) {
            setApiError(e.message || 'Login failed. Please try again.');
            setOtp('');                      // clear all boxes
            setOtpKey(k => k + 1);          // remount OtpBoxes so autoFocus fires on box #1
        } finally {
            setLoading(false);
        }
    };

    /* ── Password-based login handlers ── */
    const handlePasswordLogin = async () => {
        setApiError('');
        if (!password) return setApiError('Password is required');
        setLoading(true);
        try {
            let result;
            if (method === 'email-pass') {
                if (!pwdEmail.trim()) return setApiError('Email is required');
                result = await loginWithEmail(pwdEmail.trim(), password);
            } else {
                if (!pwdPhone.trim()) return setApiError('Phone is required');
                result = await loginWithPhone(digitsOnly(pwdPhone), country.dial, password);
            }
            setUserName(result.data?.user?.displayName || result.data?.user?.firstName || '');
            if (result.message) showToast(result.message);
            setTimeout(() => setSuccess(true), 400);
            setTimeout(() => navigate('/lobby'), 1800);
        } catch (e) {
            if (e.data?.pendingVerification) {
                setVerifyMobile(e.data.mobile || '');
                setVerifyEmail(e.data.email || pwdEmail.trim() || '');
                setVerifyHint(e.data.otpPreview || '');
                setVerifyOtp('');
                setVerifyErr('');
                startResendTimer();
                setVerifyStep(true);
            } else {
                setApiError(e.message || 'Login failed.');
            }
        } finally { setLoading(false); }
    };

    /* Forgot password — link-based reset */
    const handleForgotSubmit = async () => {
        if (!forgotIdentifier.trim()) return setApiError('Enter your email or phone number');
        setLoading(true); setApiError('');
        try {
            const res = await forgotPassword(forgotIdentifier.trim());
            setForgotDevToken(res.data?.resetTokenPreview || '');
            setForgotStep('sent');
        } catch (e) {
            setApiError(e.message || 'Failed to send reset link');
        } finally { setLoading(false); }
    };

    const resetForgotFlow = () => {
        setForgotStep('off'); setForgotIdentifier(''); setForgotDevToken(''); setApiError('');
    };

    /* ── Success screen ── */
    if (success) return (
        <div className={styles.page}>
            <main className={styles.card}>
                <div className={styles.successWrap}>
                    <span className={styles.successIcon}><CheckIcon /></span>
                    <h2>Welcome back{userName ? `, ${userName}` : ''}!</h2>
                    <p>Taking you to the arena…</p>
                </div>
            </main>
        </div>
    );

    return (
        <div className={styles.page}>
            <div className={`${styles.toast} ${toast.visible ? styles.toastVisible : ''}`}>
                <svg viewBox='0 0 20 20' fill='currentColor' width='18' height='18'><path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' clipRule='evenodd'/></svg>
                {toast.msg}
            </div>
            <main className={styles.card}>

                {/* ── HEADER ── */}
                <div className={styles.cardHeader}>
                    <div className={styles.logoRing}>
                        <img src={logoDice} alt='Ludo Arena' />
                    </div>
                    <div className={styles.brandBlock}>
                        <strong className={styles.brandName}>LUDO ARENA</strong>
                        <span className={styles.brandSub}>PLAY • COMPETE • WIN</span>
                    </div>
                </div>

                <div className={styles.cardBody}>

                    {/* ── TITLE ── */}
                    <div className={styles.titleSection}>
                        <div className={styles.titleRow}>
                            <span className={styles.tLineL} />
                            <span className={styles.tDiamond}>◆</span>
                            <h1 className={styles.titleText}>Welcome Back!</h1>
                            <span className={styles.tDiamond}>◆</span>
                            <span className={styles.tLineR} />
                        </div>
                        <p className={styles.titleSub}>Login to continue your journey</p>
                    </div>

                    {/* ── PENDING-VERIFICATION OTP STEP ── */}
                    {verifyStep && (
                        <div>
                            <p style={{ textAlign: 'center', fontSize: '0.85rem', marginBottom: '0.4rem', color: '#94a3b8' }}>
                                Account not yet verified. We sent a 6-digit code to{' '}
                                <strong style={{ color: '#e2e8f0' }}>
                                    {verifyMobile
                                        ? `+${verifyMobile.slice(0, 2)}****${verifyMobile.slice(-4)}`
                                        : verifyEmail.replace(/(.{2}).*(@.*)/, '$1***$2')}
                                </strong>
                            </p>
                            {verifyHint && (
                                <div className={styles.devHint}>
                                    Dev OTP: <strong>{verifyHint}</strong>
                                </div>
                            )}
                            <div className={styles.otpCard}>
                                <div className={styles.otpCardTop}>
                                    <div className={styles.otpCardDot} />
                                    <h3>Verify Your Account</h3>
                                </div>
                                <OtpBoxes key='verify' value={verifyOtp} onChange={v => { setVerifyOtp(v); setVerifyErr(''); }} count={6} />
                            </div>
                            {verifyErr && <p className={styles.apiError}>{verifyErr}</p>}
                            <button type='button' className={styles.btn} onClick={handleVerifySignupOtp} disabled={verifyLoading || verifyOtp.length < 6}>
                                {verifyLoading ? <><span className={styles.spin} />Verifying…</> : <><span>VERIFY & LOGIN</span><span className={styles.btnArrow}>›</span></>}
                            </button>
                            <p className={styles.resendRow} style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                                Didn't receive it?{' '}
                                {resendCooldown > 0 ? (
                                    <span style={{ color: '#64748b' }}>Resend in {resendCooldown}s</span>
                                ) : (
                                    <button type='button' onClick={handleResendVerifyOtp} disabled={verifyLoading}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', fontWeight: 600, textDecoration: 'underline' }}>
                                        Resend OTP
                                    </button>
                                )}
                            </p>
                            <button type='button' className={styles.backBtn}
                                onClick={() => { setVerifyStep(false); setVerifyOtp(''); setVerifyErr(''); clearInterval(resendTimerRef.current); }}>
                                ← Back to Login
                            </button>
                        </div>
                    )}

                    {/* ── LOGIN METHOD TABS ── */}
                    {forgotStep === 'off' && !verifyStep && (
                        <div className={styles.tabs}>
                            {[
                                { key:'otp',        label:'OTP'          },
                                { key:'email-pass', label:'Email'        },
                                { key:'phone-pass', label:'Phone + Pass' },
                            ].map(m => (
                                <button key={m.key} type='button'
                                    className={`${styles.tabBtn} ${method===m.key ? styles.tabBtnActive : ''}`}
                                    onClick={() => { setMethod(m.key); setApiError(''); setStep('phone'); setOtp(''); }}>
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── FORGOT PASSWORD (link-based) ── */}
                    {!verifyStep && forgotStep !== 'off' && (<>

                        {/* Step 1 — enter email or phone */}
                        {forgotStep === 'input' && (<>
                            <p className={styles.forgotSub}>Enter your email or phone number and we'll send you a reset link.</p>
                            <div className={styles.fieldWrap}>
                                <div className={styles.inputRow}>
                                    <span className={styles.inputIconL}><MailIcon /></span>
                                    <input
                                        type='text'
                                        placeholder='Email or phone number'
                                        value={forgotIdentifier}
                                        onChange={e => { setForgotIdentifier(e.target.value); setApiError(''); }}
                                        autoFocus autoComplete='off'
                                    />
                                </div>
                            </div>
                            {apiError && <p className={styles.apiError}>{apiError}</p>}
                            <button type='button' className={styles.btn} onClick={handleForgotSubmit} disabled={loading}>
                                {loading ? <><span className={styles.spin}/>Sending…</> : <><span>Send Reset Link</span><span className={styles.btnArrow}>›</span></>}
                            </button>
                            <button type='button' className={styles.backBtn} onClick={resetForgotFlow}>← Back to Login</button>
                        </>)}

                        {/* Sent confirmation */}
                        {forgotStep === 'sent' && (
                            <div className={styles.forgotDone}>
                                <p className={styles.forgotDoneMsg}>Reset link sent!</p>
                                <p className={styles.forgotDoneSub}>Check your email or SMS for the password reset link.</p>
                                {forgotDevToken && (
                                    <div className={styles.devHint}>
                                        <svg viewBox='0 0 16 16' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><circle cx='8' cy='8' r='6'/><path d='M8 5v3.5M8 11v.5'/></svg>
                                        Dev token: <strong style={{ wordBreak: 'break-all' }}>{forgotDevToken}</strong>
                                    </div>
                                )}
                                <button type='button' className={styles.backBtn} onClick={resetForgotFlow}>← Back to Login</button>
                            </div>
                        )}
                    </>)}

                    {/* ── PASSWORD LOGIN FORMS ── */}
                    {!verifyStep && forgotStep === 'off' && method === 'email-pass' && (
                        <>
                            <div className={styles.fieldWrap}>
                                <div className={styles.inputRow}>
                                    <span className={styles.inputIconL}><MailIcon /></span>
                                    <input type='email' placeholder='Email Address' value={pwdEmail} autoFocus
                                        onChange={e => { setPwdEmail(e.target.value); setApiError(''); }}
                                        autoComplete='email' />
                                </div>
                            </div>
                            <div className={styles.fieldWrap}>
                                <div className={styles.inputRow}>
                                    <span className={styles.inputIconL}><LockIcon /></span>
                                    <input type={showPwd?'text':'password'} placeholder='Password' value={password}
                                        onChange={e => { setPassword(e.target.value); setApiError(''); }}
                                        autoComplete='current-password' />
                                    <button type='button' onClick={() => setShowPwd(v=>!v)} className={styles.inputIconR}>
                                        {showPwd ? <EyeOpen /> : <EyeOff />}
                                    </button>
                                </div>
                            </div>
                            {apiError && <p className={styles.apiError}>{apiError}</p>}
                            <button type='button' className={styles.btn} onClick={handlePasswordLogin} disabled={loading}>
                                {loading ? <><span className={styles.spin}/>Logging in…</> : <><span>LOGIN</span><span className={styles.btnArrow}>›</span></>}
                            </button>
                            <p className={styles.forgotLink}>
                                <button type='button' onClick={() => { setForgotStep('input'); setForgotIdentifier(pwdEmail); setApiError(''); }}>
                                    Forgot Password?
                                </button>
                            </p>
                        </>
                    )}

                    {!verifyStep && forgotStep === 'off' && method === 'phone-pass' && (
                        <>
                            <div className={styles.fieldWrap}>
                                <div className={styles.phoneRow}>
                                    <CountryPicker value={country} onChange={handleCountryChange} />
                                    <div className={styles.pickerSep} />
                                    <input className={styles.phoneInput} type='tel' placeholder='Phone Number' value={pwdPhone} autoFocus
                                        onChange={e => { setPwdPhone(digitsOnly(e.target.value).slice(0,15)); setApiError(''); }} autoComplete='tel' />
                                </div>
                            </div>
                            <div className={styles.fieldWrap}>
                                <div className={styles.inputRow}>
                                    <span className={styles.inputIconL}><LockIcon /></span>
                                    <input type={showPwd?'text':'password'} placeholder='Password' value={password}
                                        onChange={e => { setPassword(e.target.value); setApiError(''); }}
                                        autoComplete='current-password' />
                                    <button type='button' onClick={() => setShowPwd(v=>!v)} className={styles.inputIconR}>
                                        {showPwd ? <EyeOpen /> : <EyeOff />}
                                    </button>
                                </div>
                            </div>
                            {apiError && <p className={styles.apiError}>{apiError}</p>}
                            <button type='button' className={styles.btn} onClick={handlePasswordLogin} disabled={loading}>
                                {loading ? <><span className={styles.spin}/>Logging in…</> : <><span>LOGIN</span><span className={styles.btnArrow}>›</span></>}
                            </button>
                        </>
                    )}

                    {/* ── OTP FLOW (phone + OTP boxes) ── */}
                    {!verifyStep && forgotStep === 'off' && method === 'otp' &&
                    <div className={styles.fieldWrap}>
                        <div className={`${styles.phoneRow} ${touched && localErr ? styles.phoneRowErr : ''} ${step === 'otp' ? styles.phoneRowLocked : ''}`}>
                            <CountryPicker value={country} onChange={handleCountryChange} disabled={step === 'otp'} />
                            <div className={styles.pickerSep} />
                            <input
                                className={styles.phoneInput}
                                type='tel'
                                placeholder='Phone Number'
                                value={local}
                                onChange={handleLocalChange}
                                onBlur={() => { setTouched(true); setLocalErr(validateLocal(local, country)); }}
                                readOnly={step === 'otp'}
                                autoFocus={step === 'phone'}
                                autoComplete='tel'
                            />
                            <svg className={styles.phoneIconRight} viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'>
                                <path d='M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.22 9.82a19.79 19.79 0 01-3.07-8.67A2 2 0 012.13 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z'/>
                            </svg>
                        </div>
                        {touched && localErr && <span className={styles.fieldErr}>{localErr}</span>}
                    </div>}

                    {/* ── OTP BOX ── */}
                    {!verifyStep && forgotStep === 'off' && method === 'otp' && step === 'otp' && (
                        <div className={styles.otpCard}>
                            <div className={styles.otpCardTop}>
                                <div className={styles.otpCardDot} />
                                <h3>Verify OTP</h3>
                            </div>
                            <p className={styles.otpCardSub}>
                                Enter code sent to <span className={styles.phoneHighlight}>+{country.dial} {local}</span>
                            </p>
                            <OtpBoxes key={otpKey} value={otp} onChange={handleOtpChange} count={6} />
                            {devOtp && (
                                <div className={styles.devHint}>
                                    <svg viewBox='0 0 16 16' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><circle cx='8' cy='8' r='6'/><path d='M8 5v3.5M8 11v.5'/></svg>
                                    Dev OTP: <strong>{devOtp}</strong>
                                </div>
                            )}
                        </div>
                    )}

                    {/* OTP error shown only for OTP method; password method shows its own error above */}
                    {!verifyStep && forgotStep === 'off' && method === 'otp' && apiError && <p className={styles.apiError}>{apiError}</p>}

                    {/* ── ACTION BUTTON (OTP flow only) ── */}
                    {!verifyStep && forgotStep === 'off' && method === 'otp' && (
                    step === 'phone' ? (
                        <button type='button' className={styles.btn} onClick={handleSendOtp} disabled={loading}>
                            {loading ? <><span className={styles.spin} />Sending OTP…</> : <><span>SEND OTP</span><span className={styles.btnArrow}>›</span></>}
                        </button>
                    ) : (
                        <button type='button' className={styles.btn} onClick={handleVerifyOtp} disabled={loading || otp.length < 1}>
                            {loading ? <><span className={styles.spin} />Verifying…</> : <><span>LOGIN</span><span className={styles.btnArrow}>›</span></>}
                        </button>
                    ))}

                    {/* ── RESEND (OTP step) ── */}
                    {!verifyStep && forgotStep === 'off' && method === 'otp' && step === 'otp' && (
                        <p className={styles.resendRow}>
                            Didn't receive OTP?{' '}
                            <button
                                type='button'
                                className={`${styles.resendBtn} ${resendTimer > 0 ? styles.resendBtnDisabled : ''}`}
                                onClick={handleResendOtp}
                                disabled={resendTimer > 0 || loading}
                            >
                                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                            </button>
                        </p>
                    )}

                    {/* ── CREATE ACCOUNT (phone step, OTP method) ── */}
                    {!verifyStep && forgotStep === 'off' && method === 'otp' && step === 'phone' && (
                        <>
                            <div className={styles.divider}><span /><small>OR</small><span /></div>
                            <Link to='/signup' className={styles.signupLink}>Create a Free Account</Link>
                        </>
                    )}

                    {/* ── FEATURE BADGES (OTP step) ── */}
                    {!verifyStep && forgotStep === 'off' && method === 'otp' && step === 'otp' && (
                        <div className={styles.features}>
                            <div className={styles.featureBadge}>
                                <span className={styles.featureIcon}><ShieldIcon /></span>
                                <strong>Secure Login</strong>
                                <span>Your data is safe</span>
                            </div>
                            <div className={styles.featureBadge}>
                                <span className={styles.featureIcon}><BoltIcon /></span>
                                <strong>Fast Access</strong>
                                <span>Quick & easy</span>
                            </div>
                            <div className={styles.featureBadge}>
                                <span className={styles.featureIcon}><TrophyIcon /></span>
                                <strong>Play & Win</strong>
                                <span>Compete & enjoy</span>
                            </div>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
};

export default AuthLoginScreen;
