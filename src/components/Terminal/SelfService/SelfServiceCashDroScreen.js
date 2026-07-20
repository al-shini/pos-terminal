import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoneyBill, faTimes, faSpinner } from '@fortawesome/free-solid-svg-icons';
import classes from './SelfServiceView.module.css';
import config from '../../../config';

const fmt = (n) => (((Number(n) || 0) * 100) / 100).toFixed(config.decimals);

/**
 * Full-screen CashDro progress: amount due + cash inserted so far.
 */
const SelfServiceCashDroScreen = ({ amountDue, cashDroStatus, onCancel }) => {
    const inserted = cashDroStatus && cashDroStatus.totalIn != null
        ? cashDroStatus.totalIn
        : 0;
    const message = (cashDroStatus && cashDroStatus.message)
        || 'Please insert cash into the machine…';

    return (
        <div className={classes.Overlay}>
            <div className={classes.OverlayFull} style={{
                background: 'linear-gradient(180deg, #ECFDF5 0%, #FFFFFF 55%)'
            }}>
                <FontAwesomeIcon icon={faMoneyBill} className={classes.CoinBounce} style={{ fontSize: 72, color: '#16A34A' }} />
                <h2 className={classes.OverlayTitle}>Insert cash</h2>
                <div className={classes.DueAmount}>
                    {config.currencySymbol} {fmt(amountDue)}
                </div>
                <p className={classes.OverlaySubtitle}>Amount due</p>

                <div style={{ textAlign: 'center' }}>
                    <div className={classes.ReceiptAmtLabel}>Inserted so far</div>
                    <div className={classes.InsertedAmt}>
                        {config.currencySymbol} {fmt(inserted)}
                    </div>
                </div>

                <p className={classes.StatusBig}>
                    <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 12 }} />
                    {message}
                </p>

                <button type="button" className={classes.OverlayCancel} onClick={onCancel}>
                    <FontAwesomeIcon icon={faTimes} />
                    Cancel payment
                </button>
            </div>
        </div>
    );
};

export default SelfServiceCashDroScreen;
