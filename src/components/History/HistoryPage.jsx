import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import GlobalNavbar from '../GlobalNavbar/GlobalNavbar';
import styles from './HistoryPage.module.css';

const SpinIcon = () => (
    <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.4' strokeLinecap='round' stroke='currentColor' className={styles.spin}>
        <path d='M21 12a9 9 0 1 1-6.22-8.56' />
    </svg>
);

const PAGE_LIMIT = 10;
const COLOR_DOT = { red: '#ff4d5e', blue: '#4f83ff', green: '#3ddc84', yellow: '#ffd23f' };
const RESULT_CONFIG = {
    WON: { label: 'WON', className: 'badgeWon' },
    LOST: { label: 'LOST', className: 'badgeLost' },
    FORFEITED: { label: 'EXITED', className: 'badgeForfeited' },
};

const fmtDate = iso => {
    try { return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return '-'; }
};

const abs = n => Math.abs(parseFloat(n || 0)).toFixed(2);

const MatchRow = ({ match }) => {
    const res = RESULT_CONFIG[match.result] || RESULT_CONFIG.LOST;
    const profit = parseFloat(match.profit || 0);
    const isWon = match.result === 'WON';

    return (
        <article className={styles.matchCard}>
            <div className={`${styles.badge} ${styles[res.className]}`}>
                {res.label}
            </div>

            <div className={styles.roomInfo}>
                <div className={styles.roomTopline}>
                    <span className={styles.roomId}>{match.roomId}</span>
                    <span className={styles.roomDate}>{fmtDate(match.playedAt)}</span>
                </div>
                <div className={styles.playerDots}>
                    {match.players.map((p, i) => (
                        <span key={i} title={p.displayName} className={styles.playerDot}>
                            <span className={styles.dot} style={{ background: COLOR_DOT[p.color] || '#888' }} />
                            {p.displayName}
                        </span>
                    ))}
                </div>
            </div>

            <div className={styles.poolCol}>
                <span className={styles.poolLabel}>Pool</span>
                <strong className={styles.poolAmount}>₹{match.totalPool}</strong>
                <span className={styles.entryFee}>Entry ₹{match.entryFee}</span>
            </div>

            <div className={styles.pnlCol}>
                {isWon ? (
                    <>
                        <strong className={`${styles.pnlAmount} ${styles.pnlAmountWon}`}>+₹{match.payout}</strong>
                        <span className={`${styles.pnlSub} ${styles.pnlSubWon}`}>Profit +₹{abs(profit)}</span>
                    </>
                ) : (
                    <>
                        <strong className={`${styles.pnlAmount} ${styles.pnlAmountLost}`}>-₹{match.entryFee}</strong>
                        <span className={`${styles.pnlSub} ${styles.pnlSubLost}`}>Loss -₹{match.entryFee}</span>
                    </>
                )}
            </div>
        </article>
    );
};

const HistoryPage = () => {
    const navigate = useNavigate();
    const [matches, setMatches] = useState([]);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(1);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const abortRef = useRef(null);

    const fetchHistory = useCallback(async (p = 1) => {
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('ludo_token');
            const res = await axios.get(`/api/v1/rooms/history?page=${p}&limit=${PAGE_LIMIT}`, {
                headers: { Authorization: `Bearer ${token}` },
                signal: abortRef.current.signal,
            });
            const d = res.data?.data;
            setMatches(d?.matches || []);
            setTotal(d?.total || 0);
            setPages(d?.totalPages || 1);
            setPage(p);
        } catch (e) {
            if (axios.isCancel(e) || e.name === 'CanceledError') return;
            setError(e.response?.data?.message || 'Failed to load match history.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHistory(1);
        return () => { if (abortRef.current) abortRef.current.abort(); };
    }, [fetchHistory]);

    const won = matches.filter(m => m.result === 'WON').length;
    const lost = matches.filter(m => m.result !== 'WON').length;
    const totalProfit = matches.reduce((acc, m) => acc + parseFloat(m.profit || 0), 0);

    return (
        <div className={styles.page}>
            <GlobalNavbar activePage='history' />

            <main className={styles.body}>
                <section className={styles.titleSection}>
                    <h1>Match History</h1>
                    <p>All completed matches - wins, losses, and payouts</p>
                </section>

                {!loading && matches.length > 0 && (
                    <section className={styles.statsGrid} aria-label='Match summary'>
                        {[
                            { label: 'Total Matches', value: total, color: '#fff' },
                            { label: 'Won', value: won, color: '#4cff88' },
                            { label: 'Lost / Exited', value: lost, color: '#ff6b7a' },
                            {
                                label: 'Net (this page)',
                                value: `${totalProfit >= 0 ? '+' : ''}₹${Math.abs(totalProfit).toFixed(2)}`,
                                color: totalProfit >= 0 ? '#4cff88' : '#ff6b7a',
                            },
                        ].map(s => (
                            <div key={s.label} className={styles.statCard}>
                                <span className={styles.statLabel}>{s.label}</span>
                                <strong className={styles.statValue} style={{ color: s.color }}>{s.value}</strong>
                            </div>
                        ))}
                    </section>
                )}

                {loading ? (
                    <div className={styles.spinWrap}>
                        <SpinIcon />
                    </div>
                ) : error ? (
                    <div className={styles.errorBox}>
                        {error}
                        <button onClick={() => fetchHistory(page)} className={styles.retryBtn}>Retry</button>
                    </div>
                ) : matches.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyEmoji}>🎲</div>
                        <h2 className={styles.emptyTitle}>No matches yet</h2>
                        <p className={styles.emptySub}>Play your first match and it will appear here.</p>
                        <button onClick={() => navigate('/lobby')} className={styles.emptyBtn}>
                            Find a Match
                        </button>
                    </div>
                ) : (
                    <section className={styles.matchList} aria-label='Completed matches'>
                        {matches.map((m, i) => <MatchRow key={m.roomId || i} match={m} />)}
                    </section>
                )}

                {!loading && total > PAGE_LIMIT && (
                    <nav className={styles.pagination} aria-label='History pagination'>
                        <button
                            onClick={() => fetchHistory(page - 1)}
                            disabled={page === 1}
                            className={`${styles.pageBtn} ${styles.pageBtnPrev}`}
                        >
                            ← Previous
                        </button>

                        <span className={styles.pageInfo}>
                            Page <strong>{page}</strong> of <strong>{pages}</strong>
                            <span>({total} matches)</span>
                        </span>

                        <button
                            onClick={() => fetchHistory(page + 1)}
                            disabled={page === pages}
                            className={`${styles.pageBtn} ${styles.pageBtnNext}`}
                        >
                            Next →
                        </button>
                    </nav>
                )}
            </main>
        </div>
    );
};

export default HistoryPage;
