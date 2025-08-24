import React, { useState } from 'react';
import { Grid, Button, Box, Typography, ButtonGroup } from '@mui/material';
import { Backspace, Language } from '@mui/icons-material';

const AlphabetKeyboard = ({ onKeyPress, disabled = false, onSave, onCancel, currentValue = '' }) => {
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
                    size="large"
                    onClick={() => handleKeyPress(key)}
                    disabled={disabled}
                    sx={{
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
                    <Backspace fontSize="large" />
                </Button>
            );
        }

        if (key === 'space') {
            return (
                <Button
                    key={key}
                    variant="outlined"
                    size="large"
                    onClick={() => handleKeyPress(' ')}
                    disabled={disabled}
                    sx={{
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
                size="large"
                onClick={() => handleKeyPress(key)}
                disabled={disabled}
                sx={{
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