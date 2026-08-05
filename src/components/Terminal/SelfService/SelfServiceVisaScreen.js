import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCreditCard, faTimes, faSpinner, faShieldHalved,
    faCircleExclamation, faTriangleExclamation, faArrowLeft, faUserShield
} from '@fortawesome/free-solid-svg-icons';
import QRCode from 'react-qr-code';
import classes from './SelfServiceView.module.css';
import config from '../../../config';
import AR from './i18n';

const fmt = (n) => (((Number(n) || 0) * 100) / 100).toFixed(config.decimals);

/**
 * Card payment screen, in two flavours depending on how the station is set up.
 *
 * When a BOP card terminal is linked (`cardTerminal` is passed), the customer
 * pays on the physical reader and this screen just narrates the states the
 * reader goes through.
 *
 * Otherwise it falls back to manual approval: the customer's card is charged
 * by a supervisor/head cashier on their own terminal, and that staff member
 * must first scan this QR with their own device to authorize it (same
 * authorized-role check the backend already uses for normal-POS voids / price
 * changes — see auth/validateQR: Store Manager, Head Cashier, Branch
 * Supervisor, etc.).
 */
const SelfServiceVisaScreen = ({ authQR, amountDue, onCancel, cardTerminal, onStaffOverride }) => {
    if (cardTerminal) {
        return (
            <CardTerminalScreen
                {...cardTerminal}
                amountDue={amountDue}
                onCancel={onCancel}
                onStaffOverride={onStaffOverride}
            />
        );
    }

    // `authQR` may not have a qrAuthKey yet on the very first render (the
    // generateQR request is still in flight) — show a spinner until it does.
    const ready = authQR && authQR.qrAuthKey;

    // [QR robustness] auth/validateQR only ever reads qrAuthKey (+ deviceId
    // from the scanning phone itself) — ipAddress/endPoint are only needed
    // so the phone knows where to POST. `source` is redundant (the backend
    // resolves it server-side from the qrAuthKey row) and was only ever
    // along for the ride. Trimming it — plus a higher error-correction level
    // below — makes the printed code less dense and more tolerant of a
    // partial/blurry camera read, which is the most likely cause of a scan
    // needing to be retried.
    const qrValue = ready
        ? JSON.stringify({ ipAddress: authQR.ipAddress, endPoint: authQR.endPoint, qrAuthKey: authQR.qrAuthKey })
        : '';

    return (
        <div className={classes.Overlay} dir="rtl">
            <div className={classes.OverlayFull}>
                <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: 64, color: '#fff' }} />
                <h2 className={classes.OverlayTitle}>{AR.visaScanTitle}</h2>
                <div className={classes.DueAmount} dir="ltr">
                    {config.currencySymbol} {fmt(amountDue)}
                </div>
                <p className={classes.OverlaySubtitle}>{AR.amountDue}</p>

                <div className={classes.VisaQrBox}>
                    {ready ? (
                        <QRCode value={qrValue} size={260} level="M" />
                    ) : (
                        <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 48, color: '#111827' }} />
                    )}
                </div>

                <p className={classes.StatusBig}>
                    <FontAwesomeIcon icon={faShieldHalved} style={{ marginLeft: 12 }} />
                    {ready ? AR.visaScanHint : AR.visaPreparing}
                </p>

                <button type="button" className={classes.OverlayCancel} onClick={onCancel}>
                    <FontAwesomeIcon icon={faTimes} />
                    {AR.cancelPayment}
                </button>
            </div>
        </div>
    );
};

/**
 * Live card-reader states.
 *
 * `status` is one of:
 *   'prompting' — waiting for the customer at the reader
 *   'declined'  — the terminal answered, but not with an approval
 *   'unknown'   — no usable answer came back. The card may well have been
 *                 charged, so this state deliberately offers no retry and
 *                 sends the customer to a staff member instead.
 */
const CardTerminalScreen = ({ status, message, amountDue, onCancel, onDismiss, onStaffOverride }) => {
    // Escape hatch for a wait that has gone on far longer than a normal card
    // interaction. The reader owns the session, so there is deliberately no
    // customer-facing cancel — but a kiosk with no way out at all meant a
    // wedged station could only be recovered by killing the whole app. After
    // this delay a password-gated staff button appears; clearing through it
    // goes down the same "check the reader before doing anything" path as an
    // unknown outcome, because that is exactly what it is.
    const [waitedTooLong, setWaitedTooLong] = React.useState(false);
    React.useEffect(() => {
        setWaitedTooLong(false);
        if (status !== 'prompting') {
            return undefined;
        }
        const timer = setTimeout(() => setWaitedTooLong(true), 60 * 1000);
        return () => clearTimeout(timer);
    }, [status]);

    if (status === 'unknown') {
        return (
            <div className={classes.Overlay} dir="rtl">
                <div className={classes.OverlayFull}>
                    <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 64, color: '#FBBF24' }} />
                    <h2 className={classes.OverlayTitle}>{AR.cardTerminalUnknownTitle}</h2>
                    <p className={classes.OverlaySubtitle}>{AR.cardTerminalUnknownHint}</p>
                    {message && <p className={classes.OverlaySubtitle} dir="ltr">{message}</p>}
                    <p className={classes.StatusBig}>
                        <FontAwesomeIcon icon={faShieldHalved} style={{ marginLeft: 12 }} />
                        {AR.callStaff}
                    </p>
                    {/* This screen covers the header, so without its own way
                        out the kiosk would be stuck here. Password-gated: only
                        someone who has checked the reader should clear it. */}
                    <button type="button" className={classes.OverlayCancel} onClick={onStaffOverride}>
                        <FontAwesomeIcon icon={faUserShield} />
                        {AR.cardTerminalStaffClear}
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'declined') {
        return (
            <div className={classes.Overlay} dir="rtl">
                <div className={classes.OverlayFull}>
                    <FontAwesomeIcon icon={faCircleExclamation} style={{ fontSize: 64, color: '#F87171' }} />
                    <h2 className={classes.OverlayTitle}>{AR.cardTerminalDeclined}</h2>
                    <p className={classes.OverlaySubtitle}>{message || AR.cardTerminalTryAgain}</p>
                    <button type="button" className={classes.OverlayCancel} onClick={onDismiss || onCancel}>
                        <FontAwesomeIcon icon={faArrowLeft} />
                        {AR.backToCart}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={classes.Overlay} dir="rtl">
            <div className={classes.OverlayFull}>
                <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: 64, color: '#fff' }} />
                <h2 className={classes.OverlayTitle}>{AR.cardTerminalTitle}</h2>
                <div className={classes.DueAmount} dir="ltr">
                    {config.currencySymbol} {fmt(amountDue)}
                </div>
                <p className={classes.OverlaySubtitle}>{AR.cardTerminalPrompt}</p>

                <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 48, color: '#fff' }} />

                <p className={classes.StatusBig}>{AR.cardTerminalHint}</p>
                <p className={classes.OverlaySubtitle}>{AR.cardTerminalWorking}</p>

                {/* No customer cancel button on purpose: once the request is
                    with the reader, the only safe way out is to cancel on the
                    reader itself, which returns a decline through the normal
                    path. The staff button below appears only after the wait has
                    outlived any plausible card interaction. */}
                {waitedTooLong && (
                    <>
                        <p className={classes.OverlaySubtitle}>{AR.cardTerminalStuckHint}</p>
                        <button type="button" className={classes.OverlayCancel} onClick={onStaffOverride}>
                            <FontAwesomeIcon icon={faUserShield} />
                            {AR.cardTerminalStaffClear}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default SelfServiceVisaScreen;
