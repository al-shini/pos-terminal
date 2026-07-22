import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoneyBill, faTimes, faSpinner } from '@fortawesome/free-solid-svg-icons';
import classes from './SelfServiceView.module.css';
import config from '../../../config';
import AR from './i18n';

const fmt = (n) => (((Number(n) || 0) * 100) / 100).toFixed(config.decimals);

/**
 * Full-screen CashDro progress: amount due + cash inserted so far.
 * Status text is derived from machine state locally so it is always Arabic
 * (the raw status message from Terminal.js is English and ignored here).
 */
const SelfServiceCashDroScreen = ({ amountDue, cashDroStatus, onCancel }) => {
    const inserted = cashDroStatus && cashDroStatus.totalIn != null
        ? cashDroStatus.totalIn
        : 0;
    const state = cashDroStatus ? cashDroStatus.state : null;

    let message = AR.waitingCashMachine;
    if (state === 'STARTING') {
        message = AR.startingCashMachine;
    } else if (state === 'PENDING') {
        message = inserted > 0
            ? AR.waitingCustomerMsg(fmt(inserted), config.systemCurrency)
            : AR.insertAmountMsg(fmt(amountDue), config.systemCurrency);
    }

    return (
        <div className={classes.Overlay} dir="rtl">
            <div className={classes.OverlayFull}>
                <FontAwesomeIcon icon={faMoneyBill} className={classes.CoinBounce} style={{ fontSize: 72, color: '#fff' }} />
                <h2 className={classes.OverlayTitle}>{AR.insertCash}</h2>
                <div className={classes.DueAmount} dir="ltr">
                    {config.currencySymbol} {fmt(amountDue)}
                </div>
                <p className={classes.OverlaySubtitle}>{AR.amountDue}</p>

                <div className={classes.ReceiptAmtBox}>
                    <div className={classes.ReceiptAmtLabel}>{AR.insertedSoFar}</div>
                    <div className={classes.ReceiptAmtValue} dir="ltr" style={{ color: '#047857' }}>
                        {config.currencySymbol} {fmt(inserted)}
                    </div>
                </div>

                <p className={classes.StatusBig}>
                    <FontAwesomeIcon icon={faSpinner} spin style={{ marginLeft: 12 }} />
                    {message}
                </p>

                <button type="button" className={classes.OverlayCancel} onClick={onCancel}>
                    <FontAwesomeIcon icon={faTimes} />
                    {AR.cancelPayment}
                </button>
            </div>
        </div>
    );
};

export default SelfServiceCashDroScreen;
