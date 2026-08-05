import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import classes from './SelfServiceView.module.css';
import { hideItemScanError } from '../../../store/uiSlice';
import notFoundImg from '../../../assets/self-service/barcode-not-found.png';
import AR from './i18n';

const AUTO_DISMISS_SECONDS = 8;

/**
 * Self-service replacement for the generic item-scan-error backdrop in
 * App.js: full Arabic, kiosk-styled card with an illustration, a big
 * "try again" button and an auto-dismiss countdown so the lane never
 * stays blocked if the customer walks off.
 */
const SelfServiceScanError = () => {
    const uiSlice = useSelector((state) => state.ui);
    const dispatch = useDispatch();
    const open = uiSlice.itemScanError;

    // A loyalty/account card that failed lookup (unregistered, or Shini Me
    // unreachable) gets a friendlier, distinct message than a plain "item
    // not found" — the backend message always echoes the scanned barcode
    // (see PosSellTrxService#onScanBarcode), so LC-/C-/mobile-number prefixed
    // messages (or ones mentioning "Customer") are card lookups, not items.
    const msg = uiSlice.itemScanErrorMessage || '';
    const isCardLookup = /^(LC-|C-|00970|00972)/.test(msg) || /Customer/i.test(msg);

    const [secondsLeft, setSecondsLeft] = useState(AUTO_DISMISS_SECONDS);

    useEffect(() => {
        if (!open) return undefined;
        setSecondsLeft(AUTO_DISMISS_SECONDS);
        const t = window.setInterval(() => {
            setSecondsLeft((s) => {
                if (s <= 1) {
                    dispatch(hideItemScanError());
                    return 0;
                }
                return s - 1;
            });
        }, 1000);
        return () => window.clearInterval(t);
    }, [open, dispatch]);

    if (!open) return null;

    return (
        <div className={classes.Overlay} dir="rtl">
            <div className={`${classes.OverlayPanel} ${classes.ScanErrorPanel}`}>
                <img
                    src={notFoundImg}
                    alt=""
                    className={classes.ScanErrorImg}
                    draggable={false}
                />
                <h3 className={classes.ScanErrorTitle}>
                    {isCardLookup ? AR.cardNotFoundTitle : AR.barcodeNotFoundTitle}
                </h3>
                <p className={classes.ScanErrorHint}>
                    {isCardLookup ? AR.cardNotFoundHint : AR.barcodeNotFoundHint}
                </p>
                <button
                    type="button"
                    className={classes.ScanErrorBtn}
                    onClick={() => dispatch(hideItemScanError())}
                >
                    {AR.tryAgain}
                    <span className={classes.ScanErrorCountdown} dir="ltr">({secondsLeft})</span>
                </button>
            </div>
        </div>
    );
};

export default SelfServiceScanError;
