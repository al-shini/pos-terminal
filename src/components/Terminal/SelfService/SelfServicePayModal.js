import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoneyBill, faCreditCard, faTimes, faSpinner } from '@fortawesome/free-solid-svg-icons';
import classes from './SelfServiceView.module.css';
import config from '../../../config';
import AR from './i18n';

const fmt = (n) => (((Number(n) || 0) * 100) / 100).toFixed(config.decimals);

/**
 * Pay modal — Cash (CashDro) or Visa, and nothing else.
 *
 * A self-service sale is settled by exactly one tender for its full amount.
 * Splitting a sale across tenders used to be possible here via a per-tile
 * partial-amount keypad; it was removed because a customer paying part of a
 * bill in cash gets the rest of their note back as change, which reads as the
 * machine having handed back the wrong amount, and it leaves a sale sitting
 * half-paid with cash already in the drawer.
 *
 * The Visa tile behaves differently depending on the station: with a BOP card
 * reader linked (`cardTerminalLinked`) the customer pays on the reader, and
 * without one a supervisor/head cashier scans an authorized QR on this screen
 * and charges the card on their own terminal.
 */
const SelfServicePayModal = ({ amountDue, onCash, onVisa, onCancel, cashStarting, cardTerminalLinked }) => {
    // While the cash session is being opened this modal stays up to cover the
    // wait, so it has to look busy — otherwise it reads as an unresponsive
    // screen and invites a second tap on a machine that is already starting.
    const tileClass = (extra) => [
        classes.PayTile,
        extra,
        cashStarting ? classes.PayTileBusy : ''
    ].filter(Boolean).join(' ');

    return (
        <div className={classes.Overlay} dir="rtl">
            <div className={classes.OverlayFull}>
                <h2 className={classes.OverlayTitle}>{AR.howToPay}</h2>
                <div className={classes.DueAmount} dir="ltr">
                    {config.currencySymbol} {fmt(amountDue)}
                </div>
                <p className={classes.OverlaySubtitle}>{AR.amountDue}</p>

                <div className={classes.PayTiles}>
                    <div
                        className={tileClass(classes.PayTileCash)}
                        onClick={cashStarting ? undefined : onCash}
                        role="button"
                        tabIndex={0}
                        aria-busy={!!cashStarting}
                    >
                        <FontAwesomeIcon
                            icon={cashStarting ? faSpinner : faMoneyBill}
                            spin={!!cashStarting}
                            className={classes.PayTileIcon}
                        />
                        <span className={classes.PayTileLabel}>{AR.cash}</span>
                        <span className={classes.PayTileNote}>
                            {cashStarting ? AR.cashPreparing : AR.cashNote}
                        </span>
                    </div>

                    <div
                        className={tileClass(classes.PayTileCard)}
                        onClick={cashStarting ? undefined : onVisa}
                        role="button"
                        tabIndex={0}
                        title={AR.visa}
                    >
                        <FontAwesomeIcon icon={faCreditCard} className={classes.PayTileIcon} />
                        <span className={classes.PayTileLabel}>{AR.visa}</span>
                        <span className={classes.PayTileNote}>
                            {cardTerminalLinked ? AR.visaNoteTerminal : AR.visaNote}
                        </span>
                    </div>
                </div>

                <button
                    type="button"
                    className={classes.OverlayCancel}
                    onClick={onCancel}
                    disabled={!!cashStarting}
                >
                    <FontAwesomeIcon icon={faTimes} />
                    {AR.cancel}
                </button>
            </div>
        </div>
    );
};

export default SelfServicePayModal;
