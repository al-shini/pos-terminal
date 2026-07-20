import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoneyBill, faCreditCard, faTimes } from '@fortawesome/free-solid-svg-icons';
import classes from './SelfServiceView.module.css';
import config from '../../../config';

const fmt = (n) => (((Number(n) || 0) * 100) / 100).toFixed(config.decimals);

/**
 * Pay modal — two giant tiles: Cash (CashDro) and Card (disabled by default).
 */
const SelfServicePayModal = ({ amountDue, onCash, onCancel, cardEnabled }) => {
    const enabled = cardEnabled || config.features.selfServiceCardEnabled;

    return (
        <div className={classes.Overlay}>
            <div className={classes.OverlayFull}>
                <h2 className={classes.OverlayTitle}>How would you like to pay?</h2>
                <div className={classes.DueAmount}>
                    {config.currencySymbol} {fmt(amountDue)}
                </div>
                <p className={classes.OverlaySubtitle}>Amount due</p>

                <div className={classes.PayTiles}>
                    <button type="button" className={`${classes.PayTile} ${classes.PayTileCash}`} onClick={onCash}>
                        <FontAwesomeIcon icon={faMoneyBill} className={classes.PayTileIcon} />
                        <span className={classes.PayTileLabel}>Cash</span>
                        <span className={classes.PayTileNote}>Insert cash into the machine</span>
                    </button>

                    <button
                        type="button"
                        className={`${classes.PayTile} ${classes.PayTileCard}`}
                        disabled={!enabled}
                        onClick={() => { /* reserved for future card flow */ }}
                        title={enabled ? 'Card' : 'Card payment disabled temporarily'}
                    >
                        <FontAwesomeIcon icon={faCreditCard} className={classes.PayTileIcon} />
                        <span className={classes.PayTileLabel}>Card</span>
                        {!enabled && (
                            <span className={classes.PayTileNote}>
                                Card payment disabled temporarily
                            </span>
                        )}
                    </button>
                </div>

                <button type="button" className={classes.OverlayCancel} onClick={onCancel}>
                    <FontAwesomeIcon icon={faTimes} />
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default SelfServicePayModal;
