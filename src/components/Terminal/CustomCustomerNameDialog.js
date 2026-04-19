import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { faUser } from '@fortawesome/free-solid-svg-icons';
import CustomerFieldDialog from './CustomerFieldDialog';
import AlphabetKeyboard from './AlphabetKeyboard';
import { setCustomCustomerName } from '../../store/trxSlice';

const CustomCustomerNameDialog = ({ open, onClose }) => {
    const dispatch = useDispatch();
    const trxSlice = useSelector((state) => state.trx);
    const [customerName, setCustomerName] = useState('');

    useEffect(() => {
        if (open) {
            setCustomerName(trxSlice.trx?.customCustomerName || '');
        }
    }, [open, trxSlice.trx?.customCustomerName]);

    const handleKeyPress = (key) => {
        if (key === 'backspace') {
            setCustomerName((prev) => prev.slice(0, -1));
        } else {
            setCustomerName((prev) => prev + key);
        }
    };

    const handleSave = () => {
        const trimmedName = customerName.trim();
        if (trimmedName && trxSlice.trx?.key) {
            dispatch(
                setCustomCustomerName({
                    trxKey: trxSlice.trx.key,
                    customerName: trimmedName,
                })
            );
        }
        onClose();
    };

    const handleCancel = () => {
        setCustomerName(trxSlice.trx?.customCustomerName || '');
        onClose();
    };

    return (
        <CustomerFieldDialog
            open={open}
            onClose={handleCancel}
            onCancel={handleCancel}
            title="Customer Name"
            subtitle="Enter a custom name for this transaction"
            icon={faUser}
            mode="alphabet"
            value={customerName}
            placeholder="اسم العميل / Customer Name"
            maxLength={60}
        >
            <AlphabetKeyboard
                minimal
                onKeyPress={handleKeyPress}
                onSave={handleSave}
                onCancel={handleCancel}
                currentValue={customerName}
                disabled={!trxSlice.trx?.key}
            />
        </CustomerFieldDialog>
    );
};

export default CustomCustomerNameDialog;
