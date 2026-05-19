import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faUser, faStar, faLock, faCalendarDay, faUserTie,
    faMoneyBillTransfer, faCashRegister, faPiggyBank
} from '@fortawesome/free-solid-svg-icons';

import classes from './CustomerDisplay.module.css';
import adminClasses from '../Backoffice/Admin.module.css';
import axios from '../../axios';
import config from '../../config';

import Logo from '../../assets/full-logo.png';

import CustomerInvoiceList from './CustomerInvoiceList';
import CustomerImageCarousel from './CustomerImageCarousel';
import CustomerNewsTicker from './CustomerNewsTicker';
import CustomerErrorBoundary from './CustomerErrorBoundary';

const CONFIG_REFRESH_MS = 5 * 60 * 1000; // 5 minutes
// Watchdog: if the customer window stops processing redux actions for this
// long, force a soft reload. State syncs from the cashier window via
// redux-state-sync; a long quiet period in the middle of an active shift
// almost always means the BroadcastChannel between windows has wedged
// (intermittent in Electron when the renderer is under memory pressure).
// Reloading rehydrates from the other window automatically.
const WATCHDOG_QUIET_MS = 5 * 60 * 1000; // 5 minutes

const CURRENCY = config.currencySymbol;
const DECIMALS = config.decimals;
const fmtAmount = (n) => (((Number(n) || 0) * 100) / 100).toFixed(DECIMALS);

/**
 * Customer-facing secondary display.
 *
 * Layout (CSS Grid in .Shell):
 *   ┌────────────────────┬────────────────────┐
 *   │  Left (invoice)    │  Right (carousel)  │
 *   ├────────────────────┴────────────────────┤
 *   │          News ticker (full width)       │
 *   └─────────────────────────────────────────┘
 *
 * All customer-facing content (ads + news) is sourced from the head-office
 * system parameters POS_CUSTOMER_IMAGES and POS_CUSTOMER_MESSAGES via
 * GET /trx/customerDisplayConfig. We refetch periodically so updates made
 * at head office roll out without restarting the display.
 *
 * The component is purely presentational — all transaction state comes
 * from the shared Redux store (synced across windows via redux-state-sync),
 * populated by the cashier-facing Terminal window.
 */
