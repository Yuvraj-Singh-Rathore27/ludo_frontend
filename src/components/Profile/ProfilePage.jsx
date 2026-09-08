import { useState, useEffect } from 'react';
import { useNavigate }         from 'react-router-dom';
import { useAuth }             from '../../context/AuthContext';
import styles                  from './ProfilePage.module.css';

const ArrowLeftIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'>
        <path d='M19 12H5M12 5l-7 7 7 7'/>
    </svg>
);
const CheckIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'>
        <path d='M22 11.08V12a10 10 0 1 1-5.93-9.14'/><polyline points='22 4 12 14.01 9 11.01'/>
    </svg>
);
const UserIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'>
        <circle cx='12' cy='8' r='4'/><path d='M4 20c0-4 3.6-7 8-7s8 3 8 7'/>
    </svg>
);
const MailIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'>
        <rect x='2' y='4' width='20' height='16' rx='2.5'/><path d='M2 8l10 7 10-7'/>
    </svg>
);
const PhoneIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'>
        <rect x='5' y='2' width='14' height='20' rx='3'/><circle cx='12' cy='18' r='1' fill='currentColor'/>
    </svg>
);
const LockIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.9' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'>
        <rect x='3' y='11' width='18' height='11' rx='2'/><path d='M7 11V7a5 5 0 0 1 10 0v4'/>
    </svg>
);

/* Derive initials — works for both old {firstName,lastName} and new {displayName} user shapes */
const getInitials = user => {
    if (!user) return '';
    if (user.displayName) {
        const parts = user.displayName.trim().split(/\s+/);
        return (parts[0]?.[0] || '') + (parts[1]?.[0] || '').toUpperCase();
    }
    return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
};

/* ─── Field ─────────────────────────────────────────────── */
const Field = ({ label, icon, error, hint, disabled, suffix, children }) => (
    <div className={styles.fieldGroup}>
        <label className={styles.label}>{label}</label>
        <div className={`${styles.inputWrap} ${error ? styles.inputWrapErr : ''} ${disabled ? styles.inputWrapDisabled : ''}`}>
            <span className={styles.inputIcon}>{icon}</span>
            {children}
            {suffix && <span className={styles.lockIcon}>{suffix}</span>}
        </div>
        {error && <span className={styles.fieldErr}>{error}</span>}
        {hint && !error && <span className={styles.fieldHint}>{hint}</span>}
    </div>
);

