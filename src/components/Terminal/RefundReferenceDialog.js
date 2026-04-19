import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { faReceipt } from '@fortawesome/free-solid-svg-icons';
import CustomerFieldDialog from './CustomerFieldDialog';
import {
    validateRefundReference,
    setOriginalTrxReference,
} from '../../store/trxSlice';

/**
 * Modern refund reference dialog — asks the cashier to scan / type the
 * serial number of the original receipt before entering refund mode.
 *
 * Reuses the shared CustomerFieldDialog (numeric mode) so the POS dialogs
 * stay visually consistent. Two extra features from the shared dialog are
 * used here:
 *   - `alert`       -> inline banner for errors and the already-refunded
 *                      warning case
 *   - `saveVariant` -> switches the save button to the amber "warning"
 *                      style when the user has to confirm a "Proceed
 *                      Anyway" after the warning is shown
 */
const RefundReferenceDialog = ({ open, onClose, onValidated }) => {
    const dispatch = useDispatch();

    const [serialNumber, setSerialNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [warning, setWarning] = useState('');
    const [validatedTransaction, setValidatedTransaction] = useState(null);

    useEffect(() => {
        if (open) {
            setSerialNumber('');
            setError('');
            setWarning('');
            setValidatedTransaction(null);
            setLoading(false);
        }
    }, [open]);

    const resetMessages = () => {
        if (error) setError('');
        if (warning) {
            setWarning('');
            setValidatedTransaction(null);
        }
    };

    const handleChange = (next) => {
        if (loading) return;
        setSerialNumber(next);
        resetMessages();
    };

    const handleValidate = async () => {
        const trimmed = (serialNumber || '').trim();
        if (!trimmed) {
            setError('Please enter the serial number from the original receipt.');
            return;
        }

        setLoading(true);
        setError('');
        setWarning('');

        try {
            const result = await dispatch(
                validateRefundReference({ serialNumber: trimmed })
            );

            if (validateRefundReference.fulfilled.match(result)) {
                if (result.payload.errorCode === 'ALREADY_REFUNDED_WARNING') {
                    setWarning(
                        result.payload.message ||
                            'This transaction has already been refunded. You may proceed if this is intentional.'
                    );
                    setValidatedTransaction(result.payload.originalTransaction);
                } else {
                    dispatch(setOriginalTrxReference(result.payload.originalTransaction));
                    onValidated(result.payload.originalTransaction);
                    onClose();
                }
            } else {
                setError(result.payload?.message || 'Validation failed.');
            }
        } catch (err) {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleProceedWithWarning = () => {
        if (!validatedTransaction) return;
        dispatch(setOriginalTrxReference(validatedTransaction));
        onValidated(validatedTransaction);
        onClose();
    };

    const handleCancel = () => {
        if (loading) return;
        onClose();
    };

    const alert = useMemo(() => {
        if (error) return { severity: 'error', message: error };
        if (warning) return { severity: 'warning', message: warning };
        return null;
    }, [error, warning]);

    const isWarningMode = Boolean(warning && validatedTransaction);

    return (
        <CustomerFieldDialog
            open={open}
            onClose={handleCancel}
            onCancel={handleCancel}
            title="Original Transaction"
            subtitle="Enter the serial number from the original receipt"
            icon={faReceipt}
            mode="numeric"
            value={serialNumber}
            onChange={handleChange}
            onSave={isWarningMode ? handleProceedWithWarning : handleValidate}
            placeholder="e.g. 123456"
            maxLength={20}
            saveLabel={
                loading
                    ? 'Validating…'
                    : isWarningMode
                    ? 'Proceed Anyway'
                    : 'Validate'
            }
            cancelLabel="Cancel"
            saveDisabled={!(serialNumber || '').trim()}
            saveLoading={loading}
            saveVariant={isWarningMode ? 'warning' : 'primary'}
            alert={alert}
            dialogMaxWidth="sm"
        />
    );
};

export default RefundReferenceDialog;
