import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link }          from 'react-router-dom';
import { useAuth }                    from '../../../context/AuthContext';
import styles                         from './SignupScreen.module.css';
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
const UserIcon    = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><circle cx='12' cy='8' r='4'/><path d='M4 20c0-4 3.6-7 8-7s8 3 8 7'/></svg>;
const MailIcon    = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><rect x='2' y='4' width='20' height='16' rx='2.5'/><path d='M2 8l10 7 10-7'/></svg>;
const PhoneIcon   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><rect x='5' y='2' width='14' height='20' rx='3'/><circle cx='12' cy='18' r='1' fill='currentColor'/></svg>;
const HandsetIcon = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><path d='M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.22 9.82a19.79 19.79 0 01-3.07-8.67A2 2 0 012.13 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z'/></svg>;
const GroupIcon   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><circle cx='9' cy='7' r='4'/><path d='M3 21c0-4 2.7-6 6-6s6 2 6 6'/><circle cx='17' cy='9' r='3'/><path d='M21 21c0-3-1.8-5-4-5'/></svg>;
const CheckIcon   = () => <svg viewBox='0 0 52 52' fill='none' strokeWidth='2.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><circle cx='26' cy='26' r='23'/><path d='M14 26l9 9 15-17'/></svg>;
const ChevronDown = () => <svg viewBox='0 0 16 16' fill='none' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><path d='M4 6l4 4 4-4'/></svg>;

/* ─── validation rules ──────────────────────────────────── */
const digitsOnly = v => v.replace(/\D/g, '');

