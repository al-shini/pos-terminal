import React, { useState } from 'react';
import { Grid, Button, Box, Typography, ButtonGroup } from '@mui/material';
import { Backspace, Language } from '@mui/icons-material';

const AlphabetKeyboard = ({ onKeyPress, disabled = false, onSave, onCancel, currentValue = '', minimal = false }) => {
    const [isArabic, setIsArabic] = useState(true);
    
    const arabicKeys = [
        ['ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ'],
        ['ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع'],
        ['غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و'],
        ['ي', 'space', 'backspace']
    ];

    const englishKeys = [
        ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
        ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
        ['space', 'backspace']
    ];

    const currentKeys = isArabic ? arabicKeys : englishKeys;

    const handleKeyPress = (key) => {
        if (disabled) return;
        onKeyPress(key);
    };

    const renderKey = (key) => {
        if (key === 'backspace') {
            return (
                <Button
                    key={key}
                    variant="outlined"
                    size={minimal ? 'medium' : 'large'}
                    onClick={() => handleKeyPress(key)}
                    disabled={disabled}
                    sx={minimal ? {
                        minHeight: 40,
                        minWidth: 56,
                        fontSize: '13px',
                        fontWeight: 700,
                        margin: 0.25,
                        padding: 0,
                        borderRadius: '8px',
                        background: 'linear-gradient(180deg, #FFFFFF 0%, #FEF2F2 100%)',
                        border: '1px solid rgba(220, 38, 38, 0.25)',
                        color: '#B91C1C',
                        boxShadow: '0 1px 2px rgba(17, 24, 39, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
                        '&:hover': { borderColor: 'rgba(220, 38, 38, 0.5)', boxShadow: '0 4px 10px rgba(220, 38, 38, 0.14)' },
                        '&:active': { transform: 'scale(0.96)' },
                        '&:disabled': { opacity: 0.4 },
                    } : {
                        minHeight: 60,
                        minWidth: 80,
                        fontSize: '16px',
                        fontWeight: 'bold',
                        backgroundColor: '#ffebee',
                        border: '2px solid #e57373',
                        color: '#d32f2f',
                        margin: 0.5,
                        '&:hover': {
                            backgroundColor: '#ffcdd2',
                            border: '2px solid #f44336'
                        },
                        '&:active': {
                            backgroundColor: '#ef9a9a'
                        },
                        '&:disabled': {
                            backgroundColor: '#f5f5f5',
                            border: '2px solid #e0e0e0'
                        }
                    }}
                >
                    <Backspace fontSize={minimal ? 'small' : 'large'} />
                </Button>
            );
        }

        if (key === 'space') {
            return (
                <Button
                    key={key}
                    variant="outlined"
                    size={minimal ? 'medium' : 'large'}
                    onClick={() => handleKeyPress(' ')}
                    disabled={disabled}
                    sx={minimal ? {
                        minHeight: 40,
                        minWidth: 110,
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: 0.6,
                        textTransform: 'uppercase',
                        margin: 0.25,
                        padding: 0,
                        borderRadius: '8px',
                        background: 'linear-gradient(180deg, #FFFFFF 0%, #F0FDF4 100%)',
                        border: '1px solid rgba(22, 163, 74, 0.22)',
                        color: '#15803D',
                        boxShadow: '0 1px 2px rgba(17, 24, 39, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
                        '&:hover': { borderColor: 'rgba(22, 163, 74, 0.5)', boxShadow: '0 4px 10px rgba(22, 163, 74, 0.14)' },
                        '&:active': { transform: 'scale(0.98)' },
                        '&:disabled': { opacity: 0.4 },
                    } : {
                        minHeight: 60,
                        minWidth: 120,
                        fontSize: '16px',
                        fontWeight: 'bold',
                        backgroundColor: '#e8f5e8',
                        border: '2px solid #4caf50',
                        color: '#2e7d32',
                        margin: 0.5,
                        '&:hover': {
                            backgroundColor: '#c8e6c9',
                            border: '2px solid #66bb6a'
                        },
                        '&:active': {
                            backgroundColor: '#a5d6a7'
                        },
                        '&:disabled': {
                            backgroundColor: '#f5f5f5',
                            border: '2px solid #e0e0e0'
                        }
                    }}
                >
                    Space
                </Button>
            );
        }
        
        return (
            <Button
                key={key}
                variant="outlined"
                size={minimal ? 'medium' : 'large'}
                onClick={() => handleKeyPress(key)}
                disabled={disabled}
                sx={minimal ? {
                    minHeight: 40,
                    minWidth: 40,
                    fontSize: '15px',
                    fontWeight: 700,
                    fontFamily: '"Inter", "Janna", "Segoe UI", sans-serif',
                    margin: 0.25,
                    padding: 0,
                    borderRadius: '8px',
                    background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
                    border: '1px solid #E5E7EB',
                    color: '#0F172A',
                    boxShadow: '0 1px 2px rgba(17, 24, 39, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
                    '&:hover': {
                        borderColor: '#FBC9CC',
                        boxShadow: '0 4px 10px rgba(225, 30, 38, 0.10)',
                        transform: 'translateY(-1px)',
                    },
                    '&:active': {
                        transform: 'scale(0.96)',
                        background: 'linear-gradient(180deg, #FEF2F2 0%, #FEE2E2 100%)',
                        borderColor: 'rgba(225, 30, 38, 0.3)',
                        color: '#B3141B',
                    },
                    '&:disabled': { opacity: 0.4 },
                    transition: 'all 110ms cubic-bezier(0.16, 1, 0.3, 1)',
                } : {
                    minHeight: 60,
                    minWidth: 60,
                    fontSize: '18px',
                    fontWeight: 'bold',
                    backgroundColor: '#f0f8ff',
                    border: '2px solid #2196f3',
                    color: '#1976d2',
                    margin: 0.5,
                    '&:hover': {
                        backgroundColor: '#bbdefb',
                        border: '2px solid #42a5f5',
                        transform: 'scale(1.05)'
                    },
                    '&:active': {
                        backgroundColor: '#90caf9',
                        transform: 'scale(0.98)'
                    },
                    '&:disabled': {
                        backgroundColor: '#f5f5f5',
                        border: '2px solid #e0e0e0',
                        transform: 'none'
                    },
                    transition: 'all 0.1s ease-in-out'
                }}
            >
                {key}
            </Button>
        );
    };

    if (minimal) {
        const langBtnBase = {
            minWidth: 84,
            height: 32,
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: 0.4,
            borderRadius: '8px',
            textTransform: 'uppercase',
            px: 1.5,
        };
        const langBtnActive = {
            background: 'linear-gradient(180deg, #E11E26 0%, #B3141B 100%)',
            color: '#fff',
            boxShadow: '0 3px 8px rgba(225, 30, 38, 0.28)',
            '&:hover': { background: 'linear-gradient(180deg, #B3141B 0%, #7F1D1D 100%)' },
        };
        const langBtnInactive = {
            borderColor: '#E5E7EB',
            color: '#374151',
            background: '#fff',
            '&:hover': { borderColor: '#FBC9CC', background: '#FFF7F7' },
        };

        return (
            <Box sx={{ mt: 0, mb: 0, width: '100%', margin: 'auto' }}>
                {/* Language toggle */}
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.25, gap: 1 }}>
                    <Button
                        variant={isArabic ? 'contained' : 'outlined'}
                        onClick={() => setIsArabic(true)}
                        disabled={disabled}
                        sx={{ ...langBtnBase, ...(isArabic ? langBtnActive : langBtnInactive) }}
                        startIcon={<Language sx={{ fontSize: 14 }} />}
                    >
                        عربي
                    </Button>
                    <Button
                        variant={!isArabic ? 'contained' : 'outlined'}
                        onClick={() => setIsArabic(false)}
                        disabled={disabled}
                        sx={{ ...langBtnBase, ...(!isArabic ? langBtnActive : langBtnInactive) }}
                        startIcon={<Language sx={{ fontSize: 14 }} />}
                    >
                        English
                    </Button>
                </Box>

                {/* Keys */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {currentKeys.map((row, rowIndex) => (
                        <Box key={rowIndex} sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>
                            {row.map((key) => renderKey(key))}
                        </Box>
                    ))}
                </Box>

                {/* Actions */}
                <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                    <Button
                        onClick={onCancel}
                        disabled={disabled}
                        sx={{
                            flex: 1,
                            height: 42,
                            borderRadius: '10px',
                            fontWeight: 800,
                            fontSize: '13px',
                            letterSpacing: 0.5,
                            textTransform: 'uppercase',
                            background: '#FFFFFF',
                            color: '#374151',
                            border: '1px solid #E5E7EB',
                            boxShadow: '0 1px 2px rgba(17, 24, 39, 0.04)',
                            '&:hover': { background: '#F9FAFB', borderColor: '#D1D5DB' },
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={onSave}
                        disabled={disabled || !currentValue.trim()}
                        sx={{
                            flex: 1,
                            height: 42,
                            borderRadius: '10px',
                            fontWeight: 800,
                            fontSize: '13px',
                            letterSpacing: 0.5,
                            textTransform: 'uppercase',
                            color: '#FFFFFF',
                            background: 'linear-gradient(180deg, #E11E26 0%, #B3141B 100%)',
                            boxShadow:
                                '0 4px 10px rgba(225, 30, 38, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.28)',
                            '&:hover': {
                                background: 'linear-gradient(180deg, #B3141B 0%, #7F1D1D 100%)',
                                boxShadow:
                                    '0 7px 16px rgba(225, 30, 38, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.32)',
                            },
                            '&:disabled': {
                                background: 'linear-gradient(180deg, #E5E7EB 0%, #D1D5DB 100%)',
                                color: '#9CA3AF',
                                boxShadow: 'none',
                            },
                        }}
                    >
                        Save
                    </Button>
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ mt: 2, mb: 1, maxWidth: 800, margin: 'auto' }}>
            <Typography 
                variant="h6" 
                color="text.primary" 
                align="center" 
                sx={{ mb: 2, fontWeight: 'bold' }}
            >
                Enter Customer Name
            </Typography>
            
            <Box sx={{ 
                p: 2, 
                border: '2px solid #ddd', 
                borderRadius: 2, 
                backgroundColor: '#f9f9f9',
                mb: 2,
                minHeight: 60,
                display: 'flex',
                alignItems: 'center'
            }}>
                <Typography 
                    variant="h5" 
                    sx={{ 
                        fontFamily: isArabic ? 'Janna' : 'Arial',
                        direction: isArabic ? 'rtl' : 'ltr',
                        textAlign: isArabic ? 'right' : 'left',
                        width: '100%',
                        minHeight: 30
                    }}
                >
                    {currentValue || 'اسم العميل / Customer Name'}
                </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                <Button
                    variant={isArabic ? "contained" : "outlined"}
                    onClick={() => setIsArabic(true)}
                    sx={{ mr: 1 }}
                    startIcon={<Language />}
                >
                    عربي
                </Button>
                <Button
                    variant={!isArabic ? "contained" : "outlined"}
                    onClick={() => setIsArabic(false)}
                    startIcon={<Language />}
                >
                    English
                </Button>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {currentKeys.map((row, rowIndex) => (
                    <Box key={rowIndex} sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                        {row.map((key) => renderKey(key))}
                    </Box>
                ))}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3 }}>
                <Button
                    variant="contained"
                    color="success"
                    size="large"
                    onClick={onSave}
                    disabled={disabled || !currentValue.trim()}
                    sx={{ minWidth: 120, fontSize: '16px' }}
                >
                    Save
                </Button>
                <Button
                    variant="outlined"
                    color="error"
                    size="large"
                    onClick={onCancel}
                    disabled={disabled}
                    sx={{ minWidth: 120, fontSize: '16px' }}
                >
                    Cancel
                </Button>
            </Box>
        </Box>
    );
};

export default AlphabetKeyboard; 