import React, { useEffect, useMemo, useState } from 'react';
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

const CONFIG_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

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
    const terminal = useSelector((state) => state.terminal);
    const trxSlice = useSelector((state) => state.trx);
    const customerConfigVersion = useSelector((state) => state.terminal.customerConfigVersion || 0);

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

    const isRefund = terminal.trxMode === 'Refund';
    const isClub = Boolean(terminal.customer && terminal.customer.club);
    const customerName = terminal.customer ? terminal.customer.customerName : null;

    const clubBalance = useMemo(() => {
        if (!config.features.cashback) return null;
        if (!isClub || !terminal.customer) return null;
        const raw = Number(terminal.customer.cashbackBalance);
        if (!raw) return null;
        return Math.round(raw * 10000) / 10000;
    }, [isClub, terminal.customer]);

    const grandTotal = trxSlice.trx
        ? fmtAmount(trxSlice.trx.totalafterdiscount)
        : (0).toFixed(DECIMALS);

    const paid = fmtAmount(Math.round((trxSlice.trxPaid || 0) * 100) / 100);
    const change = Math.round((trxSlice.trxChange || 0) * 100) / 100;
    const changeIsDue = change < 0;
    const changeLabel = change > 0 ? 'Change' : 'Due';
    const changeDisplay = fmtAmount(change);

    const itemCount = trxSlice.scannedItems ? trxSlice.scannedItems.length : 0;
    const cashback = config.features.cashback && trxSlice.trx && trxSlice.trx.totalcashbackamt > 0
        ? fmtAmount(trxSlice.trx.totalcashbackamt)
        : null;

    // Total amount the customer saved this transaction. We only surface it
    // on sales — refunds don't carry a "savings" narrative.
    const amountSavedRaw = trxSlice.trx ? Number(trxSlice.trx.totaldiscount) || 0 : 0;
    const amountSaved = !isRefund && amountSavedRaw > 0
        ? fmtAmount(amountSavedRaw)
        : null;

    const isRefundMode = terminal.trxMode === 'Refund';

    return (
        <div className={[classes.Shell, isRefundMode ? classes.RefundMode : ''].join(' ')}>
            <div className={classes.LeftColumn}>
                <div className={classes.Header}>
                    <div className={classes.HeaderLeft}>
                        <img src={Logo} alt="Shini Extra" className={classes.HeaderLogo} />
                    </div>
                    <div className={classes.HeaderRight}>
                        <span className={classes.HeaderBadge}>
                            <FontAwesomeIcon icon={faUserTie} />
                            <b>{terminal.loggedInUser ? terminal.loggedInUser.username : 'No User'}</b>
                        </span>
                        <span className={classes.HeaderBadge}>
                            <FontAwesomeIcon icon={faCalendarDay} />
                            <b>
                                {terminal.till && terminal.till.workDay
                                    ? terminal.till.workDay.businessDateAsString
                                    : '—'}
                            </b>
                        </span>
                        <span
                            className={`${classes.HeaderStatus} ${isRefund ? classes.HeaderStatusRefund : ''}`}
                        >
                            <span className={classes.HeaderStatusDot} />
                            {isRefund ? 'Refund' : (terminal.paymentMode ? 'Payment' : 'Sale')}
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

                    {terminal.paymentMode && (
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
                {terminal.paymentMode && (
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

            {terminal.blockActions && (
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

            {terminal.customerBroadcast && (terminal.customerBroadcast.message || terminal.customerBroadcast.imageUrl) && (
                <div className={adminClasses.CustomerBroadcastOverlay}>
                    {terminal.customerBroadcast.imageUrl && (
                        <img
                            src={terminal.customerBroadcast.imageUrl}
                            alt=""
                            className={adminClasses.CustomerBroadcastImg}
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    )}
                    {terminal.customerBroadcast.message && (
                        <div className={adminClasses.CustomerBroadcastMsg}>
                            {terminal.customerBroadcast.message}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CustomerDisplay;