const RULES = {
    firstName: v => {
        const s = v.trim();
        if (!s)           return 'First name is required';
        if (s.length < 2) return 'At least 2 characters required';
        if (s.length > 50)return 'Max 50 characters';
        if (!/^[a-zA-Z\s'\-]+$/.test(s)) return 'Letters only — no numbers';
        return '';
    },
    lastName: v => {
        const s = v.trim();
        if (!s)           return 'Last name is required';
        if (s.length < 2) return 'At least 2 characters required';
        if (s.length > 50)return 'Max 50 characters';
        if (!/^[a-zA-Z\s'\-]+$/.test(s)) return 'Letters only — no numbers';
        return '';
    },
    email: v => {
        const s = v.trim();
        if (!s) return 'Email is required';
        if (/\s/.test(s)) return 'No spaces allowed';
        if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(s))
            return 'Enter a valid email — e.g. user@example.com';
        if (s.length > 100) return 'Too long';
        return '';
    },
};

const validatePassword = v => {
    if (!v || v.length < 10)      return 'Password must be at least 10 characters';
    if (!/[a-z]/.test(v))         return 'Password must include a lowercase letter';
    if (!/[A-Z]/.test(v))         return 'Password must include an uppercase letter';
    if (!/[^a-zA-Z0-9]/.test(v))  return 'Password must include a symbol';
    return '';
};

const validatePhone = (local, country) => {
    const n = digitsOnly(local);
    if (!n)          return 'Phone number is required';
    if (n.length < 7) return 'Too short';
    if (n.length > 15)return 'Too long';
    if (country.len && n.length !== country.len)
        return `${country.name} numbers must be ${country.len} digits`;
    return '';
};

const validateAll = (form, country) => {
    const errs = {};
    for (const [k, rule] of Object.entries(RULES)) {
        const msg = rule(form[k] ?? '');
        if (msg) errs[k] = msg;
    }
    const phoneErr = validatePhone(form.phone, country);
    if (phoneErr) errs.phone = phoneErr;
    return errs;
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


/* ─── Field wrapper ─────────────────────────────────────── */
const Field = ({ error, state, right, children }) => (
    <div className={styles.fieldWrap}>
        <div className={`${styles.inputRow}
            ${state === 'err' ? styles.inputRowErr : ''}
            ${state === 'ok'  ? styles.inputRowOk  : ''}`}>
            {children}
            {right && <span className={styles.inputIconR}>{right}</span>}
            {state === 'ok' && (
                <svg className={styles.validTick} viewBox='0 0 20 20' fill='none' aria-hidden='true'>
                    <circle cx='10' cy='10' r='9' stroke='currentColor' strokeWidth='1.8'/>
                    <path d='M6 10l3 3 5-5' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/>
                </svg>
            )}
        </div>
        {error && <span className={styles.fieldErr}>{error}</span>}
    </div>
);

/* ═══════════════════════════════════════════════════════════
   SignupScreen
═══════════════════════════════════════════════════════════ */
const RESEND_COOLDOWN = 60;

const SignupScreen = () => {
    const navigate = useNavigate();
    const { signupInit, validateReferral, verifySignupOtp, resendVerificationOtp } = useAuth();

    const [country,     setCountry]     = useState(COUNTRIES[0]);
    const [form,        setForm]        = useState({ firstName: '', lastName: '', email: '', phone: '' });
    const [password,    setPassword]    = useState('');
    const [confirmPwd,  setConfirmPwd]  = useState('');
    const [showPwd,     setShowPwd]     = useState(false);
    const [showCPwd,    setShowCPwd]    = useState(false);
    const [pwdError,    setPwdError]    = useState('');
    const [errors,      setErrors]      = useState({});
    const [touched,     setTouched]     = useState({});
    const [apiError,    setApiError]    = useState('');
    const [loading,     setLoading]     = useState(false);
    const [success,     setSuccess]     = useState(false);

    /* OTP verification step */
    const [otpStep,       setOtpStep]       = useState(false);
    const [otpMobile,     setOtpMobile]     = useState('');
    const [otpEmail,      setOtpEmail]      = useState('');
    const [otpHint,       setOtpHint]       = useState('');
    const [otp,           setOtp]           = useState('');
    const [otpError,      setOtpError]      = useState('');
    const [otpLoading,    setOtpLoading]    = useState(false);
    const [resendCooldown,setResendCooldown]= useState(RESEND_COOLDOWN);
    const resendTimerRef = useRef(null);

    useEffect(() => () => clearInterval(resendTimerRef.current), []);

    const startResendTimer = () => {
        setResendCooldown(RESEND_COOLDOWN);
        clearInterval(resendTimerRef.current);
        resendTimerRef.current = setInterval(() =>
            setResendCooldown(c => { if (c <= 1) clearInterval(resendTimerRef.current); return Math.max(0, c - 1); }),
        1000);
    };

    const handleVerifyOtp = async () => {
        if (otp.length !== 6) { setOtpError('Enter the 6-digit OTP'); return; }
        setOtpLoading(true); setOtpError('');
        try {
            await verifySignupOtp({ mobile: otpMobile || undefined, email: otpEmail || undefined, otp });
            setSuccess(true);
            setTimeout(() => navigate('/lobby', { replace: true }), 1400);
        } catch (e) {
            setOtpError(e.message || 'Invalid or expired OTP. Please try again.');
        } finally { setOtpLoading(false); }
    };

    const handleResendOtp = async () => {
        if (resendCooldown > 0) return;
        setOtpLoading(true); setOtpError('');
        try {
            const res = await resendVerificationOtp({ mobile: otpMobile || undefined, email: otpEmail || undefined });
            const preview = res.data?.otpPreview;
            if (preview) setOtpHint(preview);
            startResendTimer();
        } catch (e) {
            setOtpError(e.message || 'Could not resend OTP. Please try again.');
        } finally { setOtpLoading(false); }
    };

    /* Referral code state */
    const [referralCode,       setReferralCode]       = useState('');
    const [referralState,      setReferralState]      = useState(''); // '' | 'checking' | 'valid' | 'invalid'
    const [referralPromoter,   setReferralPromoter]   = useState(''); // promoter name if valid
    const referralTimerRef = useRef(null);

    const handleChange = field => e => {
        const value = field === 'phone' ? digitsOnly(e.target.value).slice(0, 15) : e.target.value;
        setForm(p => ({ ...p, [field]: value }));
        if (touched[field]) {
            const err = field === 'phone' ? validatePhone(value, country) : (RULES[field]?.(value) || '');
            setErrors(p => ({ ...p, [field]: err }));
        }
        setApiError('');
    };

    const handleBlur = field => () => {
        setTouched(p => ({ ...p, [field]: true }));
        const err = field === 'phone' ? validatePhone(form[field], country) : (RULES[field]?.(form[field]) || '');
        setErrors(p => ({ ...p, [field]: err }));
    };

    const handleCountryChange = c => {
        setCountry(c);
        if (touched.phone) {
            setErrors(p => ({ ...p, phone: validatePhone(form.phone, c) }));
        }
    };

    const fieldState = field => {
        if (!touched[field]) return '';
        if (errors[field])   return 'err';
        if (field === 'phone' ? digitsOnly(form.phone) : form[field]?.trim()) return 'ok';
        return '';
    };

    /* Debounced referral code validation */
    const handleReferralChange = useCallback(e => {
        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
        setReferralCode(val);
        setReferralState(val ? 'checking' : '');
        setReferralPromoter('');
        clearTimeout(referralTimerRef.current);
        if (!val) return;
        referralTimerRef.current = setTimeout(async () => {
            try {
                const res = await validateReferral(val);
                setReferralState('valid');
                setReferralPromoter(res.data?.promoterName || '');
            } catch {
                setReferralState('invalid');
            }
        }, 500);
    }, [validateReferral]);

    const handleRegister = async () => {
        setApiError('');
        const allTouched = { firstName: true, lastName: true, email: true, phone: true };
        setTouched(allTouched);
        const errs = validateAll(form, country);
        setErrors(errs);
        if (Object.keys(errs).length) return;

        if (referralCode && referralState === 'invalid') {
            setApiError('Invalid referral code — please remove it or enter a valid one.');
            return;
        }
        if (referralCode && referralState === 'checking') {
            setApiError('Referral code is still being validated — please wait.');
            return;
        }

        const pwdErr = validatePassword(password);
        if (pwdErr) { setPwdError(pwdErr); return; }
        if (password !== confirmPwd) {
            setPwdError('Passwords do not match');
            return;
        }
        setPwdError('');

        setLoading(true);
        try {
            const result = await signupInit({
                firstName:    form.firstName.trim(),
                lastName:     form.lastName.trim(),
                email:        form.email.trim(),
                phone:        digitsOnly(form.phone),
                country_code: country.dial,
                referralCode: referralCode || undefined,
                password,
                confirm_password: confirmPwd,
            });
            if (result.data?.pendingVerification) {
                setOtpMobile(result.data.mobile || '');
                setOtpEmail(result.data.email || form.email.trim());
                setOtpHint(result.data.otpPreview || '');
                setOtp('');
                setOtpError('');
                startResendTimer();
                setOtpStep(true);
                return;
            }
            setSuccess(true);
            setTimeout(() => navigate('/lobby', { replace: true }), 1400);
        } catch (e) {
            setApiError(e.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    /* ── Success ── */
    if (success) return (
        <div className={styles.page}>
            <main className={styles.card}>
                <div className={styles.successWrap}>
                    <span className={styles.successIcon}><CheckIcon /></span>
                    <h2>Account Created!</h2>
                    <p>Taking you to the arena…</p>
                </div>
            </main>
        </div>
    );

    /* ── OTP Step ── */
    if (otpStep) {
        const display = otpMobile
            ? `+${otpMobile.slice(0, 2)}****${otpMobile.slice(-4)}`
            : otpEmail
            ? otpEmail.replace(/(.{2}).*(@.*)/, '$1***$2')
            : 'your contact';

        return (
            <div className={styles.page}>
                <main className={styles.card}>
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
                        <div className={styles.titleSection}>
                            <div className={styles.titleRow}>
                                <span className={styles.tLineL} />
                                <span className={styles.tDiamond}>◆</span>
                                <h1 className={styles.titleText}>Verify Account</h1>
                                <span className={styles.tDiamond}>◆</span>
                                <span className={styles.tLineR} />
                            </div>
                        </div>

                        <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                            We sent a 6-digit code to <strong style={{ color: '#e2e8f0' }}>{display}</strong>
                        </p>

                        {otpHint && (
                            <div className={styles.devHint}>
                                <svg viewBox='0 0 16 16' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round'><circle cx='8' cy='8' r='6'/><path d='M8 5v3.5M8 11v.5'/></svg>
                                Dev OTP: <strong>{otpHint}</strong>
                            </div>
                        )}

                        <div className={styles.fieldWrap}>
                            <div className={`${styles.inputRow} ${otpError ? styles.inputRowErr : ''}`}>
                                <input
                                    type='text'
                                    inputMode='numeric'
                                    maxLength={6}
                                    placeholder='Enter 6-digit OTP'
                                    value={otp}
                                    onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }}
                                    autoFocus
                                    autoComplete='one-time-code'
                                    style={{ textAlign: 'center', letterSpacing: '0.4em', fontSize: '1.2rem', fontWeight: 700 }}
                                />
                            </div>
                            {otpError && <span className={styles.fieldErr}>{otpError}</span>}
                        </div>

                        <button type='button' className={styles.btn} onClick={handleVerifyOtp} disabled={otpLoading || otp.length < 6}>
                            {otpLoading
                                ? <><span className={styles.spin} />Verifying…</>
                                : <><span>VERIFY & CREATE ACCOUNT</span><span className={styles.btnArrow}>›</span></>
                            }
                        </button>

                        <p className={styles.resendRow}>
                            Didn't receive it?{' '}
                            <button
                                type='button'
                                className={`${styles.resendBtn} ${resendCooldown > 0 ? styles.resendBtnDisabled : ''}`}
                                onClick={handleResendOtp}
                                disabled={resendCooldown > 0 || otpLoading}
                            >
                                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                            </button>
                        </p>

                        <button type='button'
                            onClick={() => { setOtpStep(false); clearInterval(resendTimerRef.current); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', display: 'block', margin: '0.5rem auto 0', padding: '4px 0' }}>
                            ← Back to signup
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className={styles.page}>
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
                            <h1 className={styles.titleText}>Create Your Account</h1>
                            <span className={styles.tDiamond}>◆</span>
                            <span className={styles.tLineR} />
                        </div>
                    </div>

                    {/* ── FORM FIELDS ── */}
                    <div className={styles.row}>
                        <Field error={errors.firstName} state={fieldState('firstName')} right={<GroupIcon />}>
                            <span className={styles.inputIconL}><UserIcon /></span>
                            <input type='text' placeholder='First Name'
                                value={form.firstName}
                                onChange={handleChange('firstName')}
                                onBlur={handleBlur('firstName')}
                                autoComplete='given-name'
                                autoFocus
                            />
                        </Field>
                        <Field error={errors.lastName} state={fieldState('lastName')} right={<GroupIcon />}>
                            <span className={styles.inputIconL}><UserIcon /></span>
                            <input type='text' placeholder='Last Name'
                                value={form.lastName}
                                onChange={handleChange('lastName')}
                                onBlur={handleBlur('lastName')}
                                autoComplete='family-name'
                            />
                        </Field>
                    </div>

                    <Field error={errors.email} state={fieldState('email')}>
                        <span className={styles.inputIconL}><MailIcon /></span>
                        <input type='email' placeholder='Email Address'
                            value={form.email}
                            onChange={handleChange('email')}
                            onBlur={handleBlur('email')}
                            autoComplete='email'
                        />
                    </Field>

                    {/* Phone field with country picker */}
                    <div className={styles.fieldWrap}>
                        <div className={`${styles.phoneRow} ${touched.phone && errors.phone ? styles.phoneRowErr : ''}`}>
                            <CountryPicker value={country} onChange={handleCountryChange} />
                            <div className={styles.pickerSep} />
                            <input
                                className={styles.phoneInput}
                                type='tel'
                                placeholder='Phone Number'
                                value={form.phone}
                                onChange={handleChange('phone')}
                                onBlur={handleBlur('phone')}
                                autoComplete='tel'
                            />
                            <span className={styles.phoneIconR}><HandsetIcon /></span>
                        </div>
                        {touched.phone && errors.phone && (
                            <span className={styles.fieldErr}>{errors.phone}</span>
                        )}
                    </div>

                    {/* ── PASSWORD FIELDS ── */}
                    <div className={styles.row}>
                        <div className={styles.fieldWrap}>
                            <div className={`${styles.inputRow} ${pwdError && !confirmPwd ? styles.inputRowErr : ''}`}>
                                <span className={styles.inputIconL}>
                                    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><rect x='3' y='11' width='18' height='11' rx='2'/><path d='M7 11V7a5 5 0 0 1 10 0v4'/></svg>
                                </span>
                                <input
                                    type={showPwd ? 'text' : 'password'}
                                    placeholder='Password (min 10)'
                                    value={password}
                                    onChange={e => { setPassword(e.target.value); setPwdError(''); }}
                                    autoComplete='new-password'
                                />
                                <button type='button' onClick={() => setShowPwd(v => !v)} className={styles.inputIconR}>
                                    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'>
                                        {showPwd ? <><path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/><circle cx='12' cy='12' r='3'/></> : <><path d='M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58'/><path d='M9.88 4.24A10.72 10.72 0 0 1 12 4c7 0 11 8 11 8a18.2 18.2 0 0 1-3.18 4.24'/><path d='M6.61 6.61A18.7 18.7 0 0 0 1 12s4 8 11 8a10.8 10.8 0 0 0 5.39-1.39'/><line x1='3' y1='3' x2='21' y2='21'/></>}
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className={styles.fieldWrap}>
                            <div className={`${styles.inputRow} ${pwdError ? styles.inputRowErr : ''}`}>
                                <span className={styles.inputIconL}>
                                    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><rect x='3' y='11' width='18' height='11' rx='2'/><path d='M7 11V7a5 5 0 0 1 10 0v4'/></svg>
                                </span>
                                <input
                                    type={showCPwd ? 'text' : 'password'}
                                    placeholder='Confirm Pwd'
                                    value={confirmPwd}
                                    onChange={e => { setConfirmPwd(e.target.value); setPwdError(''); }}
                                    autoComplete='new-password'
                                />
                                <button type='button' onClick={() => setShowCPwd(v => !v)} className={styles.inputIconR}>
                                    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'>
                                        {showCPwd ? <><path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/><circle cx='12' cy='12' r='3'/></> : <><path d='M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58'/><path d='M9.88 4.24A10.72 10.72 0 0 1 12 4c7 0 11 8 11 8a18.2 18.2 0 0 1-3.18 4.24'/><path d='M6.61 6.61A18.7 18.7 0 0 0 1 12s4 8 11 8a10.8 10.8 0 0 0 5.39-1.39'/><line x1='3' y1='3' x2='21' y2='21'/></>}
                                    </svg>
                                </button>
                            </div>
                            {pwdError && <span className={styles.fieldErr}>{pwdError}</span>}
                        </div>
                    </div>

                    {/* ── REFERRAL CODE (optional) ── */}
                    <div className={styles.fieldWrap}>
                        <div className={`${styles.inputRow} ${
                            referralState === 'invalid' ? styles.inputRowErr :
                            referralState === 'valid'   ? styles.inputRowOk  : ''
                        }`}>
                            <span className={styles.inputIconL}>
                                <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'>
                                    <path d='M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z'/>
                                </svg>
                            </span>
                            <input
                                type='text'
                                placeholder='REFERRAL CODE (OPTIONAL)'
                                value={referralCode}
                                onChange={handleReferralChange}
                                maxLength={8}
                                style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
                                autoComplete='off'
                            />
                            {referralState === 'checking' && (
                                <span className={styles.inputIconR} style={{ color: '#f59e0b' }}>
                                    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' stroke='currentColor' style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }}>
                                        <circle cx='12' cy='12' r='10' strokeOpacity='.2'/>
                                        <path d='M12 2a10 10 0 0 1 10 10'/>
                                    </svg>
                                </span>
                            )}
                            {referralState === 'valid' && (
                                <svg className={styles.validTick} viewBox='0 0 20 20' fill='none' aria-hidden='true'>
                                    <circle cx='10' cy='10' r='9' stroke='currentColor' strokeWidth='1.8'/>
                                    <path d='M6 10l3 3 5-5' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/>
                                </svg>
                            )}
                        </div>
                        {referralState === 'valid' && referralPromoter && (
                            <span className={styles.fieldErr} style={{ color: '#10b981' }}>
                                ✓ Referred by {referralPromoter}
                            </span>
                        )}
                        {referralState === 'invalid' && (
                            <span className={styles.fieldErr}>Invalid referral code</span>
                        )}
                    </div>

                    {apiError && <p className={styles.apiError}>{apiError}</p>}

                    {/* ── ACTION BUTTON ── */}
                    <button type='button' className={styles.btn} onClick={handleRegister} disabled={loading}>
                        {loading
                            ? <><span className={styles.spin} />Creating account…</>
                            : <><span>CREATE ACCOUNT</span><span className={styles.btnArrow}>›</span></>
                        }
                    </button>

                    {/* ── DIVIDER + LOGIN LINK ── */}
                    <div className={styles.divider}><span /><small>OR</small><span /></div>
                    <p className={styles.switchLink}>
                        Already have an account? <Link to='/auth/login'>Login</Link>
                    </p>

                </div>
            </main>
        </div>
    );
};

export default SignupScreen;
