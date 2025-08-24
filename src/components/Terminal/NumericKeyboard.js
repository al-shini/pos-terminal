import React from 'react';
import { Grid, Button, Box, Typography } from '@mui/material';
import { Backspace } from '@mui/icons-material';

const NumericKeyboard = ({ onKeyPress, disabled = false }) => {
    const keys = [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
        ['-', '0', 'backspace']
    ];

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
                        minHeight: 70,
                        fontSize: '20px',
                        fontWeight: 'bold',
                        backgroundColor: '#ffebee',
                        border: '2px solid #e57373',
                        color: '#d32f2f',
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

        const isHyphen = key === '-';
        
        return (
            <Button
                key={key}
                variant="outlined"
                size="large"
                onClick={() => handleKeyPress(key)}
                disabled={disabled}
                sx={{
                    minHeight: 70,
                    fontSize: '24px',
                    fontWeight: 'bold',
                    backgroundColor: isHyphen ? '#e8f5e8' : '#f0f8ff',
                    border: isHyphen ? '2px solid #4caf50' : '2px solid #2196f3',
                    color: isHyphen ? '#2e7d32' : '#1976d2',
                    '&:hover': {
                        backgroundColor: isHyphen ? '#c8e6c9' : '#bbdefb',
                        border: isHyphen ? '2px solid #66bb6a' : '2px solid #42a5f5',
                        transform: 'scale(1.05)'
                    },
                    '&:active': {
                        backgroundColor: isHyphen ? '#a5d6a7' : '#90caf9',
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
        <Box sx={{ mt: 2, mb: 1 }}>
            <Typography 
                variant="body2" 
                color="text.secondary" 
                align="center" 
                sx={{ mb: 1, fontStyle: 'italic' }}
            >
                Touch the keypad to enter transaction ID
            </Typography>
            <Grid container spacing={0.5}>
                {keys.map((row, rowIndex) => (
                    <Grid container item spacing={0.5} key={rowIndex} justifyContent="center">
                        {row.map((key) => (
                            <Grid item xs={4} key={key}>
                                {renderKey(key)}
                            </Grid>
                        ))}
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
};

export default NumericKeyboard; 