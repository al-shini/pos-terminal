import React, { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Modal from '@mui/material/Modal';
import Fade from '@mui/material/Fade';
import Backdrop from '@mui/material/Backdrop';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import BackspaceOutlinedIcon from '@mui/icons-material/BackspaceOutlined';
import KeyboardCapslockRoundedIcon from '@mui/icons-material/KeyboardCapslockRounded';
import KeyboardReturnRoundedIcon from '@mui/icons-material/KeyboardReturnRounded';
import SpaceBarRoundedIcon from '@mui/icons-material/SpaceBarRounded';
import ClearAllRoundedIcon from '@mui/icons-material/ClearAllRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';

import brand from '../../theme/brand';

/**
 * Touch-first on-screen keyboard designed for POS terminals.
 *
 * Features:
 * - Digits row, letters (Caps toggle), space, backspace, clear, close, enter.
 * - Mask toggle for password fields (eye icon).
 * - Numeric-only mode hides the letter rows.
 * - Large tap targets (min 56px) and gradient primary actions.
 * - Fully controlled — parent owns the value via `value` + `onChange`.
 */
const TouchKeyboard = ({
    open,
    title = 'Enter Value',
    subtitle,
    value = '',
    onChange,
    onClose,
    onSubmit,
    mask = false,
    numericOnly = false,
    submitLabel = 'Done',
    maxLength,
}) => {
    const [caps, setCaps] = useState(false);
    const [reveal, setReveal] = useState(false);

    useEffect(() => {
        if (open) {
            setCaps(false);
            setReveal(false);
        }
    }, [open]);

    const push = useCallback((char) => {
        if (maxLength && value.length >= maxLength) return;
        onChange((value || '') + char);
    }, [onChange, value, maxLength]);

    const backspace = useCallback(() => {
        onChange((value || '').slice(0, -1));
    }, [onChange, value]);

    const clearAll = useCallback(() => onChange(''), [onChange]);

    // Physical-keyboard support while the modal is open.
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') { onClose && onClose(); return; }
            if (e.key === 'Enter') { onSubmit && onSubmit(); return; }
            if (e.key === 'Backspace') { backspace(); return; }
            if (e.key.length === 1) {
                const isDigit = /\d/.test(e.key);
                const isAlpha = /[a-zA-Z]/.test(e.key);
                if (numericOnly && !isDigit) return;
                if (isAlpha || isDigit || e.key === ' ' || e.key === '-' || e.key === '_' || e.key === '.') {
                    push(e.key);
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, push, backspace, onClose, onSubmit, numericOnly]);

    const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    const letterRows = [
        ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
        ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
    ];

    const displayValue = (() => {
        if (!value) return '';
        return mask && !reveal ? '•'.repeat(value.length) : value;
    })();

    const renderLetterKey = (k) => (
        <Button
            key={k}
            onClick={() => push(caps ? k : k.toLowerCase())}
            sx={styles.key}
        >
            {caps ? k : k.toLowerCase()}
        </Button>
    );

    return (
        <Modal
            open={open}
            onClose={onClose}
            closeAfterTransition
            BackdropComponent={Backdrop}
            BackdropProps={{ timeout: 220, sx: { background: 'rgba(17,24,39,0.55)', backdropFilter: 'blur(4px)' } }}
        >
            <Fade in={open}>
                <Box sx={styles.root}>
                    {/* Header */}
                    <Box sx={styles.header}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Box sx={styles.title}>{title}</Box>
                            {subtitle && <Box sx={styles.subtitle}>{subtitle}</Box>}
                        </Box>
                        <Button onClick={onClose} sx={styles.closeBtn} aria-label="Close keyboard">
                            <CloseRoundedIcon />
                        </Button>
                    </Box>

                    {/* Live value display */}
                    <Box sx={styles.display}>
                        <Box sx={styles.displayText}>
                            {displayValue || <Box component="span" sx={styles.placeholder}>Tap keys to enter…</Box>}
                        </Box>
                        {mask && value && (
                            <Button onClick={() => setReveal((r) => !r)} sx={styles.revealBtn} aria-label="Toggle reveal">
                                {reveal ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                            </Button>
                        )}
                    </Box>

                    {/* Keyboard */}
                    <Box sx={styles.pad}>
                        {/* Digits row */}
                        <Box sx={styles.row}>
                            {digits.map((d) => (
                                <Button key={d} onClick={() => push(d)} sx={styles.key}>{d}</Button>
                            ))}
                        </Box>

                        {/* Letters — hidden in numeric-only mode */}
                        {!numericOnly && letterRows.map((row, i) => (
                            <Box key={`row-${i}`} sx={styles.row}>
                                {i === 2 && (
                                    <Button onClick={() => setCaps((c) => !c)} sx={{ ...styles.keyWide, ...(caps ? styles.keyActive : {}) }}>
                                        <KeyboardCapslockRoundedIcon />
                                    </Button>
                                )}
                                {row.map(renderLetterKey)}
                                {i === 2 && (
                                    <Button onClick={backspace} sx={{ ...styles.keyWide, ...styles.keyDanger }}>
                                        <BackspaceOutlinedIcon />
                                    </Button>
                                )}
                            </Box>
                        ))}

                        {/* Bottom action row */}
                        <Box sx={styles.row}>
                            <Button onClick={clearAll} sx={styles.keyWide}>
                                <ClearAllRoundedIcon sx={{ mr: 0.75 }} />
                                Clear
                            </Button>
                            {!numericOnly && (
                                <Button onClick={() => push(' ')} sx={styles.keySpace}>
                                    <SpaceBarRoundedIcon />
                                </Button>
                            )}
                            {numericOnly && (
                                <Button onClick={backspace} sx={{ ...styles.keyWide, ...styles.keyDanger }}>
                                    <BackspaceOutlinedIcon sx={{ mr: 0.75 }} />
                                    Back
                                </Button>
                            )}
                            <Button
                                onClick={onSubmit || onClose}
                                sx={styles.keyPrimary}
                                startIcon={<KeyboardReturnRoundedIcon />}
                            >
                                {submitLabel}
                            </Button>
                        </Box>
                    </Box>
                </Box>
            </Fade>
        </Modal>
    );
};

const KEY_H = 56;

const styles = {
    root: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '96vw', sm: 760 },
        maxWidth: '96vw',
        background: brand.colors.paper,
        borderRadius: `${brand.radii.xl}px`,
        boxShadow: brand.shadows.xl,
        padding: 2.5,
        outline: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.75,
        fontFamily: brand.typography.fontFamily,
    },
    header: { display: 'flex', alignItems: 'flex-start', gap: 2 },
    title: {
        fontSize: 18,
        fontWeight: brand.typography.weights.bold,
        color: brand.colors.ink,
        lineHeight: 1.2,
    },
    subtitle: {
        marginTop: '4px',
        fontSize: 13,
        color: brand.colors.textMuted,
    },
    closeBtn: {
        minWidth: 44,
        height: 44,
        borderRadius: `${brand.radii.md}px`,
        color: brand.colors.textMuted,
        background: brand.colors.bgAlt,
        '&:hover': { background: brand.colors.bg, color: brand.colors.ink },
    },

    display: {
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        padding: '14px 16px',
        borderRadius: `${brand.radii.md}px`,
        background: brand.colors.bg,
        border: `1px solid ${brand.colors.border}`,
        minHeight: 56,
    },
    displayText: {
        flex: 1,
        fontSize: 24,
        fontWeight: brand.typography.weights.semibold,
        color: brand.colors.ink,
        letterSpacing: 1,
        fontFamily: brand.typography.monoFamily,
        minHeight: 30,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    placeholder: {
        fontSize: 14,
        color: brand.colors.textSubtle,
        fontFamily: brand.typography.fontFamily,
        fontWeight: brand.typography.weights.regular,
        letterSpacing: 0.3,
    },
    revealBtn: {
        minWidth: 40,
        height: 40,
        borderRadius: `${brand.radii.sm}px`,
        color: brand.colors.textMuted,
        '&:hover': { background: brand.colors.bgAlt, color: brand.colors.primary },
    },

    pad: { display: 'flex', flexDirection: 'column', gap: 1 },
    row: { display: 'flex', gap: 0.75, justifyContent: 'center' },

    key: {
        flex: 1,
        minWidth: 0,
        height: KEY_H,
        fontSize: 18,
        fontWeight: brand.typography.weights.semibold,
        textTransform: 'none',
        color: brand.colors.ink,
        background: brand.colors.paper,
        border: `1px solid ${brand.colors.border}`,
        borderRadius: `${brand.radii.md}px`,
        boxShadow: '0 1px 0 rgba(17,24,39,0.04)',
        transition: 'transform .08s ease, box-shadow .15s ease, background .15s ease',
        '&:hover': {
            background: brand.colors.bgAlt,
            borderColor: brand.colors.borderStrong,
        },
        '&:active': {
            transform: 'scale(0.95)',
            background: brand.colors.primaryLight,
            borderColor: brand.colors.primary,
            color: brand.colors.primary,
        },
    },
    keyWide: {
        flex: 1.6,
        minWidth: 0,
        height: KEY_H,
        fontSize: 15,
        fontWeight: brand.typography.weights.bold,
        textTransform: 'none',
        color: brand.colors.textMuted,
        background: brand.colors.bgAlt,
        border: `1px solid ${brand.colors.border}`,
        borderRadius: `${brand.radii.md}px`,
        transition: 'transform .08s ease, background .15s ease',
        '&:hover': { background: brand.colors.bg, color: brand.colors.ink },
        '&:active': { transform: 'scale(0.96)' },
    },
    keyActive: {
        background: brand.colors.primaryLight,
        color: brand.colors.primary,
        borderColor: brand.colors.primary,
    },
    keyDanger: {
        color: brand.colors.danger,
        background: brand.colors.dangerBg,
        borderColor: 'transparent',
        '&:hover': { background: '#FCD6D6', color: brand.colors.danger },
    },
    keySpace: {
        flex: 5,
        height: KEY_H,
        borderRadius: `${brand.radii.md}px`,
        background: brand.colors.bgAlt,
        border: `1px solid ${brand.colors.border}`,
        color: brand.colors.textMuted,
        '&:hover': { background: brand.colors.bg, color: brand.colors.ink },
        '&:active': { transform: 'scale(0.98)' },
    },
    keyPrimary: {
        flex: 1.8,
        height: KEY_H,
        fontSize: 15,
        fontWeight: brand.typography.weights.bold,
        textTransform: 'none',
        letterSpacing: 0.3,
        borderRadius: `${brand.radii.md}px`,
        background: brand.gradients.primaryButton,
        color: '#fff',
        boxShadow: brand.shadows.brand,
        transition: 'transform .08s ease, filter .15s ease',
        '&:hover': {
            background: brand.gradients.primaryButton,
            filter: 'brightness(1.05)',
            boxShadow: brand.shadows.brand,
        },
        '&:active': { transform: 'scale(0.98)' },
    },
};

export default TouchKeyboard;
