import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './BackToHome.module.css';

// Returns to the previous Ludo screen. React Router numbers its own history entries
// (history.state.idx, 0 for the first page this app loaded), so idx > 0 means the
// previous entry is a Ludo screen and a real "back" goes there — the same step the
// device/browser back button takes. Only when there is no earlier Ludo screen (the
// page was opened directly, e.g. from the DABBA app) does it replace this entry with
// Ludo Home instead, so it never pushes a loop of Home/Profile/Home entries that made
// device back bounce between them.
export const goBackToLudoHome = navigate => {
    const idx = window.history.state?.idx;
    if (typeof idx === 'number' && idx > 0) navigate(-1);
    else navigate('/lobby', { replace: true });
};

const ArrowLeftIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor' aria-hidden='true'>
        <path d='M19 12H5M12 5l-7 7 7 7' />
    </svg>
);

const BackToHome = ({ label = 'Back to Ludo Home', className = '' }) => {
    const navigate = useNavigate();
    return (
        <button type='button' className={`${styles.backBtn} ${className}`} onClick={() => goBackToLudoHome(navigate)}>
            <ArrowLeftIcon />
            {label}
        </button>
    );
};

export default BackToHome;