/* ═══════════════════════════════════════════════════════════
   ProfilePage
═══════════════════════════════════════════════════════════ */
const ProfilePage = () => {
    const navigate = useNavigate();
    const { authUser, updateProfile } = useAuth();

    /* Support both old {firstName,lastName} and new {displayName} user shapes */
    const [form,    setForm]    = useState({ firstName: '', lastName: '', email: '' });
    const [errors,  setErrors]  = useState({});
    const [touched, setTouched] = useState({});
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');
    const [apiErr,  setApiErr]  = useState('');

    useEffect(() => {
        if (authUser) {
            /* New backend user shape: { displayName, mobile, email } */
            let firstName = authUser.firstName || '';
            let lastName  = authUser.lastName  || '';
            if (!firstName && authUser.displayName) {
                const parts = authUser.displayName.trim().split(/\s+/);
                firstName = parts[0] || '';
                lastName  = parts.slice(1).join(' ') || '';
            }
            setForm({
                firstName,
                lastName,
                email: authUser.email || '',
            });
        }
    }, [authUser]);

    const validate = (name, value) => {
        const v = (value || '').trim();
        if (name === 'firstName' || name === 'lastName') {
            if (!v)           return `${name === 'firstName' ? 'First' : 'Last'} name is required`;
            if (v.length < 2) return 'Minimum 2 characters';
            if (!/^[a-zA-Z\s'\-]+$/.test(v)) return 'Letters only';
        }
        if (name === 'email') {
            if (!v) return 'Email is required';
            if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(v))
                return 'Enter a valid email address';
        }
        return '';
    };

    const handleChange = e => {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
        setApiErr(''); setSuccess('');
        if (touched[name]) setErrors(er => ({ ...er, [name]: validate(name, value) }));
    };

    const handleBlur = e => {
        const { name, value } = e.target;
        setTouched(t => ({ ...t, [name]: true }));
        setErrors(er => ({ ...er, [name]: validate(name, value) }));
    };

    const handleSubmit = async e => {
        e.preventDefault();
        setApiErr(''); setSuccess('');
        const allTouched = { firstName: true, lastName: true, email: true };
        setTouched(allTouched);
        const newErrors = {};
        ['firstName', 'lastName', 'email'].forEach(k => {
            const err = validate(k, form[k]);
            if (err) newErrors[k] = err;
        });
        setErrors(newErrors);
        if (Object.keys(newErrors).length) return;

        setLoading(true);
        try {
            await updateProfile(form);
            setSuccess('Profile updated successfully!');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            if (err.data?.errors) setErrors(err.data.errors);
            else setApiErr(err.message || 'Update failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const initials = getInitials(authUser);

    return (
        <div className={styles.page}>
            <div className={styles.card}>

                {/* ── Gold/red accent line at top ── */}
                <div className={styles.accentBar} />

                {/* ── HEADER: back + avatar ── */}
                <div className={styles.cardHeader}>
                    <button type='button' className={styles.backBtn} onClick={() => navigate('/lobby')}>
                        <ArrowLeftIcon />
                        Back to Lobby
                    </button>

                    <div className={styles.avatarRow}>
                        <div className={styles.avatar}>
                            {initials || <UserIcon />}
                        </div>
                        <div className={styles.avatarMeta}>
                            <h2 className={styles.avatarName}>
                                {authUser ? (authUser.displayName || `${authUser.firstName || ''} ${authUser.lastName || ''}`.trim() || 'Player') : 'Player'}
                            </h2>
                            <span className={styles.avatarBadge}>
                                {authUser?.roles?.includes('admin') || authUser?.user_type === 'a' ? '⚡ Administrator' : '🎮 Player'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── BODY: form ── */}
                <div className={styles.cardBody}>

                    <div className={styles.sectionLabel}>
                        <span>Edit Profile</span>
                    </div>

                    {success && (
                        <div className={styles.successBanner}>
                            <CheckIcon />
                            <span>{success}</span>
                        </div>
                    )}

                    {apiErr && <p className={styles.apiError}>{apiErr}</p>}

                    <form onSubmit={handleSubmit} noValidate className={styles.form}>

                        <div className={styles.row}>
                            <Field
                                label='First Name'
                                icon={<UserIcon />}
                                error={touched.firstName && errors.firstName}
                            >
                                <input
                                    name='firstName'
                                    type='text'
                                    placeholder='First name'
                                    value={form.firstName}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    autoComplete='given-name'
                                />
                            </Field>

                            <Field
                                label='Last Name'
                                icon={<UserIcon />}
                                error={touched.lastName && errors.lastName}
                            >
                                <input
                                    name='lastName'
                                    type='text'
                                    placeholder='Last name'
                                    value={form.lastName}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    autoComplete='family-name'
                                />
                            </Field>
                        </div>

                        <Field
                            label='Email Address'
                            icon={<MailIcon />}
                            error={touched.email && errors.email}
                        >
                            <input
                                name='email'
                                type='email'
                                placeholder='your@email.com'
                                value={form.email}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                autoComplete='email'
                            />
                        </Field>

                        {/* Phone — locked, cannot be edited */}
                        <Field
                            label='Phone Number'
                            icon={<PhoneIcon />}
                            hint='Phone number cannot be changed'
                            disabled
                            suffix={<LockIcon />}
                        >
                            <input
                                type='tel'
                                value={authUser?.mobile || authUser?.phone || ''}
                                readOnly
                                disabled
                                tabIndex={-1}
                            />
                        </Field>

                        <button type='submit' className={styles.saveBtn} disabled={loading}>
                            {loading
                                ? <><span className={styles.spin} />Saving changes…</>
                                : <><span>SAVE CHANGES</span><span className={styles.btnArrow}>›</span></>
                            }
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
