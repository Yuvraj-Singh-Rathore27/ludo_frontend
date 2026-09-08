import ReactLoading from 'react-loading';
import styles from './withLoading.module.css';

const withLoading = Component => {
    return function WithLoading({ isLoading, ...props }) {
        if (!isLoading) {
            return <Component {...props} />;
        }
        return (
            <div className={styles.loadingPanel} role='status' aria-live='polite'>
                <div className={styles.spinnerWrap}>
                    <ReactLoading type='spinningBubbles' color='#ffd670' height={44} width={44} />
                </div>
                <div className={styles.loadingCopy}>
                    <span>Loading servers</span>
                    <p>Finding active Ludo rooms...</p>
                </div>
                <div className={styles.skeletonRows} aria-hidden='true'>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        );
    };
};

export default withLoading;
