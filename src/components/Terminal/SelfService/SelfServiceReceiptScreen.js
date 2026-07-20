import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faReceipt } from '@fortawesome/free-solid-svg-icons';
import classes from './SelfServiceView.module.css';
import config from '../../../config';
import takeReceiptImg from '../../../assets/self-service/take-receipt.png';

const fmt = (n) => (((Number(n) || 0) * 100) / 100).toFixed(config.decimals);

/**
 * Payment-complete screen. Auto-dismisses after `durationMs`.
 */
const SelfServiceReceiptScreen = ({ lastPayment, onDone, durationMs = 6000 }) => {
    useEffect(() => {
        const t = window.setTimeout(() => {
            if (onDone) onDone();
        }, durationMs);
        return () => window.clearTimeout(t);
    }, [onDone, durationMs]);

    const paid = lastPayment ? lastPayment.paid : 0;
    const change = lastPayment ? lastPayment.change : 0;

    return (
        <div className={classes.Overlay}>
            <div className={classes.OverlayFull} style={{
                background: 'linear-gradient(180deg, #ECFDF5 0%, #FFFFFF 50%)'
            }}>
                <FontAwesomeIcon icon={faCircleCheck} className={classes.ReceiptIcon} />
                <h2 className={classes.OverlayTitle}>Payment complete</h2>
                <p className={classes.OverlaySubtitle}>Please take your receipt</p>

                <img
                    src={takeReceiptImg}
                    alt=""
                    style={{ width: 160, height: 160, objectFit: 'contain' }}
                />

                <div className={classes.ReceiptAmtRow}>
                    <div className={classes.ReceiptAmtBox}>
                        <div className={classes.ReceiptAmtLabel}>Paid</div>
                        <div className={classes.ReceiptAmtValue}>
                            {config.currencySymbol} {fmt(paid)}
                        </div>
                    </div>
                    <div className={classes.ReceiptAmtBox}>
                        <div className={classes.ReceiptAmtLabel}>Change</div>
                        <div className={classes.ReceiptAmtValue} style={{ color: '#047857' }}>
                            {config.currencySymbol} {fmt(change)}
                        </div>
                    </div>
                </div>

                <p className={classes.StatusBig}>
                    <FontAwesomeIcon icon={faReceipt} style={{ marginRight: 10 }} />
                    Thank you — have a nice day!
                </p>
            </div>
        </div>
    );
};

export default SelfServiceReceiptScreen;
