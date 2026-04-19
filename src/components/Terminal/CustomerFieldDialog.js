import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCheck,
    faXmark,
    faDeleteLeft,
    faEraser,
    faLock,
    faCircleExclamation,
    faTriangleExclamation,
    faCircleInfo,
    faCircleCheck,
    faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import classes from './CustomerFieldDialog.module.css';

/**
 * Reusable modern entry dialog for the POS terminal.
 *
 * Modes:
 *  - "alphabet" -> renders the child keyboard (e.g. <AlphabetKeyboard />).
 *                  Parent owns the value and passes it back via onSave.
 *  - "numeric"  -> renders the built-in on-screen numpad.
 *
 * For both modes, this component only *displays* the value — the caller owns
 * the state via `value` + `onChange` (numeric) or passes its own keyboard
 * (alphabet).
 */
const CustomerFieldDialog = ({
    open,
    onClose,
    title,
    subtitle,
    icon,
    mode = 'alphabet',
    value = '',
    onChange,
    onSave,
    onCancel,
    placeholder = '',
    maxLength = null,
    locked = false,
    lockedMessage = null,
    saveDisabled = false,
    saveLabel = 'Save',
    cancelLabel = 'Cancel',
    saveVariant = 'primary',
    saveLoading = false,
    alert = null,
    children,
    dialogMaxWidth = 'sm',
}) => {
    const isNumeric = mode === 'numeric';

    const alertMeta = useMemo(() => {
        if (!alert || !alert.message) return null;
        const severity = alert.severity || 'info';
        const iconMap = {
            error: faCircleExclamation,
            warning: faTriangleExclamation,
            info: faCircleInfo,
            success: faCircleCheck,
        };
        const classMap = {
            error: classes.AlertError,
            warning: classes.AlertWarning,
            info: classes.AlertInfo,
            success: classes.AlertSuccess,
        };
        return {
            severity,
            message: alert.message,
            icon: iconMap[severity] || faCircleInfo,
            cls: classMap[severity] || classes.AlertInfo,
        };
    }, [alert]);

    const handleNumericKey = (key) => {
        if (locked || !onChange) return;
        if (key === 'back') {
            onChange(value.slice(0, -1));
            return;
        }
        if (key === 'clear') {
            onChange('');
            return;
        }
        if (maxLength && value.length >= maxLength) return;
        onChange((value || '') + key);
    };

    const handleCancel = () => {
        if (onCancel) onCancel();
        else onClose && onClose();
    };

    const numericKeys = useMemo(() => ['1', '2', '3', '4', '5', '6', '7', '8', '9'], []);

    const trimmed = (value || '').trim();

    return (
        <Dialog
            open={open}
            onClose={handleCancel}
            maxWidth={dialogMaxWidth}
            fullWidth
            PaperProps={{ className: classes.Paper }}
        >
            <DialogTitle className={classes.Header} sx={{ p: 0 }}>
                <div className={classes.HeaderRow}>
                    {icon && (
                        <div className={classes.IconBadge}>
                            <FontAwesomeIcon icon={icon} />
                        </div>
                    )}
                    <div className={classes.HeaderText}>
                        <span className={classes.Title}>{title}</span>
                        {subtitle && <span className={classes.Subtitle}>{subtitle}</span>}
                    </div>
                    {locked && (
                        <div className={classes.LockBadge}>
                            <FontAwesomeIcon icon={faLock} />
                            {lockedMessage || 'Locked'}
                        </div>
                    )}
                </div>
            </DialogTitle>

            <DialogContent className={classes.Content}>
                {/* Display screen */}
                <div className={classes.Display}>
                    <div
                        className={[
                            classes.DisplayValue,
                            isNumeric ? classes.DisplayValueNumeric : classes.DisplayValueAlphabet,
                        ].join(' ')}
                    >
                        {value && value.length > 0 ? (
                            <>
                                {value}
                                <span className={classes.Caret} />
                            </>
                        ) : (
                            <span className={classes.DisplayPlaceholder}>{placeholder}</span>
                        )}
                    </div>
                </div>

                <div className={classes.HintRow}>
                    <span>{locked ? (lockedMessage || 'This field is locked') : ' '}</span>
                    {maxLength && (
                        <span className={classes.CharCount}>
                            {trimmed.length}/{maxLength}
                        </span>
                    )}
                </div>

                {alertMeta && (
                    <div className={[classes.Alert, alertMeta.cls].join(' ')} role="alert">
                        <FontAwesomeIcon icon={alertMeta.icon} className={classes.AlertIcon} />
                        <span className={classes.AlertMessage}>{alertMeta.message}</span>
                    </div>
                )}

                {/* Keyboard */}
                {isNumeric ? (
                    <div className={classes.NumKeyboard}>
                        {numericKeys.map((k) => (
                            <button
                                key={k}
                                type="button"
                                className={classes.NumKey}
                                disabled={locked || (maxLength && value.length >= maxLength)}
                                onClick={() => handleNumericKey(k)}
                            >
                                {k}
                            </button>
                        ))}
                        <button
                            type="button"
                            className={[classes.NumKey, classes.NumKeyClear, classes.NumKeyAction].join(' ')}
                            disabled={locked || !value}
                            onClick={() => handleNumericKey('clear')}
                        >
                            <FontAwesomeIcon icon={faEraser} />
                            Clear
                        </button>
                        <button
                            key="0"
                            type="button"
                            className={classes.NumKey}
                            disabled={locked || (maxLength && value.length >= maxLength)}
                            onClick={() => handleNumericKey('0')}
                        >
                            0
                        </button>
                        <button
                            type="button"
                            className={[classes.NumKey, classes.NumKeyBackspace, classes.NumKeyAction].join(' ')}
                            disabled={locked || !value}
                            onClick={() => handleNumericKey('back')}
                        >
                            <FontAwesomeIcon icon={faDeleteLeft} />
                        </button>
                    </div>
                ) : (
                    children
                )}
            </DialogContent>

            {/* Actions — numeric mode renders them here;
                alphabet mode callers render their own via children */}
            {isNumeric && (
                <DialogActions className={classes.Footer} sx={{ p: 0, m: 0 }}>
                    <div className={classes.Actions} style={{ padding: '0 18px 16px 18px', width: '100%' }}>
                        <button
                            type="button"
                            className={classes.BtnCancel}
                            onClick={handleCancel}
                            disabled={saveLoading}
                        >
                            <FontAwesomeIcon icon={faXmark} />
                            {cancelLabel}
                        </button>
                        <button
                            type="button"
                            className={[
                                classes.BtnSave,
                                saveVariant === 'warning' ? classes.BtnSaveWarning : '',
                            ].join(' ')}
                            disabled={locked || saveDisabled || saveLoading}
                            onClick={() => onSave && onSave()}
                        >
                            <FontAwesomeIcon
                                icon={saveLoading ? faSpinner : faCheck}
                                spin={saveLoading}
                            />
                            {saveLabel}
                        </button>
                    </div>
                </DialogActions>
            )}
        </Dialog>
    );
};

export default CustomerFieldDialog;
