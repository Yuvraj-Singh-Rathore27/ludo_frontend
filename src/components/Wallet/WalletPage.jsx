import { useState, useEffect, useRef } from 'react';
import { useNavigate }         from 'react-router-dom';
import { useWallet }           from '../../context/WalletContext';
import GlobalNavbar            from '../GlobalNavbar/GlobalNavbar';
import styles                  from './WalletPage.module.css';
import logoDice                from '../../images/pages/ludi-profile.webp';
import heroBoard               from '../../images/pages/login-ludo-hero-clean.webp';

/* ─── Icons ─────────────────────────────────────────────── */
const ArrowDown  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><path d='M12 5v14M5 12l7 7 7-7'/></svg>;
const ArrowUp    = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><path d='M12 19V5M5 12l7-7 7 7'/></svg>;
const ClockIcon  = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><circle cx='12' cy='12' r='9'/><path d='M12 7v5l3 3'/></svg>;
const SpinIcon   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2.4' strokeLinecap='round' stroke='currentColor' className={styles.spin}><path d='M21 12a9 9 0 1 1-6.22-8.56'/></svg>;
const DepositIcon = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><rect x='2' y='5' width='20' height='14' rx='2'/><path d='M2 10h20'/><path d='M12 14v3M9 16l3 3 3-3'/></svg>;
const WithdrawIcon = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><rect x='2' y='5' width='20' height='14' rx='2'/><path d='M2 10h20'/><path d='M12 17v-3M9 13l3-3 3 3'/></svg>;
const TrophyIcon = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><path d='M8 4h8v5c0 3-1.7 5-4 5s-4-2-4-5V4z'/><path d='M8 6H4v2c0 2.2 1.7 4 4 4M16 6h4v2c0 2.2-1.7 4-4 4'/><path d='M12 14v4M8 20h8M10 17h4'/></svg>;
const LockIcon   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><rect x='3' y='11' width='18' height='11' rx='2'/><path d='M7 11V7a5 5 0 0 1 10 0v4'/></svg>;
const GiftIcon   = () => <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><rect x='3' y='8' width='18' height='14' rx='2'/><path d='M3 13h18M12 8v13'/><path d='M12 8C12 8 9 5 7 5a2 2 0 0 0 0 4c2 0 5-1 5-1z'/><path d='M12 8C12 8 15 5 17 5a2 2 0 0 1 0 4c-2 0-5-1-5-1z'/></svg>;

/* ─── Helpers ────────────────────────────────────────────── */
const fmt = n => {
    const num = parseFloat(n);
    return isNaN(num) ? '0.00' : num.toFixed(2);
};

const fmtDate = iso => {
    try { return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return iso || '—'; }
};

const getBalanceValue = value =>
    value?.totalBalance ?? value?.availableBalance ?? value?.balance ?? value ?? 0;

const hasAmount = value => value !== undefined && value !== null && value !== '';

const QUICK_AMOUNTS = [100, 200, 500, 1000];

/* ─── TxRow ──────────────────────────────────────────────── */
const DEBIT_TYPES = new Set(['GAME_ENTRY', 'WITHDRAWAL', 'ADMIN_DEBIT']);

