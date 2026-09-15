import styles from './Overlay.module.css';
import useKeyPress from '../../hooks/useKeyPress';

const Overlay = ({ children, handleOverlayClose }) => {
    useKeyPress('Escape', handleOverlayClose);

    return (
        <div className={styles.container}>
            <div className={styles.dialog}>
                {/* Only offer a close button when there is something for it to do — the
                    exit and result dialogs pass no handler, and a visible ✕ that ignores
                    taps reads as the app lagging. */}
                {typeof handleOverlayClose === 'function' ? (
                    <button className={styles.closeButton} type='button' aria-label='Close modal' onClick={handleOverlayClose}>
                        <span></span>
                    </button>
                ) : null}
                {children}
            </div>
        </div>
    );
};
export default Overlay;
