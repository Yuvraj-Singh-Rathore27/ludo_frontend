import React, { useMemo } from 'react';
import styles from './AnimatedOverlay.module.css';
// TimerAnimation.js is no longer imported — it injected a clip-path keyframe
// animation at module load time which blocked the main thread and caused
// per-frame CPU repaints. Replaced below with an SVG stroke-dashoffset approach
// that runs entirely on the GPU compositor thread.

const TIMER_SECONDS = 15;
const RADIUS = 18; // matches stroke-dasharray: 113.1 = 2 * π * 18 in the CSS

const AnimatedOverlay = ({ time }) => {
    // Compute how many seconds have already elapsed so we can seek the animation
    // to the correct playback position (negative animationDelay = skip into animation).
    const animationDelay = useMemo(() => {
        if (!time) return '0s';
        const remainingMs = time - Date.now();
        const remainingSecs = Math.max(0, Math.min(TIMER_SECONDS, remainingMs / 1000));
        const elapsed = TIMER_SECONDS - remainingSecs;
        return `-${elapsed}s`;
    }, [time]);

    return (
        <div className={styles.wrapper} data-testid='animated-overlay' aria-hidden='true'>
            <svg className={styles.svg} viewBox='0 0 44 44' width='44' height='44'>
                {/* Static background track */}
                <circle
                    className={styles.track}
                    cx='22' cy='22' r={RADIUS}
                />
                {/* Draining progress arc — animates stroke-dashoffset on the compositor */}
                <circle
                    className={styles.progress}
                    cx='22' cy='22' r={RADIUS}
                    style={{ animationDelay }}
                />
            </svg>
        </div>
    );
};

export default React.memo(AnimatedOverlay);