const TxRow = ({ tx }) => {
    const isCredit = !DEBIT_TYPES.has(tx.type);
    const afterBalance = tx.afterBalance ?? tx.balanceAfter ?? tx.totalBalance;
    const beforeBalance = tx.beforeBalance ?? tx.balanceBefore;

    return (
        <div className={styles.txRow}>
            <span className={`${styles.txIcon} ${isCredit ? styles.txIconCredit : styles.txIconDebit}`}>
                {isCredit ? <ArrowDown /> : <ArrowUp />}
            </span>
            <div className={styles.txMeta}>
                <span className={styles.txLabel}>{tx.description || tx.type || 'Transaction'}</span>
                <span className={styles.txDate}>{fmtDate(tx.createdAt || tx.date)}</span>
            </div>
            <div className={styles.txMoney}>
                <span className={`${styles.txAmount} ${isCredit ? styles.txAmountCredit : styles.txAmountDebit}`}>
                    {isCredit ? '+' : '-'}₹{fmt(Math.abs(tx.amount))}
                </span>
                {hasAmount(afterBalance) && (
                    <span className={styles.txBalance}>₹{fmt(afterBalance)}</span>
                )}
                {hasAmount(beforeBalance) && (
                    <span className={styles.txBefore}>Before ₹{fmt(beforeBalance)}</span>
                )}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════
   WalletPage
═══════════════════════════════════════════════════════════ */
const TABS           = ['deposit', 'withdraw', 'history'];
const PAGE_SIZE      = 6;
const PAGINATE_AFTER = 6;

const WalletPage = () => {
    const navigate = useNavigate();
    const { balance, history, balLoading, histLoading, fetchHistory, deposit, withdraw } = useWallet();

    const [tab,      setTab]      = useState('deposit');
    const [amount,   setAmount]   = useState('');
    const [gateway,  setGateway]  = useState('');
    const [orderId,  setOrderId]  = useState('');
    const [upiId,    setUpiId]    = useState('');
    const [loading,  setLoading]  = useState(false);
    const [msg,      setMsg]      = useState({ text: '', type: '' });
    const [histPage, setHistPage] = useState(1);

    const flashTimerRef = useRef(null);
    const clearForm = () => { setAmount(''); setGateway(''); setOrderId(''); setUpiId(''); };
    const flash     = (text, type) => {
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        setMsg({ text, type });
        flashTimerRef.current = setTimeout(() => setMsg({ text: '', type: '' }), 3500);
    };

    useEffect(() => () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current); }, []);

    useEffect(() => {
        if (tab === 'history')
            fetchHistory().catch(e => flash(e.message || 'Failed to load history', 'err'));
    }, [tab, fetchHistory]); // eslint-disable-line

    const handleDeposit = async () => {
        if (!amount || isNaN(amount) || +amount <= 0) return flash('Please enter a valid amount.', 'err');
        if (!gateway.trim()) return flash('Please enter the payment gateway.', 'err');
        if (!orderId.trim()) return flash('Please enter the gateway order ID.', 'err');
        setLoading(true);
        try {
            const res = await deposit({ amount, paymentGateway: gateway.trim(), gatewayOrderId: orderId.trim() });
            flash(`₹${fmt(amount)} added successfully. Balance: ₹${fmt(getBalanceValue(res.balance))}.`, 'ok');
            clearForm();
        } catch (e) { flash(e.message || 'Deposit failed.', 'err'); }
        finally { setLoading(false); }
    };

    const handleWithdraw = async () => {
        if (!amount || isNaN(amount) || +amount <= 0) return flash('Please enter a valid amount.', 'err');
        if (!upiId.trim()) return flash('Please enter your UPI ID.', 'err');
        setLoading(true);
        try {
            const res = await withdraw({ amount, paymentMethod: 'UPI', paymentDetails: { upiId: upiId.trim() } });
            flash(`Withdrawal submitted. Balance: ₹${fmt(getBalanceValue(res.balance))}.`, 'ok');
            clearForm();
        } catch (e) { flash(e.message || 'Withdrawal failed.', 'err'); }
        finally { setLoading(false); }
    };

    const depositBal      = parseFloat(balance?.depositBalance   ?? 0);
    const winningBal      = parseFloat(balance?.winningBalance   ?? 0);
    const bonusBal        = parseFloat(balance?.bonusBalance     ?? 0);
    const lockedBal       = parseFloat(balance?.lockedBalance    ?? 0);
    const totalBal        = parseFloat(getBalanceValue(balance)  ?? 0);
    const totalDeposited  = parseFloat(balance?.totalDeposited   ?? 0);
    const totalWithdrawn  = parseFloat(balance?.totalWithdrawn   ?? 0);
    const totalWon        = parseFloat(balance?.totalWon         ?? 0);

    return (
        <div className={styles.pageRoot}>
            <GlobalNavbar activePage='wallet' />

            <div className={styles.page}>
                <div className={styles.shell}>

                    {/* ── LEFT VISUAL PANEL ── */}
                    <aside className={styles.visualPanel} aria-hidden='true'>
                        <img src={heroBoard} alt='' className={styles.visualBg} />
                        <div className={styles.visualShade} />
                        <div className={styles.visualContent}>
                            <div className={styles.visualLogo}>
                                <img src={logoDice} alt='' />
                            </div>
                            <p className={styles.visualKicker}>Secure Arena Wallet</p>
                            <h2 className={styles.visualHeading}>Play ready.<br />Cash ready.</h2>
                            <div className={styles.visualStats}>
                                <div className={styles.visualStat}>
                                    <span>Deposited</span>
                                    <strong>₹{fmt(totalDeposited)}</strong>
                                </div>
                                <div className={styles.visualStat}>
                                    <span>Withdrawn</span>
                                    <strong>₹{fmt(totalWithdrawn)}</strong>
                                </div>
                                <div className={styles.visualStat}>
                                    <span>Won</span>
                                    <strong>₹{fmt(totalWon)}</strong>
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* ── RIGHT CARD ── */}
                    <div className={styles.card}>

                        {/* gradient top bar */}
                        <div className={styles.cardTopBar} />

                        <div className={styles.cardBody}>

                            {/* ── BALANCE HERO ── */}
                            <div className={styles.balanceHero}>
                                <div className={styles.balanceHeroLeft}>
                                    <p className={styles.balanceLabel}>Total Balance</p>
                                    <p className={styles.balanceAmt}>
                                        {balLoading
                                            ? <SpinIcon />
                                            : <><span className={styles.balanceCurrency}>₹</span><span>{fmt(totalBal)}</span></>
                                        }
                                    </p>
                                </div>
                                <button
                                    className={styles.addMoneyBtn}
                                    type='button'
                                    onClick={() => setTab('deposit')}
                                >
                                    + Add Money
                                </button>
                            </div>

                            {/* ── BALANCE BREAKDOWN ── */}
                            <div className={styles.balanceGrid}>
                                <div className={`${styles.balCard} ${styles.balCardDeposit}`}>
                                    <span className={styles.balCardIcon}><DepositIcon /></span>
                                    <span className={styles.balCardLabel}>Deposit</span>
                                    <span className={styles.balCardAmt}>₹{fmt(depositBal)}</span>
                                </div>
                                <div className={`${styles.balCard} ${styles.balCardWin}`}>
                                    <span className={styles.balCardIcon}><TrophyIcon /></span>
                                    <span className={styles.balCardLabel}>Winnings</span>
                                    <span className={styles.balCardAmt}>₹{fmt(winningBal)}</span>
                                </div>
                                <div className={`${styles.balCard} ${styles.balCardBonus}`}>
                                    <span className={styles.balCardIcon}><GiftIcon /></span>
                                    <span className={styles.balCardLabel}>Bonus</span>
                                    <span className={styles.balCardAmt}>₹{fmt(bonusBal)}</span>
                                </div>
                                <div className={`${styles.balCard} ${styles.balCardLocked}`}>
                                    <span className={styles.balCardIcon}><LockIcon /></span>
                                    <span className={styles.balCardLabel}>Locked</span>
                                    <span className={styles.balCardAmt}>₹{fmt(lockedBal)}</span>
                                </div>
                            </div>

                            {/* ── LIFETIME STATS ── */}
                            <div className={styles.lifeStats}>
                                <div className={styles.lifeStat}>
                                    <span className={styles.lifeStatLabel}>Total Deposited</span>
                                    <span className={styles.lifeStatAmt}>₹{fmt(totalDeposited)}</span>
                                </div>
                                <div className={styles.lifeStatDivider} />
                                <div className={styles.lifeStat}>
                                    <span className={styles.lifeStatLabel}>Total Withdrawn</span>
                                    <span className={`${styles.lifeStatAmt} ${styles.lifeStatAmtRed}`}>₹{fmt(totalWithdrawn)}</span>
                                </div>
                                <div className={styles.lifeStatDivider} />
                                <div className={styles.lifeStat}>
                                    <span className={styles.lifeStatLabel}>Total Won</span>
                                    <span className={`${styles.lifeStatAmt} ${styles.lifeStatAmtGold}`}>₹{fmt(totalWon)}</span>
                                </div>
                            </div>

                            {/* ── TABS ── */}
                            <div className={styles.tabs}>
                                {TABS.map(t => (
                                    <button
                                        key={t}
                                        type='button'
                                        className={`${styles.tabBtn} ${tab === t ? styles.tabBtnActive : ''} ${t === 'deposit' && tab === t ? styles.tabDeposit : ''} ${t === 'withdraw' && tab === t ? styles.tabWithdraw : ''} ${t === 'history' && tab === t ? styles.tabHistory : ''}`}
                                        onClick={() => { setTab(t); setMsg({ text: '', type: '' }); clearForm(); setHistPage(1); }}
                                    >
                                        {t === 'deposit'  && <ArrowDown />}
                                        {t === 'withdraw' && <ArrowUp />}
                                        {t === 'history'  && <ClockIcon />}
                                        <span>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
                                    </button>
                                ))}
                            </div>

                            {/* ── FLASH ── */}
                            {msg.text && (
                                <div role='status' className={`${styles.flash} ${msg.type === 'ok' ? styles.flashOk : styles.flashErr}`}>
                                    {msg.text}
                                </div>
                            )}

                            {/* ── DEPOSIT TAB ── */}
                            {tab === 'deposit' && (
                                <div className={styles.form}>
                                    <div className={styles.modeHeader}>
                                        <span className={`${styles.modeIcon} ${styles.modeIconDeposit}`}><ArrowDown /></span>
                                        <div>
                                            <h2>Deposit Funds</h2>
                                            <p>Add money to your arena balance.</p>
                                        </div>
                                    </div>

                                    <div className={styles.fieldGroup}>
                                        <label className={styles.label}>Amount (₹)</label>
                                        <input className={styles.input} type='number' min='1' placeholder='Enter amount'
                                            value={amount} onChange={e => setAmount(e.target.value)} />
                                        <div className={styles.quickAmounts}>
                                            {QUICK_AMOUNTS.map(q => (
                                                <button
                                                    key={q}
                                                    type='button'
                                                    className={`${styles.quickBtn} ${amount === String(q) ? styles.quickBtnActive : ''}`}
                                                    onClick={() => setAmount(String(q))}
                                                >
                                                    ₹{q}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className={styles.fieldGroup}>
                                        <label className={styles.label}>Payment Gateway</label>
                                        <input className={styles.input} type='text' placeholder='e.g. Razorpay'
                                            value={gateway} onChange={e => setGateway(e.target.value)} />
                                    </div>

                                    <div className={styles.fieldGroup}>
                                        <label className={styles.label}>Gateway Order ID</label>
                                        <input className={styles.input} type='text' placeholder='order_xxxxxxxx'
                                            value={orderId} onChange={e => setOrderId(e.target.value)} />
                                    </div>

                                    <button type='button' className={`${styles.btn} ${styles.btnDeposit}`} onClick={handleDeposit} disabled={loading}>
                                        {loading ? <><SpinIcon />Processing…</> : <><span>CONFIRM DEPOSIT</span><span className={styles.btnArrow}>›</span></>}
                                    </button>
                                </div>
                            )}

                            {/* ── WITHDRAW TAB ── */}
                            {tab === 'withdraw' && (
                                <div className={styles.form}>
                                    <div className={styles.modeHeader}>
                                        <span className={`${styles.modeIcon} ${styles.modeIconWithdraw}`}><ArrowUp /></span>
                                        <div>
                                            <h2>Withdraw Funds</h2>
                                            <p>Request payout to your UPI account.</p>
                                        </div>
                                    </div>

                                    <div className={styles.fieldGroup}>
                                        <label className={styles.label}>Amount (₹)</label>
                                        <input className={styles.input} type='number' min='1' placeholder='Enter amount'
                                            value={amount} onChange={e => setAmount(e.target.value)} />
                                        <div className={styles.quickAmounts}>
                                            {QUICK_AMOUNTS.map(q => (
                                                <button key={q} type='button'
                                                    className={`${styles.quickBtn} ${amount === String(q) ? styles.quickBtnActive : ''}`}
                                                    onClick={() => setAmount(String(q))}>
                                                    ₹{q}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className={styles.fieldGroup}>
                                        <label className={styles.label}>Payment Method</label>
                                        <div className={styles.methodBadge}>
                                            <svg viewBox='0 0 24 24' fill='none' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' stroke='currentColor'><rect x='2' y='5' width='20' height='14' rx='2'/><path d='M2 10h20'/></svg>
                                            UPI — Instant Transfer
                                        </div>
                                    </div>

                                    <div className={styles.fieldGroup}>
                                        <label className={styles.label}>UPI ID</label>
                                        <input className={styles.input} type='text' placeholder='yourname@upi'
                                            value={upiId} onChange={e => setUpiId(e.target.value)} />
                                    </div>

                                    <button type='button' className={`${styles.btn} ${styles.btnWithdraw}`} onClick={handleWithdraw} disabled={loading}>
                                        {loading ? <><SpinIcon />Processing…</> : <><span>REQUEST WITHDRAWAL</span><span className={styles.btnArrow}>›</span></>}
                                    </button>
                                </div>
                            )}

                            {/* ── HISTORY TAB ── */}
                            {tab === 'history' && (() => {
                                const totalPages  = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
                                const safePage    = Math.min(histPage, totalPages);
                                const pageHistory = history.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

                                return (
                                    <div className={styles.historySection}>
                                        <div className={styles.historyHeader}>
                                            <span className={styles.historyTitle}>Transactions</span>
                                            {!histLoading && history.length > 0 && (
                                                <span className={styles.historyCount}>{history.length} total</span>
                                            )}
                                        </div>
                                        <div className={styles.historyWrap}>
                                            {histLoading && (
                                                <div className={styles.historyEmpty}><SpinIcon /></div>
                                            )}
                                            {!histLoading && history.length === 0 && (
                                                <div className={styles.historyEmpty}>
                                                    <span className={styles.historyEmptyIcon}><ClockIcon /></span>
                                                    <p>No transactions yet</p>
                                                </div>
                                            )}
                                            {!histLoading && pageHistory.map((tx, i) => (
                                                <TxRow key={tx.id || tx._id || i} tx={tx} />
                                            ))}
                                        </div>

                                        {!histLoading && totalPages > 1 && (
                                            <div className={styles.pagination}>
                                                <button className={styles.pageBtn}
                                                    onClick={() => setHistPage(p => Math.max(1, p - 1))}
                                                    disabled={safePage === 1}>← Prev</button>
                                                <span className={styles.pageInfo}>
                                                    Page <strong>{safePage}</strong> of <strong>{totalPages}</strong>
                                                </span>
                                                <button className={`${styles.pageBtn} ${styles.pageBtnNext}`}
                                                    onClick={() => setHistPage(p => Math.min(totalPages, p + 1))}
                                                    disabled={safePage === totalPages}>Next →</button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WalletPage;
