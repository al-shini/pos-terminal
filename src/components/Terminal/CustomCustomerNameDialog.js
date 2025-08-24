import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box } from '@mui/material';
import AlphabetKeyboard from './AlphabetKeyboard';
import { useDispatch, useSelector } from 'react-redux';
import { setCustomCustomerName } from '../../store/trxSlice';

const CustomCustomerNameDialog = ({ open, onClose }) => {
    const dispatch = useDispatch();
    const trxSlice = useSelector((state) => state.trx);
    const [customerName, setCustomerName] = useState('');

    useEffect(() => {
        if (open) {
            // Initialize with existing custom customer name if any
            setCustomerName(trxSlice.trx?.customCustomerName || '');
        }
    }, [open, trxSlice.trx?.customCustomerName]);

    const handleKeyPress = (key) => {
        if (key === 'backspace') {
            setCustomerName(prev => prev.slice(0, -1));
        } else {
            setCustomerName(prev => prev + key);
        }
    };

    const handleSave = () => {
        const trimmedName = customerName.trim();
        if (trimmedName && trxSlice.trx?.key) {
            // Dispatch action to update custom customer name
            dispatch(setCustomCustomerName({
                trxKey: trxSlice.trx.key,
                customerName: trimmedName
            }));
        }
        onClose();
    };

    const handleCancel = () => {
        setCustomerName(trxSlice.trx?.customCustomerName || '');
        onClose();
    };

    return (
        <Dialog 
            open={open} 
            onClose={handleCancel}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: { 
                    minHeight: '70vh',
                    backgroundColor: '#f8f9fa'
                }
            }}
        >
            <DialogTitle sx={{ 
                textAlign: 'center', 
                fontSize: '24px', 
                fontWeight: 'bold',
                color: '#1976d2',
                borderBottom: '2px solid #e0e0e0',
                pb: 2
            }}>
                Custom Customer Name
            </DialogTitle>
            <DialogContent sx={{ p: 3 }}>
                <AlphabetKeyboard
                    onKeyPress={handleKeyPress}
                    onSave={handleSave}
                    onCancel={handleCancel}
                    currentValue={customerName}
                    disabled={!trxSlice.trx?.key}
                />
            </DialogContent>
        </Dialog>
    );
};

export default CustomCustomerNameDialog; 