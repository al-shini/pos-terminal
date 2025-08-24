import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Typography,
    Box,
    CircularProgress,
    Alert
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { validateRefundReference, setOriginalTrxReference } from '../../store/trxSlice';
import NumericKeyboard from './NumericKeyboard';

const RefundReferenceDialog = ({ open, onClose, onValidated }) => {
    const dispatch = useDispatch();
    const [serialNumber, setSerialNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [warning, setWarning] = useState('');
    const [validatedTransaction, setValidatedTransaction] = useState(null);

    const handleValidate = async () => {
        if (!serialNumber.trim()) {
            setError('Please enter a serial number');
            return;
        }

        setLoading(true);
        setError('');
        setWarning('');

        try {
            const result = await dispatch(validateRefundReference({ serialNumber: serialNumber.trim() }));
            
            if (validateRefundReference.fulfilled.match(result)) {
                // Check if it's a warning case
                if (result.payload.errorCode === 'ALREADY_REFUNDED_WARNING') {
                    setWarning(result.payload.message);
                    setValidatedTransaction(result.payload.originalTransaction);
                } else {
                    // Normal validation successful
                    dispatch(setOriginalTrxReference(result.payload.originalTransaction));
                    onValidated(result.payload.originalTransaction);
                    onClose();
                    setSerialNumber('');
                }
            } else {
                // Validation failed
                setError(result.payload?.message || 'Validation failed');
            }
        } catch (err) {
            setError('Unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleProceedWithWarning = () => {
        if (validatedTransaction) {
            dispatch(setOriginalTrxReference(validatedTransaction));
            onValidated(validatedTransaction);
            onClose();
            setSerialNumber('');
            setWarning('');
            setValidatedTransaction(null);
        }
    };

    const handleClose = () => {
        setSerialNumber('');
        setError('');
        setWarning('');
        setValidatedTransaction(null);
        setLoading(false);
        onClose();
    };

    const handleKeyboardInput = (key) => {
        if (loading) return;

        if (key === 'backspace') {
            setSerialNumber(prev => prev.slice(0, -1));
        } else {
            // Only allow digits
            if (/^[0-9]$/.test(key)) {
                setSerialNumber(prev => prev + key);
            }
        }
        
        // Clear error and warning when user starts typing
        if (error) {
            setError('');
        }
        if (warning) {
            setWarning('');
            setValidatedTransaction(null);
        }
    };

    // Prevent physical keyboard input
    const handleKeyDown = (event) => {
        event.preventDefault();
    };

    const handleTextFieldChange = (event) => {
        // Prevent any changes from physical keyboard
        event.preventDefault();
    };

    return (
        <Dialog 
            open={open} 
            onClose={handleClose}
            maxWidth="xs"
            
            disableEscapeKeyDown={loading}
            PaperProps={{
                sx: {
                    minHeight: '600px',
                    borderRadius: '16px'
                }
            }}
        >
            <DialogTitle sx={{ pb: 1 }}>
                <Typography variant="h5" component="div" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                    Enter Original Transaction Serial Number
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                    Use the keypad below to enter the serial number from the original receipt
                </Typography>
            </DialogTitle>
            
            <DialogContent sx={{ px: 3, py: 2 }}>
                <Box sx={{ mt: 1 }}>
                    <TextField
                        fullWidth
                        label="Serial Number"
                        variant="outlined"
                        value={serialNumber}
                        onChange={handleTextFieldChange}
                        onKeyDown={handleKeyDown}
                        disabled={loading}
                        error={!!error}
                        helperText={error}
                        placeholder="e.g., 123456"
                        InputProps={{
                            readOnly: true,
                            style: {
                                fontSize: '24px',
                                fontWeight: 'bold',
                                textAlign: 'center',
                                letterSpacing: '3px',
                                height: '60px'
                            }
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: '#f8f9fa',
                                border: '3px solid #e3f2fd',
                                borderRadius: '12px',
                                '&:hover': {
                                    borderColor: '#bbdefb'
                                },
                                '&.Mui-focused': {
                                    borderColor: '#2196f3'
                                }
                            },
                            '& .MuiInputLabel-root': {
                                fontSize: '18px',
                                fontWeight: 'bold'
                            }
                        }}
                    />
                </Box>

                {warning && (
                    <Box sx={{ mt: 2 }}>
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            {warning}
                        </Alert>
                    </Box>
                )}

                <NumericKeyboard 
                    onKeyPress={handleKeyboardInput}
                    disabled={loading}
                />
            </DialogContent>
            
            <DialogActions sx={{ px: 3, py: 2, gap: 2 }}>
                <Button 
                    onClick={handleClose} 
                    disabled={loading}
                    color="secondary"
                    size="large"
                    variant="outlined"
                    sx={{ 
                        minHeight: 50,
                        px: 4,
                        fontSize: '16px',
                        fontWeight: 'bold'
                    }}
                >
                    Cancel
                </Button>
                
                {warning ? (
                    <Button 
                        onClick={handleProceedWithWarning} 
                        variant="contained"
                        color="warning"
                        size="large"
                        sx={{ 
                            minHeight: 50,
                            px: 4,
                            fontSize: '16px',
                            fontWeight: 'bold'
                        }}
                    >
                        Proceed Anyway
                    </Button>
                ) : (
                    <Button 
                        onClick={handleValidate} 
                        disabled={loading || !serialNumber.trim()}
                        variant="contained"
                        color="primary"
                        size="large"
                        startIcon={loading ? <CircularProgress size={20} /> : null}
                        sx={{ 
                            minHeight: 50,
                            px: 4,
                            fontSize: '16px',
                            fontWeight: 'bold'
                        }}
                    >
                        {loading ? 'Validating...' : 'Validate'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default RefundReferenceDialog; 