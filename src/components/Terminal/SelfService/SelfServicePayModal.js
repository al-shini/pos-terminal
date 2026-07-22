import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoneyBill, faCreditCard, faTimes } from '@fortawesome/free-solid-svg-icons';
import classes from './SelfServiceView.module.css';
import config from '../../../config';
import AR from './i18n';

const fmt = (n) => (((Number(n) || 0) * 100) / 100).toFixed(config.decimals);

/**
 * Pay modal — two giant tiles: Cash (CashDro) and Card (disabled by default).
 */
const SelfServicePayModal = ({ amountDue, onCash, onCancel, cardEnabled }) => {
    const enabled = cardEnabled || config.features.selfServiceCardEnabled;

    return (
        <div className={classes.Overlay} dir="rtl">
            <div className={classes.OverlayFull}>
                <h2 className={classes.OverlayTitle}>{AR.howToPay}</h2>
                <div className={classes.DueAmount} dir="ltr">
                    {config.currencySymbol} {fmt(amountDue)}
                </div>
                <p className={classes.OverlaySubtitle}>{AR.amountDue}</p>

                <div className={classes.PayTiles}>
                    <button type="button" className={`${classes.PayTile} ${classes.PayTileCash}`} onClick={onCash}>
                        <FontAwesomeIcon icon={faMoneyBill} className={classes.PayTileIcon} />
                        <span className={classes.PayTileLabel}>{AR.cash}</span>
                        <span className={classes.PayTileNote}>{AR.cashNote}</span>
                    </button>

                    <button
                        type="button"
                        className={`${classes.PayTile} ${classes.PayTileCard}`}
                        disabled={!enabled}
                        onClick={() => { /* reserved for future card flow */ }}
                        title={enabled ? AR.card : AR.cardDisabled}
                    >
                        <FontAwesomeIcon icon={faCreditCard} className={classes.PayTileIcon} />
                        <span className={classes.PayTileLabel}>{AR.card}</span>
                        {!enabled && (
                            <span className={classes.PayTileNote}>
                                {AR.cardDisabled}
                            </span>
                        )}
                    </button>
                </div>

                <button type="button" className={classes.OverlayCancel} onClick={onCancel}>
                    <FontAwesomeIcon icon={faTimes} />
                    {AR.cancel}
                </button>
            </div>
        </div>
    );
};

export default SelfServicePayModal;