const CustomerDisplay = () => {
    // [PERF/STABILITY 2026-05-13] Narrow useSelector subscriptions to ONLY
    // the primitive fields actually rendered by this component. Previously
    // we subscribed to the entire `terminal` and `trx` slices, which forced
    // the whole customer-display tree to re-render on EVERY redux action
    // (and the cashier window dispatches dozens per scan/payment). On long
    // shifts that built up enough render pressure on the secondary monitor
    // to occasionally wedge the renderer (the "freezes after a few scans /
    // invoices" reports). Picking primitives lets react-redux short-circuit
    // re-renders via its default strict-equality check.
    const trxMode = useSelector((state) => state.terminal.trxMode);
    const customerName = useSelector((state) => (state.terminal.customer ? state.terminal.customer.customerName : null));
    const customerIsClub = useSelector((state) => Boolean(state.terminal.customer && state.terminal.customer.club));
    const customerCashbackBalance = useSelector((state) => (state.terminal.customer ? Number(state.terminal.customer.cashbackBalance) : 0));
    const customerConfigVersion = useSelector((state) => state.terminal.customerConfigVersion || 0);
    const loggedInUsername = useSelector((state) => (state.terminal.loggedInUser ? state.terminal.loggedInUser.username : null));
    const businessDateAsString = useSelector((state) => (
        state.terminal.till && state.terminal.till.workDay
            ? state.terminal.till.workDay.businessDateAsString
            : null
    ));
    const paymentMode = useSelector((state) => state.terminal.paymentMode);
    const blockActions = useSelector((state) => state.terminal.blockActions);
    const broadcastMessage = useSelector((state) => (state.terminal.customerBroadcast ? state.terminal.customerBroadcast.message : null));
    const broadcastImageUrl = useSelector((state) => (state.terminal.customerBroadcast ? state.terminal.customerBroadcast.imageUrl : null));

    const trxTotalAfterDiscount = useSelector((state) => (state.trx.trx ? state.trx.trx.totalafterdiscount : 0));
    const trxTotalDiscount = useSelector((state) => (state.trx.trx ? Number(state.trx.trx.totaldiscount) || 0 : 0));
    const trxTotalCashbackAmt = useSelector((state) => (state.trx.trx ? state.trx.trx.totalcashbackamt : 0));
    const trxPaidRaw = useSelector((state) => state.trx.trxPaid || 0);
    const trxChangeRaw = useSelector((state) => state.trx.trxChange || 0);
    const itemCount = useSelector((state) => (state.trx.scannedItems ? state.trx.scannedItems.length : 0));

    const [displayConfig, setDisplayConfig] = useState({ images: [], messages: [] });

    useEffect(() => {
        // Customer-display carousel/news is only wired into the Jordan
        // backend (it depends on head-office system params + a dedicated
        // endpoint). For tenants without the feature we stay on the
        // empty defaults — the display still renders totals/lines fine.
        if (!config.features.customerDisplayConfig) {
            return;
        }

        let cancelled = false;

        const fetchConfig = () => {
            axios({
                method: 'get',
                url: '/trx/customerDisplayConfig'
            }).then((response) => {
                if (cancelled || !response || !response.data) return;
                setDisplayConfig({
                    images: Array.isArray(response.data.images) ? response.data.images : [],
                    messages: Array.isArray(response.data.messages) ? response.data.messages : []
                });
            }).catch(() => {
                // Silent — the display just falls back to defaults until the
                // next retry. Showing an error popup to customers is worse
                // than quietly showing nothing.
            });
        };

        fetchConfig();
        const id = setInterval(fetchConfig, CONFIG_REFRESH_MS);

        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [customerConfigVersion]);

    // [STABILITY 2026-05-13] Watchdog: if no redux state change arrives for
    // WATCHDOG_QUIET_MS while the cashier is logged in, the cross-window
    // sync has almost certainly wedged — force a soft reload to recover
    // without a manual app restart. The ref is updated on every render
    // (cheap, no effect re-run); the interval itself is set up ONCE per
    // login session.
    const lastBeatRef = useRef(Date.now());
    lastBeatRef.current = Date.now();
    useEffect(() => {
        if (!loggedInUsername) {
            return undefined;
        }
        const id = setInterval(() => {
            if (Date.now() - lastBeatRef.current > WATCHDOG_QUIET_MS) {
                try { window.location.reload(); } catch (_) { /* ignore */ }
            }
        }, 30 * 1000);
        return () => clearInterval(id);
    }, [loggedInUsername]);

    const isRefund = trxMode === 'Refund';
    const isClub = customerIsClub;

    const clubBalance = useMemo(() => {
        if (!config.features.cashback) return null;
        if (!isClub) return null;
        const raw = customerCashbackBalance;
        if (!raw) return null;
        return Math.round(raw * 10000) / 10000;
    }, [isClub, customerCashbackBalance]);

    const grandTotal = fmtAmount(trxTotalAfterDiscount);

    const paid = fmtAmount(Math.round((trxPaidRaw || 0) * 100) / 100);
    const change = Math.round((trxChangeRaw || 0) * 100) / 100;
    const changeIsDue = change < 0;
    const changeLabel = change > 0 ? 'Change' : 'Due';
    const changeDisplay = fmtAmount(change);

    const cashback = config.features.cashback && trxTotalCashbackAmt > 0
        ? fmtAmount(trxTotalCashbackAmt)
        : null;

    // Total amount the customer saved this transaction. We only surface it
    // on sales — refunds don't carry a "savings" narrative.
    const amountSaved = !isRefund && trxTotalDiscount > 0
        ? fmtAmount(trxTotalDiscount)
        : null;

    const isRefundMode = isRefund;

    return (
        <CustomerErrorBoundary>
        <div className={[classes.Shell, isRefundMode ? classes.RefundMode : ''].join(' ')}>
            <div className={classes.LeftColumn}>
                <div className={classes.Header}>
                    <div className={classes.HeaderLeft}>
                        <img src={Logo} alt="Shini Extra" className={classes.HeaderLogo} />
                    </div>
                    <div className={classes.HeaderRight}>
                        <span className={classes.HeaderBadge}>
                            <FontAwesomeIcon icon={faUserTie} />
                            <b>{loggedInUsername || 'No User'}</b>
                        </span>
                        <span className={classes.HeaderBadge}>
                            <FontAwesomeIcon icon={faCalendarDay} />
                            <b>
                                {businessDateAsString || '—'}
                            </b>
                        </span>
                        <span
                            className={`${classes.HeaderStatus} ${isRefund ? classes.HeaderStatusRefund : ''}`}
                        >
                            <span className={classes.HeaderStatusDot} />
                            {isRefund ? 'Refund' : (paymentMode ? 'Payment' : 'Sale')}
                        </span>
                    </div>
                </div>

                <div className={classes.CustomerBanner}>
                    <div className={classes.CustomerBannerLeft}>
                        <div className={`${classes.CustomerAvatar} ${isClub ? classes.CustomerAvatarClub : ''}`}>
                            <FontAwesomeIcon icon={isClub ? faStar : faUser} />
                        </div>
                        <div className={classes.CustomerGreeting}>
                            <span className={classes.CustomerGreetingLabel}>
                                {customerName ? 'Welcome' : 'Hello'}
                            </span>
                            <span className={classes.CustomerGreetingName}>
                                {customerName || 'Valued Customer'}
                            </span>
                        </div>
                    </div>

                    {isClub && (
                        <span className={classes.CustomerClubPill}>
                            <FontAwesomeIcon icon={faStar} />
                            Club
                            {clubBalance !== null && (
                                <span className={classes.CustomerClubBalance}>
                                    {clubBalance}
                                    <small>{CURRENCY}</small>
                                </span>
                            )}
                        </span>
                    )}
                </div>

                <CustomerInvoiceList />

                <div className={classes.TotalsPanel}>
                    <div className={classes.TotalsCell}>
                        <span
                            className={`${classes.TotalsLabel} ${isRefund ? classes.TotalsLabelAccent : classes.TotalsLabelAccentGreen}`}
                        >
                            {isRefund ? 'Refund Total' : 'Grand Total'}
                        </span>
                        <div className={classes.TotalsAmount}>
                            <small>{CURRENCY}</small>
                            <span
                                className={`${classes.TotalsAmountGrand} ${isRefund ? classes.TotalsAmountRed : classes.TotalsAmountGreen}`}
                            >
                                {grandTotal}
                            </span>
                        </div>
                    </div>

                    {paymentMode && (
                        <div className={classes.TotalsStackCell}>
                            <div className={classes.TotalsStackRow}>
                                <span className={classes.TotalsStackLabel}>Paid</span>
                                <span className={classes.TotalsStackAmount}>{paid}</span>
                            </div>
                            <div className={classes.TotalsStackRow}>
                                <span
                                    className={`${classes.TotalsStackLabel} ${changeIsDue ? classes.TotalsStackLabelRed : classes.TotalsStackLabelGreen}`}
                                >
                                    {changeLabel}
                                </span>
                                <span
                                    className={`${classes.TotalsStackAmount} ${changeIsDue ? classes.TotalsStackAmountRed : classes.TotalsStackAmountGreen}`}
                                >
                                    {changeDisplay}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className={classes.TotalsPills}>
                        <span className={classes.TotalsPill}>
                            <FontAwesomeIcon icon={faCashRegister} style={{ fontSize: 10 }} />
                            <b>{itemCount}</b>
                            Items
                        </span>
                        {amountSaved && (
                            <span className={`${classes.TotalsPill} ${classes.TotalsPillSaved}`}>
                                <FontAwesomeIcon icon={faPiggyBank} style={{ fontSize: 14 }} />
                                You Saved
                                <b>{amountSaved}</b>
                                <small>{CURRENCY}</small>
                            </span>
                        )}
                        {cashback && (
                            <span className={`${classes.TotalsPill} ${classes.TotalsPillCashback}`}>
                                <FontAwesomeIcon icon={faStar} style={{ fontSize: 10 }} />
                                Cashback
                                <b>{cashback}</b>
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className={classes.RightColumn}>
                {paymentMode && (
                    <div className={classes.PayBanner}>
                        <FontAwesomeIcon icon={faMoneyBillTransfer} style={{ fontSize: 20 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <b>Processing Payment</b>
                            <small>Please watch the left panel for your total</small>
                        </div>
                    </div>
                )}
                <CustomerImageCarousel images={displayConfig.images} />
            </div>

            <CustomerNewsTicker messages={displayConfig.messages} />

            {blockActions && (
                <div className={classes.LockOverlay}>
                    <div className={classes.LockIcon}>
                        <FontAwesomeIcon icon={faLock} />
                    </div>
                    <div className={classes.LockTitle}>Terminal Locked</div>
                    <div className={classes.LockSub}>
                        Please wait — the cashier will resume shortly.
                    </div>
                </div>
            )}

            {(broadcastMessage || broadcastImageUrl) && (
                <div className={adminClasses.CustomerBroadcastOverlay}>
                    {broadcastImageUrl && (
                        <img
                            src={broadcastImageUrl}
                            alt=""
                            className={adminClasses.CustomerBroadcastImg}
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    )}
                    {broadcastMessage && (
                        <div className={adminClasses.CustomerBroadcastMsg}>
                            {broadcastMessage}
                        </div>
                    )}
                </div>
            )}
        </div>
        </CustomerErrorBoundary>
    );
};

export default CustomerDisplay;
