import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { faMobileScreenButton } from '@fortawesome/free-solid-svg-icons';
import CustomerFieldDialog from './CustomerFieldDialog';
import { setCustomCustomerMobile } from '../../store/trxSlice';
import { notify } from '../../store/uiSlice';

/**
 * Custom customer mobile entry dialog (numeric).
 *
 * NOTE: If the transaction has a scanned club customer (terminal.customer.club
 * === true), the mobile number is taken from the club profile and this dialog
 * must NOT override it. The dialog renders a locked state in that case.
 */
const CustomCustomerMobileDialog = ({ open, onClose }) => {
    const dispatch = useDispatch();
    const trxSlice = useSelector((state) => state.trx);
    const terminal = useSelector((state) => state.terminal);
    const [mobile, setMobile] = useState('');

    const isClubLocked = useMemo(
        () => Boolean(terminal.customer && terminal.customer.club),
        [terminal.customer]
    );

    useEffect(() => {
        if (open) {
            setMobile(trxSlice.trx?.customCustomerMobile || '');
        }
    }, [open, trxSlice.trx?.customCustomerMobile]);

    const handleSave = () => {
        const trimmed = (mobile || '').trim();
        if (isClubLocked) {
            dispatch(
                notify({
                    msg: 'Club customer is scanned — mobile number is managed by the club profile.',
                    sev: 'warning',
                })
            );
            onClose();
            return;
        }
        if (!trxSlice.trx?.key) {
            onClose();
            return;
        }
        if (!trimmed) {
            dispatch(
                notify({ msg: 'Please enter a mobile number', sev: 'error' })
            );
            return;
        }
        dispatch(
            setCustomCustomerMobile({
                trxKey: trxSlice.trx.key,
                customerMobile: trimmed,
            })
        );
        onClose();
    };

    const handleCancel = () => {
        setMobile(trxSlice.trx?.customCustomerMobile || '');
        onClose();
    };

    return (
        <CustomerFieldDialog
            open={open}
            onClose={handleCancel}
            onCancel={handleCancel}
            title="Customer Mobile"
            subtitle="Attach a mobile number to this transaction"
            icon={faMobileScreenButton}
            mode="numeric"
            value={mobile}
            onChange={setMobile}
            onSave={handleSave}
            placeholder="Enter mobile number"
            maxLength={15}
            locked={isClubLocked}
            lockedMessage="Club customer scanned"
            saveDisabled={!trxSlice.trx?.key || !(mobile || '').trim()}
            dialogMaxWidth="sm"
        />
    );
};

export default CustomCustomerMobileDialog;
