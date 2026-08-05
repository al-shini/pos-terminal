import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faMinus, faTimes, faCheck } from '@fortawesome/free-solid-svg-icons';
import classes from './SelfServiceView.module.css';
import AR from './i18n';

const MIN_QTY = 1;
const MAX_QTY = 30; // kiosk sanity cap
const PRESETS = [2, 3, 4, 5, 6, 10];

/**
 * Quantity multiplier picker for self-checkout. The chosen quantity arms
 * trxSlice.multiplier for the NEXT scan (same mechanism as the cashier
 * QTY-Multiplier), then auto-resets to 1 after that scan lands.
 */
const SelfServiceQtyPicker = ({ initial, onConfirm, onCancel }) => {
    const [qty, setQty] = useState(Math.max(MIN_QTY, Math.min(MAX_QTY, Number(initial) || 1)));

    const bump = (delta) => setQty((q) => Math.max(MIN_QTY, Math.min(MAX_QTY, q + delta)));

    return (
        <div className={classes.Overlay} dir="rtl">
            <div className={`${classes.OverlayPanel} ${classes.QtyPanel}`}>
                <h2 className={classes.OverlayTitle}>{AR.qtyTitle}</h2>
                <p className={classes.OverlaySubtitle}>{AR.qtyHint}</p>

                <div className={classes.QtyStepper} dir="ltr">
                    <button
                        type="button"
                        className={classes.QtyStepBtn}
                        onClick={() => bump(-1)}
                        disabled={qty <= MIN_QTY}
                        aria-label="-"
                    >
                        <FontAwesomeIcon icon={faMinus} />
                    </button>
                    <div className={classes.QtyValue}>×{qty}</div>
                    <button
                        type="button"
                        className={classes.QtyStepBtn}
                        onClick={() => bump(1)}
                        disabled={qty >= MAX_QTY}
                        aria-label="+"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                    </button>
                </div>

                <div className={classes.QtyPresets}>
                    {PRESETS.map((n) => (
                        <button
                            key={n}
                            type="button"
                            className={`${classes.QtyPresetBtn} ${qty === n ? classes.QtyPresetBtnActive : ''}`}
                            onClick={() => setQty(n)}
                        >
                            ×{n}
                        </button>
                    ))}
                </div>

                <div className={classes.StaffMenuActions}>
                    <button
                        type="button"
                        className={`${classes.StaffMenuBtn} ${classes.QtyConfirmBtn}`}
                        onClick={() => onConfirm(qty)}
                    >
                        <FontAwesomeIcon icon={faCheck} />
                        {AR.qtyConfirm}
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

export default SelfServiceQtyPicker;
