import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faCheck } from '@fortawesome/free-solid-svg-icons';
import classes from './SelfServiceView.module.css';
import config from '../../../config';
import takeReceiptImg from '../../../assets/self-service/take-receipt.png';
import AR from './i18n';

const fmt = (n) => (((Number(n) || 0) * 100) / 100).toFixed(config.decimals);

/**
 * Payment-complete screen. Auto-dismisses after `durationMs` with a visible
 * countdown, or immediately via the Done button.
 *
 * The timer is armed exactly once on mount (onDone is kept in a ref) —
 * arming it per-render caused the timer to keep resetting whenever the
 * parent re-rendered, which made this screen appear stuck.
 */
const SelfServiceReceiptScreen = ({ lastPayment, onDone, durationMs = 8000 }) => {
    const onDoneRef = useRef(onDone);
    onDoneRef.current = onDone;

    const [secondsLeft, setSecondsLeft] = useState(Math.ceil(durationMs / 1000));

    useEffect(() => {
        const deadline = Date.now() + durationMs;
        const tick = window.setInterval(() => {
            const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            setSecondsLeft(remaining);
            if (remaining <= 0) {
                window.clearInterval(tick);
                if (onDoneRef.current) onDoneRef.current();
            }
        }, 250);
        return () => window.clearInterval(tick);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const paid = lastPayment ? lastPayment.paid : 0;
    const change = lastPayment ? lastPayment.change : 0;

    return (
        <div className={classes.Overlay} dir="rtl">
            <div className={classes.OverlayFull}>
                <FontAwesomeIcon icon={faCircleCheck} className={classes.ReceiptIcon} />
                <h2 className={classes.OverlayTitle}>{AR.paymentComplete}</h2>
                <p className={classes.OverlaySubtitle}>{AR.takeYourReceipt}</p>

                <img
                    src={takeReceiptImg}
                    alt=""
                    style={{
                        width: 140,
                        height: 140,
                        objectFit: 'contain',
                        background: '#fff',
                        borderRadius: 20,
                        padding: 10,
                        boxShadow: '0 10px 26px rgba(0, 0, 0, 0.2)',
                    }}
                />

                <div className={classes.ReceiptAmtRow}>
                    <div className={classes.ReceiptAmtBox}>
                        <div className={classes.ReceiptAmtLabel}>{AR.paid}</div>
                        <div className={classes.ReceiptAmtValue} dir="ltr">
                            {config.currencySymbol} {fmt(paid)}
                        </div>
                    </div>
                    <div className={classes.ReceiptAmtBox}>
                        <div className={classes.ReceiptAmtLabel}>{AR.change}</div>
                        <div className={classes.ReceiptAmtValue} dir="ltr" style={{ color: '#047857' }}>
                            {config.currencySymbol} {fmt(change)}
                        </div>
                    </div>
                </div>

                <p className={classes.StatusBig}>{AR.thankYou}</p>

                <button
                    type="button"
                    className={classes.ReceiptDoneBtn}
                    onClick={() => onDoneRef.current && onDoneRef.current()}
                >
                    <FontAwesomeIcon icon={faCheck} />
                    {AR.done}
                </button>
                <div className={classes.ReceiptCountdown}>
                    {AR.autoCloseIn(secondsLeft)}
                </div>
            </div>
        </div>
    );
};

export default SelfServiceReceiptScreen;
