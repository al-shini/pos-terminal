import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation, faUserShield } from '@fortawesome/free-solid-svg-icons';
import classes from './SelfServiceView.module.css';
import config from '../../../config';
import AR from './i18n';

const fmt = (n) => (((Number(n) || 0) * 100) / 100).toFixed(config.decimals);

/**
 * CashDro has taken the customer's money but the sale could not be settled.
 *
 * This deliberately blocks the lane. The alternative — a toast and a return to
 * the cart — is how a store ends up holding cash against an open sale while the
 * next customer pays into the same basket, and it invites the customer to pay a
 * second time for something already collected. Nothing here is dismissable by a
 * customer; clearing it is password-gated so a staff member has to look at the
 * machine and the sale first.
 */
const SelfServiceCashHeldScreen = ({ amount, cashdroId, outcome, onStaffOverride }) => (
    <div className={classes.Overlay} dir="rtl">
        <div className={classes.OverlayFull}>
            <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 64, color: '#FBBF24' }} />
            <h2 className={classes.OverlayTitle}>
                {outcome === 'not-closed' ? AR.cashPaidNotClosedTitle : AR.cashHeldTitle}
            </h2>
            <p className={classes.OverlaySubtitle}>
                {outcome === 'not-closed' ? AR.cashPaidNotClosedHint : AR.cashHeldHint}
            </p>

            <div className={classes.DueAmount} dir="ltr">
                {config.currencySymbol} {fmt(amount)}
            </div>
            <p className={classes.OverlaySubtitle}>{AR.cashHeldAmount}</p>

            {cashdroId && (
                <p className={classes.OverlaySubtitle} dir="ltr">
                    {AR.cashHeldReference}: {cashdroId}
                </p>
            )}

            <button type="button" className={classes.OverlayCancel} onClick={onStaffOverride}>
                <FontAwesomeIcon icon={faUserShield} />
                {AR.staffClearHold}
            </button>
        </div>
    </div>
);

export default SelfServiceCashHeldScreen;
