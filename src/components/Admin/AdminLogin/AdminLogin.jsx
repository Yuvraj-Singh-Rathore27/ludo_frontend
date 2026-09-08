import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import styles from './AdminLogin.module.css';

const API = `/api/v1/auth`;

const EyeIcon = ({ open }) =>
    open ? (
        <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'>
            <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/>
            <circle cx='12' cy='12' r='3'/>
        </svg>
    ) : (
        <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'>
            <path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94'/>
            <path d='M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19'/>
            <line x1='1' y1='1' x2='23' y2='23'/>
        </svg>
    );

const ShieldIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.5' stroke='currentColor'>
        <path strokeLinecap='round' strokeLinejoin='round' d='M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z'/>
    </svg>
);

export default function AdminLogin() {
    const navigate = useNavigate();
    const [email,    setEmail]    = useState('');
    const [password, setPassword] = useState('');
    const [showPwd,  setShowPwd]  = useState(false);
    const [error,    setError]    = useState('');
    const [loading,  setLoading]  = useState(false);

    const handleSubmit = async e => {
        e.preventDefault();
        setError('');
        if (!email.trim() || !password)
            return setError('Email and password are required.');

        setLoading(true);
        try {
            const res = await axios.post(
                `${API}/login-password`,
                { identifier: email.trim().toLowerCase(), password },
            );
            const { user, accessToken, refreshToken } = res.data.data;
            localStorage.setItem('admin_user',          JSON.stringify(user));
            localStorage.setItem('admin_token',         accessToken);
            localStorage.setItem('admin_refresh_token', refreshToken || '');
            navigate('/admin/dashboard', { replace: true });
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.left}>
                <div className={styles.brand}>
                    <div className={styles.brandIcon}><ShieldIcon /></div>
                    <h1 className={styles.brandTitle}>Ludo Arena</h1>
                    <p className={styles.brandSub}>Admin Control Panel</p>
                </div>
                <ul className={styles.featureList}>
                    <li><span className={styles.dot} />Manage all registered players</li>
                    <li><span className={styles.dot} />View real-time game statistics</li>
                    <li><span className={styles.dot} />Monitor platform activity</li>
                </ul>
            </div>

            <div className={styles.right}>
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div className={styles.iconWrap}><ShieldIcon /></div>
                        <h2 className={styles.title}>Admin Login</h2>
                        <p className={styles.subtitle}>Sign in to access the admin dashboard</p>
                    </div>

                    <form className={styles.form} onSubmit={handleSubmit} noValidate>
                        <div className={styles.field}>
                            <label className={styles.label}>Email Address</label>
                            <input
                                type='email'
                                className={styles.input}
                                placeholder='admin@gmail.com'
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                autoComplete='email'
                                autoFocus
                            />
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>Password</label>
                            <div className={styles.pwdWrap}>
                                <input
                                    type={showPwd ? 'text' : 'password'}
                                    className={styles.input}
                                    placeholder='Enter password'
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    autoComplete='current-password'
                                />
                                <button
                                    type='button'
                                    className={styles.eyeBtn}
                                    onClick={() => setShowPwd(v => !v)}
                                    tabIndex={-1}
                                >
                                    <EyeIcon open={showPwd} />
                                </button>
                            </div>
                        </div>

                        {error && <p className={styles.error}>{error}</p>}

                        <button
                            type='submit'
                            className={styles.submitBtn}
                            disabled={loading}
                        >
                            {loading ? <span className={styles.spinner} /> : 'Sign In'}
                        </button>
                    </form>

                    <p className={styles.hint}>
                        Default: <code>admin@gmail.com</code> / <code>admin@123</code>
                    </p>
                </div>
            </div>
        </div>
    );
}
