import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faDeleteLeft, faTimes, faBarcode, faCheck
} from '@fortawesome/free-solid-svg-icons';
import classes from './SelfServiceView.module.css';
import AR from './i18n';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];

/**
 * On-screen keypad for typing a barcode manually — for when a label is
 * damaged, unreadable, or the customer prefers not to use the scanner.
 */
const SelfServiceKeypad = ({ onSubmit, onCancel }) => {
    const [value, setValue] = useState('');

    const pressKey = (key) => {
        if (key === 'back') {
            setValue((v) => v.slice(0, -1));
        } else if (key === 'clear') {
            setValue('');
        } else {
            setValue((v) => (v.length < 20 ? v + key : v));
        }
    };

    const submit = () => {
        if (!value) return;
        onSubmit(value);
        setValue('');
    };

    return (
        <div className={classes.Overlay} dir="rtl">
            <div className={`${classes.OverlayPanel} ${classes.KeypadPanel}`}>
                <h2 className={classes.OverlayTitle}>
                    <FontAwesomeIcon icon={faBarcode} style={{ marginLeft: 10, color: '#E32521' }} />
                    {AR.typeBarcodeTitle}
                </h2>
                <p className={classes.OverlaySubtitle}>
                    {AR.typeBarcodeHint}
                </p>

                <div className={classes.KeypadDisplay} dir="ltr">
                    {value || <span className={classes.KeypadPlaceholder}>{AR.keypadPlaceholder}</span>}
                </div>

                <div className={classes.KeypadGrid}>
                    {KEYS.map((k) => {
                        if (k === 'back') {
                            return (
                                <button
                                    key={k}
                                    type="button"
                                    className={`${classes.KeypadKey} ${classes.KeypadKeyMuted}`}
                                    onClick={() => pressKey(k)}
                                >
                                    <FontAwesomeIcon icon={faDeleteLeft} />
                                </button>
                            );
                        }
                        if (k === 'clear') {
                            return (
                                <button
                                    key={k}
                                    type="button"
                                    className={`${classes.KeypadKey} ${classes.KeypadKeyMuted}`}
                                    onClick={() => pressKey(k)}
                                >
                                    C
                                </button>
                            );
                        }
                        return (
                            <button
                                key={k}
                                type="button"
                                className={classes.KeypadKey}
                                onClick={() => pressKey(k)}
                            >
                                {k}
                            </button>
                        );
                    })}
                </div>

                <div className={classes.KeypadActions}>
                    <button type="button" className={classes.OverlayCancel} onClick={onCancel}>
                        <FontAwesomeIcon icon={faTimes} />
                        {AR.cancel}
                    </button>
                    <button
                        type="button"
                        className={`${classes.KeypadKey} ${classes.KeypadSubmit}`}
                        disabled={!value}
                        onClick={submit}
                    >
                        <FontAwesomeIcon icon={faCheck} />
                        {AR.addItem}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SelfServiceKeypad;
