import ReactLoading from 'react-loading';
import styles from './GlobalLoader.module.css';

const GlobalLoader = ({ title = 'Loading Ludo Arena', message = 'Getting your board ready...' }) => {
    return (
        <main className={styles.container} role='status' aria-live='polite'>
            <div className={styles.card}>
                <div className={styles.mark}>L</div>
                <ReactLoading type='spinningBubbles' color='#ffd670' height={52} width={52} />
                <div className={styles.copy}>
                    <h1>{title}</h1>
                    <p>{message}</p>
                </div>
                <div className={styles.boardLine} aria-hidden='true'>
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </main>
    );
};

export default GlobalLoader;
