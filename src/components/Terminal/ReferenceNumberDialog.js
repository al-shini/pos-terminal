import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { faHashtag } from '@fortawesome/free-solid-svg-icons';
import CustomerFieldDialog from './CustomerFieldDialog';
import { setReferenceNumber } from '../../store/trxSlice';
import { notify } from '../../store/uiSlice';

/**
 * Reference number entry dialog (numeric). Reference numbers are free-form
 * identifiers the cashier can attach to a transaction (e.g. external order
 * number, delivery order id, invoice cross-ref).
 */
const ReferenceNumberDialog = ({ open, onClose }) => {
    const dispatch = useDispatch();
    const trxSlice = useSelector((state) => state.trx);
    const [reference, setReference] = useState('');

    useEffect(() => {
        if (open) {
            setReference(trxSlice.trx?.referenceNumber || '');
        }
    }, [open, trxSlice.trx?.referenceNumber]);

    const handleSave = () => {
        if (!trxSlice.trx?.key) {
            onClose();
            return;
        }
        const trimmed = (reference || '').trim();
        if (!trimmed) {
            dispatch(
                notify({ msg: 'Please enter a reference number', sev: 'error' })
            );
            return;
        }
        dispatch(
            setReferenceNumber({
                trxKey: trxSlice.trx.key,
                referenceNumber: trimmed,
            })
        );
        onClose();
    };

    const handleCancel = () => {
        setReference(trxSlice.trx?.referenceNumber || '');
        onClose();
    };

    return (
        <CustomerFieldDialog
            open={open}
            onClose={handleCancel}
            onCancel={handleCancel}
            title="Reference Number"
            subtitle="Link an external reference to this transaction"
            icon={faHashtag}
            mode="numeric"
            value={reference}
            onChange={setReference}
            onSave={handleSave}
            placeholder="Enter reference number"
            maxLength={20}
            saveDisabled={!trxSlice.trx?.key || !(reference || '').trim()}
            dialogMaxWidth="sm"
        />
    );
};

export default ReferenceNumberDialog;
