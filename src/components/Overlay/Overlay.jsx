import styles from './Overlay.module.css';
import useKeyPress from '../../hooks/useKeyPress';

const Overlay = ({ children, handleOverlayClose }) => {
    useKeyPress('Escape', handleOverlayClose);

    return (
        <div className={styles.container}>
            <div className={styles.dialog}>
                <button className={styles.closeButton} type='button' aria-label='Close modal' onClick={handleOverlayClose}>
                    <span></span>
                </button>
                {children}
            </div>
        </div>
    );
};
export default Overlay;
