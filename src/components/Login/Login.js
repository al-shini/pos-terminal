import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import { keyframes } from '@emotion/react';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded';
import SystemUpdateAltRoundedIcon from '@mui/icons-material/SystemUpdateAltRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import KeyboardRoundedIcon from '@mui/icons-material/KeyboardRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import Tooltip from '@mui/material/Tooltip';
import TouchKeyboard from '../UI/TouchKeyboard';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import QRCode from 'react-qr-code';
import { CircularProgress } from '@mui/material';

import ShiniLogo from '../../assets/shini-extra-jordan.jpeg';
import NoConnection from '../../assets/no-connection.png';
import { login, checkLoginQrAuth } from '../../store/terminalSlice';
import { notify } from '../../store/uiSlice';
import config from '../../config';
import axios from '../../axios';
import brand from '../../theme/brand';

// ——— Passive animations (GPU-friendly: transform + opacity only) ———
const fadeSlideUp = keyframes`
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
`;
const float = keyframes`
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-6px); }
`;
const spin = keyframes`
    to { transform: rotate(360deg); }
`;
const haloPulse = keyframes`
    0%, 100% { transform: scale(1);    opacity: .55; }
    50%      { transform: scale(1.08); opacity: .9;  }
`;
const ringPulse = keyframes`
    0%   { transform: scale(1);    opacity: .45; }
    100% { transform: scale(1.35); opacity: 0;   }
`;
const driftA = keyframes`
    0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
    50%      { transform: translate3d(40px, -30px, 0) scale(1.08); }
`;
const driftB = keyframes`
    0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
    50%      { transform: translate3d(-30px, 25px, 0) scale(1.12); }
`;
const softPulse = keyframes`
    0%, 100% { box-shadow: 0 0 0 0 rgba(225,30,38,0.12); }
    50%      { box-shadow: 0 0 0 12px rgba(225,30,38,0); }
`;

const Login = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const terminalSlice = useSelector((state) => state.terminal);

    const [cred, setCred] = useState({
        username: '',
        password: '',
        admin: config.admin ? config.admin : false,
    });

    const [loginQR, setLoginQR] = useState(undefined);

    // Head-office published update info (LAST_VERSION, LAST_VERSION_LINK).
    // `loaded=false` until the first check completes so we show a neutral state.
    const [updateInfo, setUpdateInfo] = useState({
        loaded: false,
        lastVersion: null,
        lastVersionLink: null,
    });

    // On-screen keyboard state. `field` is null when the keyboard is closed.
    const [kb, setKb] = useState({ field: null });
    const openKeyboard = (field) => setKb({ field });
    const closeKeyboard = () => setKb({ field: null });

    // Update download lifecycle — tracks streaming from GitHub to a temp path.
    // status: idle | downloading | launching | error | done
    const [download, setDownload] = useState({ status: 'idle', progress: 0, error: null });

    const muiTheme = createTheme({
        palette: {
            primary: { main: brand.colors.primary, dark: brand.colors.primaryDark },
        },
        typography: { fontFamily: brand.typography.fontFamily },
        shape: { borderRadius: brand.radii.md },
    });

    const handleSubmit = (event) => {
        event.preventDefault();
        dispatch(login({ ...cred, terminalHardwareId: config.deviceId }));
    };

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            try {
                const response = await reloadQrAuth();
                if (response && isMounted) {
                    setLoginQR(response);
                } else {
                    await checkForConnection();
                }
            } catch (error) {
                // swallow — the retry loop below will recover
            }
        };
        fetchData();
        fetchUpdateInfo();
        return () => { isMounted = false; };
    }, []);

    const fetchUpdateInfo = async () => {
        try {
            const res = await axios({ method: 'get', url: '/utilities/checkForUpdate' });
            const data = (res && res.data) || {};
            setUpdateInfo({
                loaded: true,
                lastVersion: data.lastVersion || null,
                lastVersionLink: data.lastVersionLink || null,
            });
        } catch (error) {
            setUpdateInfo({ loaded: true, lastVersion: null, lastVersionLink: null });
        }
    };

    // Numeric, dot-separated version compare. Returns true if `a` > `b`.
    const isVersionNewer = (a, b) => {
        if (!a || !b) return false;
        const ap = String(a).replace(/[^\d.]/g, '').split('.').map((n) => parseInt(n, 10) || 0);
        const bp = String(b).replace(/[^\d.]/g, '').split('.').map((n) => parseInt(n, 10) || 0);
        const len = Math.max(ap.length, bp.length);
        for (let i = 0; i < len; i++) {
            const av = ap[i] || 0;
            const bv = bp[i] || 0;
            if (av > bv) return true;
            if (av < bv) return false;
        }
        return false;
    };

    const currentVersion = process.env.REACT_APP_VERSION;
    const hasNewVersion = updateInfo.loaded
        && updateInfo.lastVersion
        && isVersionNewer(updateInfo.lastVersion, currentVersion);
    const updateReady = hasNewVersion && !!updateInfo.lastVersionLink;

    const updateWarning = (() => {
        if (!updateInfo.loaded) return 'Checking for updates…';
        if (!updateInfo.lastVersion) return 'No published version info (LAST_VERSION not set in head office).';
        if (!isVersionNewer(updateInfo.lastVersion, currentVersion)) {
            return `You are on the latest version (v${currentVersion}).`;
        }
        if (!updateInfo.lastVersionLink) {
            return `A new version v${updateInfo.lastVersion} is published, but no download link is configured (LAST_VERSION_LINK missing).`;
        }
        return `Download the new version v${updateInfo.lastVersion}.`;
    })();

    /**
     * Streams the update installer to a temp file, then hands off to Windows
     * via shell.openPath — which triggers UAC and runs the NSIS installer.
     * The installer will replace the running app and relaunch once done.
     *
     * Runs only inside Electron (uses Node fs/https). Falls back to
     * shell.openExternal / window.open otherwise.
     */
    const handleDownloadUpdate = async () => {
        if (!updateReady) return;
        if (download.status === 'downloading' || download.status === 'launching') return;
        const url = updateInfo.lastVersionLink;

        // Non-Electron fallback (react-scripts dev mode in a plain browser)
        if (!(typeof window !== 'undefined' && window.require)) {
            window.open(url, '_blank', 'noopener,noreferrer');
            return;
        }

        try {
            const electron = window.require('electron');
            const shell = electron.shell;
            const fs = window.require('fs');
            const path = window.require('path');
            const os = window.require('os');
            const https = window.require('https');
            const http = window.require('http');

            // Pick a stable name + destination path
            let fileName = 'Shini-POS-Update.exe';
            try {
                const last = new URL(url).pathname.split('/').pop();
                if (last && /\.exe$/i.test(last)) fileName = decodeURIComponent(last);
            } catch (_) { /* keep default */ }
            const destPath = path.join(os.tmpdir(), fileName);

            // Ensure no stale leftover (safe to ignore errors)
            try { fs.unlinkSync(destPath); } catch (_) { /* ignore */ }

            setDownload({ status: 'downloading', progress: 0, error: null });

            await streamDownload({ https, http, fs, url, destPath, onProgress: (pct) => {
                setDownload((prev) => (
                    prev.status === 'downloading' ? { ...prev, progress: pct } : prev
                ));
            } });

            setDownload({ status: 'launching', progress: 100, error: null });

            // openPath returns '' on success, or an error string on failure
            const result = await shell.openPath(destPath);
            if (result) {
                throw new Error(result);
            }
            setDownload({ status: 'done', progress: 100, error: null });
            dispatch(notify({
                msg: 'Installer launched. Follow the prompts — the app will restart.',
                sev: 'info',
            }));
        } catch (e) {
            const msg = (e && e.message) ? e.message : String(e);
            setDownload({ status: 'error', progress: 0, error: msg });
            dispatch(notify({ msg: 'Update failed: ' + msg, sev: 'error' }));
        }
    };

    /**
     * Streams an HTTP(S) response to disk, following 301/302/303/307/308
     * redirects (needed because GitHub release URLs bounce through S3).
     *
     * Progress reporting is throttled on two axes:
     *   (a) Report only when the integer percentage changes (max 100 reports).
     *   (b) Additionally coalesce to ~200ms — avoids bursts on fast pipes.
     *
     * Without this, calling React's setState on every 16KB chunk caused
     * thousands of re-renders of the whole login screen and starved the
     * socket reader, tanking throughput to ~kB/s.
     */
    const streamDownload = ({ https, http, fs, url, destPath, onProgress, maxRedirects = 6 }) => {
        return new Promise((resolve, reject) => {
            const go = (currentUrl, redirectsLeft) => {
                let parsed;
                try { parsed = new URL(currentUrl); }
                catch (e) { return reject(new Error('Invalid URL: ' + currentUrl)); }
                const lib = parsed.protocol === 'https:' ? https : http;
                const req = lib.get(currentUrl, { headers: { 'User-Agent': 'Shini-POS-Terminal' } }, (res) => {
                    if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                        res.destroy();
                        if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));
                        const next = new URL(res.headers.location, currentUrl).toString();
                        return go(next, redirectsLeft - 1);
                    }
                    if (res.statusCode !== 200) {
                        res.destroy();
                        return reject(new Error('HTTP ' + res.statusCode + ' from server'));
                    }
                    const total = parseInt(res.headers['content-length'] || '0', 10);
                    let received = 0;
                    let lastReportedPct = -1;
                    let lastReportedAt = 0;
                    const out = fs.createWriteStream(destPath);

                    // Pipe FIRST so backpressure works cleanly — our listener just
                    // tracks byte counts without ever blocking the write path.
                    res.pipe(out);

                    res.on('data', (chunk) => {
                        received += chunk.length;
                        if (!onProgress || total <= 0) return;
                        const pct = Math.min(99, Math.floor((received / total) * 100));
                        const now = Date.now();
                        if (pct !== lastReportedPct && (now - lastReportedAt) >= 200) {
                            lastReportedPct = pct;
                            lastReportedAt = now;
                            onProgress(pct);
                        }
                    });
                    res.on('error', (err) => { out.destroy(); reject(err); });
                    out.on('error', (err) => { res.destroy(); reject(err); });
                    out.on('finish', () => out.close((err) => err ? reject(err) : resolve(destPath)));
                });
                req.setTimeout(60_000, () => {
                    req.destroy(new Error('Network timeout while downloading'));
                });
                req.on('error', reject);
            };
            go(url, maxRedirects);
        });
    };

    const checkForConnection = async () => {
        const response = await reloadQrAuth();
        if (response) {
            setLoginQR(response);
        } else {
            window.setTimeout(checkForConnection, 3000);
        }
    };

    useEffect(() => {
        if (terminalSlice.authenticated) {
            navigate('/app');
        }
    }, [terminalSlice.authenticated]);

    useEffect(() => {
        if (loginQR) {
            if (loginQR.qrAuthKey && !terminalSlice.authenticated) {
                dispatch(checkLoginQrAuth(loginQR.qrAuthKey));
            }
        } else {
            checkForConnection();
        }
    }, [loginQR]);

    const handleQRClick = async () => {
        const response = await reloadQrAuth();
        setLoginQR(response);
    };

    const reloadQrAuth = async () => {
        try {
            const response = await axios({
                method: 'post',
                url: '/utilities/generateQR',
                data: { hardwareId: config.deviceId, source: 'Login' },
            });
            if (response && response.data) {
                return response.data;
            }
            dispatch(notify({ msg: 'Incorrect Login QR response', sev: 'error' }));
            return undefined;
        } catch (error) {
            if (error.response) {
                if (error.response.status === 401) {
                    dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }));
                }
            } else {
                dispatch(notify({ msg: error.message, sev: 'error' }));
            }
            return undefined;
        }
    };

    const connected = Boolean(loginQR);
    const now = new Date();
    const shortDate = now.toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });

    return (
        <ThemeProvider theme={muiTheme}>
            <CssBaseline />
            <Box sx={styles.root}>
                {/* Top-left — force window reload (re-checks update, QR, connection) */}
                <Tooltip title="Reload window — re-check for updates and connection" arrow placement="right">
                    <Box
                        role="button"
                        aria-label="Reload window"
                        onClick={() => window.location.reload()}
                        sx={styles.reloadBtn}
                    >
                        <RefreshRoundedIcon sx={{ fontSize: 20 }} />
                    </Box>
                </Tooltip>

                {/* LEFT — Brand hero panel */}
                <Box sx={styles.hero}>
                    {/* Animated ambient blobs + subtle grid */}
                    <Box sx={styles.blobA} />
                    <Box sx={styles.blobB} />
                    <Box sx={styles.grid} />

                    <Box sx={styles.heroContent}>
                        {/* Logo medallion — rotating ring, pulsing halo, expanding rings */}
                        <Box sx={{ ...styles.logoStage, animation: `${fadeSlideUp} .8s ease-out both` }}>
                            {/* Far-back soft colored halo */}
                            <Box sx={styles.logoHalo} />
                            {/* Two expanding pulse rings */}
                            <Box sx={{ ...styles.pulseRing, animationDelay: '0s' }} />
                            <Box sx={{ ...styles.pulseRing, animationDelay: '1.4s' }} />
                            {/* Rotating conic gradient ring */}
                            <Box sx={styles.rotatingRing} />
                            {/* Inner circle with the logo */}
                            <Box sx={styles.logoCircle}>
                                <Box sx={styles.logoInnerFloat}>
                                    <img src={ShiniLogo} alt="Shini Extra Jordan" style={styles.logo} />
                                </Box>
                            </Box>
                        </Box>

                        <Box sx={{ ...styles.heroTextWrap, animation: `${fadeSlideUp} .8s .2s ease-out both` }}>
                            <Box sx={styles.eyebrow}>
                                <Box sx={styles.eyebrowDot} />
                                {config.admin ? 'BACK OFFICE CONSOLE' : 'POINT OF SALE TERMINAL'}
                            </Box>
                            <Box component="h1" sx={styles.heroTitle}>
                                Welcome back.
                            </Box>
                            <Box sx={styles.heroSubtitle}>
                                Fast, reliable checkout — crafted for every Shini Extra branch
                                {config.tenant === 'palestine' ? ' across Palestine.' : ' across Jordan.'}
                            </Box>
                        </Box>

                        <Box sx={{ ...styles.heroMetaWrap, animation: `${fadeSlideUp} .8s .35s ease-out both` }}>
                            <Box sx={styles.heroMeta}>
                                <Box sx={styles.metaItem}>
                                    <Box sx={styles.metaLabel}>Currency</Box>
                                    <Box sx={styles.metaValue}>{config.systemCurrency}</Box>
                                </Box>
                                <Box sx={styles.metaDivider} />
                                <Box sx={styles.metaItem}>
                                    <Box sx={styles.metaLabel}>Today</Box>
                                    <Box sx={styles.metaValue}>{shortDate}</Box>
                                </Box>
                                <Box sx={styles.metaDivider} />
                                <Box sx={styles.metaItem}>
                                    <Box sx={styles.metaLabel}>Version</Box>
                                    <Box sx={styles.metaValue}>v{currentVersion}</Box>
                                </Box>
                            </Box>

                            {/* Download update row — streams installer, then launches it */}
                            <Tooltip title={updateWarning} arrow placement="bottom">
                                <Box component="span" sx={{ display: 'block', width: '100%' }}>
                                    <Button
                                        fullWidth
                                        variant={updateReady ? 'contained' : 'outlined'}
                                        disabled={!updateReady || download.status === 'downloading' || download.status === 'launching'}
                                        onClick={handleDownloadUpdate}
                                        startIcon={
                                            download.status === 'downloading' || download.status === 'launching'
                                                ? <CircularProgress size={16} thickness={6} sx={{ color: '#fff' }} />
                                                : updateReady
                                                    ? <SystemUpdateAltRoundedIcon />
                                                    : <InfoOutlinedIcon />
                                        }
                                        sx={{
                                            ...(updateReady ? styles.updateBtnActive : styles.updateBtnIdle),
                                            ...(download.status === 'downloading' || download.status === 'launching'
                                                ? styles.updateBtnBusy(download.progress)
                                                : {}),
                                        }}
                                    >
                                        {download.status === 'downloading'
                                            ? <>Downloading… <Box component="span" sx={styles.updateBadge}>{download.progress}%</Box></>
                                            : download.status === 'launching'
                                                ? 'Launching installer…'
                                                : download.status === 'done'
                                                    ? 'Installer launched — follow prompts'
                                                    : updateReady
                                                        ? <>Download &amp; Install&nbsp;<Box component="span" sx={styles.updateBadge}>v{updateInfo.lastVersion}</Box></>
                                                        : !updateInfo.loaded
                                                            ? 'Checking for updates…'
                                                            : hasNewVersion
                                                                ? `v${updateInfo.lastVersion} available · link missing`
                                                                : updateInfo.lastVersion
                                                                    ? `Up to date · latest v${currentVersion}`
                                                                    : 'No update info available'}
                                    </Button>
                                </Box>
                            </Tooltip>
                        </Box>
                    </Box>
                </Box>

                {/* RIGHT — Sign-in card */}
                <Box sx={styles.panel}>
                    <Box sx={{ ...styles.card, animation: `${fadeSlideUp} .7s .1s ease-out both` }}>
                        <Box sx={styles.cardHeader}>
                            <Box sx={styles.cardIcon}>
                                {config.admin
                                    ? <AdminPanelSettingsRoundedIcon sx={{ color: brand.colors.primary, fontSize: 24 }} />
                                    : <QrCode2RoundedIcon sx={{ color: brand.colors.primary, fontSize: 24 }} />}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <Box sx={styles.cardTitle}>
                                    {config.admin ? 'Admin Sign In' : 'Sign in to Terminal'}
                                </Box>
                                <Box sx={styles.cardSubtitle}>
                                    {config.admin
                                        ? 'Use your back-office credentials to continue.'
                                        : connected
                                            ? 'Scan the QR with the Shini companion app, or sign in manually.'
                                            : 'Waiting for a connection to the branch server…'}
                                </Box>
                            </Box>
                        </Box>

                        {!config.admin && (
                            <Box sx={styles.qrSection}>
                                {connected ? (
                                    <Box sx={styles.qrBox} onClick={handleQRClick} role="button" tabIndex={0}>
                                        <QRCode value={JSON.stringify(loginQR)} size={132} />
                                        <Box sx={styles.qrHint}>Tap to refresh</Box>
                                    </Box>
                                ) : (
                                    <Box sx={styles.qrOffline}>
                                        <img src={NoConnection} alt="No connection" style={styles.offlineImg} />
                                        <Box sx={styles.offlineText}>
                                            <CircularProgress size={16} thickness={5}
                                                sx={{ color: brand.colors.primary, mr: 1 }} />
                                            Reconnecting…
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        )}

                        {!config.admin && connected && (
                            <Box sx={styles.divider}>
                                <Box sx={styles.dividerLine} />
                                <Box sx={styles.dividerText}>OR SIGN IN MANUALLY</Box>
                                <Box sx={styles.dividerLine} />
                            </Box>
                        )}

                        {connected && (
                            <Box component="form" noValidate onSubmit={handleSubmit} sx={styles.form}>
                                <TextField
                                    required fullWidth id="username" label="Username or Employee Code"
                                    value={cred.username}
                                    onClick={() => openKeyboard('username')}
                                    onChange={(e) => setCred({ ...cred, username: e.target.value })}
                                    autoComplete="username"
                                    error={!cred.username}
                                    size="small"
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <PersonOutlineRoundedIcon sx={{ color: brand.colors.textMuted, fontSize: 20 }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <Box
                                                    role="button"
                                                    aria-label="Open on-screen keyboard"
                                                    onClick={(e) => { e.stopPropagation(); openKeyboard('username'); }}
                                                    sx={styles.kbIconBtn}
                                                >
                                                    <KeyboardRoundedIcon sx={{ fontSize: 18 }} />
                                                </Box>
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={styles.input}
                                />
                                <TextField
                                    required fullWidth id="password" type="password" label="Password"
                                    value={cred.password}
                                    onClick={() => openKeyboard('password')}
                                    onChange={(e) => setCred({ ...cred, password: e.target.value })}
                                    autoComplete="current-password"
                                    error={!cred.password}
                                    size="small"
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <LockOutlinedIcon sx={{ color: brand.colors.textMuted, fontSize: 20 }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <Box
                                                    role="button"
                                                    aria-label="Open on-screen keyboard"
                                                    onClick={(e) => { e.stopPropagation(); openKeyboard('password'); }}
                                                    sx={styles.kbIconBtn}
                                                >
                                                    <KeyboardRoundedIcon sx={{ fontSize: 18 }} />
                                                </Box>
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={styles.input}
                                />
                                <Button type="submit" fullWidth variant="contained" sx={styles.submit}>
                                    Sign In
                                </Button>
                            </Box>
                        )}

                        <Box sx={styles.footer}>
                            <Box sx={styles.statusChip(connected)}>
                                <FiberManualRecordRoundedIcon
                                    sx={{
                                        fontSize: 9,
                                        color: connected ? brand.colors.success : brand.colors.danger,
                                    }}
                                />
                                {connected ? 'Connected' : 'Disconnected'}
                            </Box>
                            <Box sx={styles.metaLine}>
                                {config.admin
                                    ? <>Server <b>{config.serverIp}</b></>
                                    : <>Device <b>{config.deviceId}</b>  ·  Server <b>{config.serverIp}</b></>}
                            </Box>
                        </Box>
                    </Box>

                    <Box sx={styles.legal}>
                        © {now.getFullYear()} Shini Extra Jordan · All rights reserved
                    </Box>
                </Box>
            </Box>

            {/* Touch-screen keyboard — shared by both fields, field name decides context */}
            <TouchKeyboard
                open={kb.field !== null}
                title={kb.field === 'password' ? 'Enter Password' : 'Enter Username or Employee Code'}
                subtitle={kb.field === 'password'
                    ? 'Type your password, then tap Done.'
                    : 'Cashiers can sign in with their username or employee number.'}
                value={kb.field ? (cred[kb.field] || '') : ''}
                mask={kb.field === 'password'}
                onChange={(v) => {
                    if (!kb.field) return;
                    setCred((prev) => ({ ...prev, [kb.field]: v }));
                }}
                onClose={closeKeyboard}
                onSubmit={() => {
                    // Username → move to password; Password → attempt login.
                    if (kb.field === 'username') {
                        openKeyboard('password');
                    } else if (kb.field === 'password') {
                        closeKeyboard();
                        if (cred.username && cred.password) {
                            dispatch(login({ ...cred, terminalHardwareId: config.deviceId }));
                        }
                    }
                }}
                submitLabel={kb.field === 'password' ? 'Sign In' : 'Next'}
            />
        </ThemeProvider>
    );
};

// ——— Logo medallion sizing — keep in one place ———
const CIRCLE = 240;   // inner white circle
const RING  = 260;    // rotating conic ring (outer)
const HALO  = 360;    // soft colored halo

const styles = {
    root: {
        display: 'flex',
        height: '100vh',
        width: '100vw',
        maxHeight: '100vh',
        background: brand.colors.bg,
        fontFamily: brand.typography.fontFamily,
        color: brand.colors.text,
        overflow: 'hidden',
        position: 'fixed',
        inset: 0,
    },
    reloadBtn: {
        position: 'absolute',
        top: 14,
        left: 14,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 38,
        height: 38,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: `1px solid ${brand.colors.border}`,
        boxShadow: brand.shadows.sm,
        color: brand.colors.textMuted,
        cursor: 'pointer',
        transition: 'transform .2s ease, background .2s ease, color .2s ease, box-shadow .2s ease',
        '&:hover': {
            color: brand.colors.primary,
            background: brand.colors.paper,
            borderColor: brand.colors.primaryLight,
            boxShadow: brand.shadows.md,
            '& svg': { transform: 'rotate(90deg)' },
        },
        '&:active': {
            transform: 'scale(0.94)',
            '& svg': { transform: 'rotate(360deg)' },
        },
        '& svg': { transition: 'transform .5s cubic-bezier(.4,.2,.2,1)' },
    },

    // ——— Hero panel ———
    hero: {
        position: 'relative',
        flex: 1.1,
        display: { xs: 'none', md: 'flex' },
        alignItems: 'center',
        justifyContent: 'center',
        background:
            'linear-gradient(135deg, #FFFFFF 0%, #FFF6F6 60%, #FFEBEC 100%)',
        overflow: 'hidden',
        minHeight: 0,
    },
    blobA: {
        position: 'absolute',
        top: '-20%',
        left: '-15%',
        width: 480,
        height: 480,
        borderRadius: '50%',
        background:
            'radial-gradient(circle at 30% 30%, rgba(225,30,38,0.32), rgba(225,30,38,0) 65%)',
        filter: 'blur(24px)',
        animation: `${driftA} 16s ease-in-out infinite`,
        pointerEvents: 'none',
    },
    blobB: {
        position: 'absolute',
        bottom: '-25%',
        right: '-20%',
        width: 540,
        height: 540,
        borderRadius: '50%',
        background:
            'radial-gradient(circle at 60% 60%, rgba(45,45,45,0.16), rgba(45,45,45,0) 65%)',
        filter: 'blur(28px)',
        animation: `${driftB} 20s ease-in-out infinite`,
        pointerEvents: 'none',
    },
    grid: {
        position: 'absolute',
        inset: 0,
        backgroundImage:
            'linear-gradient(rgba(17,24,39,0.04) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(17,24,39,0.04) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, transparent 70%)',
        pointerEvents: 'none',
    },
    heroContent: {
        position: 'relative',
        width: '100%',
        px: 5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        textAlign: 'center',
    },

    // ——— Logo medallion ———
    logoStage: {
        position: 'relative',
        width: CIRCLE,
        height: CIRCLE,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoHalo: {
        position: 'absolute',
        width: HALO,
        height: HALO,
        borderRadius: '50%',
        background:
            'radial-gradient(closest-side, rgba(225,30,38,0.30), rgba(225,30,38,0) 72%)',
        filter: 'blur(8px)',
        animation: `${haloPulse} 5s ease-in-out infinite`,
        pointerEvents: 'none',
        zIndex: 0,
    },
    pulseRing: {
        position: 'absolute',
        width: CIRCLE,
        height: CIRCLE,
        borderRadius: '50%',
        border: `2px solid ${brand.colors.primary}`,
        animation: `${ringPulse} 2.8s ease-out infinite`,
        pointerEvents: 'none',
        zIndex: 1,
    },
    rotatingRing: {
        position: 'absolute',
        width: RING,
        height: RING,
        borderRadius: '50%',
        background:
            'conic-gradient(from 0deg, ' +
            '#E11E26 0deg, #FFC5C8 60deg, #E11E26 120deg, ' +
            '#2D2D2D 180deg, #E11E26 240deg, #B3141B 300deg, #E11E26 360deg)',
        mask: 'radial-gradient(farthest-side, transparent calc(100% - 6px), black calc(100% - 6px))',
        WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 6px), black calc(100% - 6px))',
        animation: `${spin} 6s linear infinite`,
        pointerEvents: 'none',
        zIndex: 2,
        filter: 'drop-shadow(0 6px 18px rgba(225,30,38,0.25))',
    },
    logoCircle: {
        position: 'relative',
        width: CIRCLE,
        height: CIRCLE,
        borderRadius: '50%',
        background: brand.colors.paper,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow:
            '0 20px 50px rgba(225,30,38,0.18),' +
            '0 6px 16px rgba(17,24,39,0.08),' +
            'inset 0 0 0 1px rgba(225,30,38,0.06)',
        zIndex: 3,
        overflow: 'hidden',
    },
    logoInnerFloat: {
        animation: `${float} 6s ease-in-out infinite`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logo: {
        display: 'block',
        width: CIRCLE * 0.78,
        height: 'auto',
        objectFit: 'contain',
    },

    heroTextWrap: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.25,
        maxWidth: 480,
    },
    eyebrow: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        textTransform: 'uppercase',
        letterSpacing: 2.5,
        fontSize: 11,
        fontWeight: brand.typography.weights.bold,
        color: brand.colors.primary,
    },
    eyebrowDot: {
        width: 6, height: 6, borderRadius: '50%',
        background: brand.colors.primary,
        boxShadow: `0 0 0 4px ${brand.colors.primaryLight}`,
    },
    heroTitle: {
        margin: 0,
        fontSize: 40,
        lineHeight: 1.05,
        fontWeight: brand.typography.weights.heavy,
        color: brand.colors.ink,
        letterSpacing: -1,
    },
    heroSubtitle: {
        fontSize: 14,
        color: brand.colors.textMuted,
        lineHeight: 1.55,
    },

    heroMetaWrap: {
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        width: 'fit-content',
        minWidth: 320,
    },
    heroMeta: {
        display: 'flex',
        alignItems: 'stretch',
        gap: 2.5,
        background: 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: `1px solid ${brand.colors.border}`,
        borderRadius: `${brand.radii.lg}px`,
        padding: '12px 18px',
        boxShadow: brand.shadows.sm,
    },
    updateBtnActive: {
        textTransform: 'none',
        fontWeight: brand.typography.weights.bold,
        fontSize: 13,
        letterSpacing: 0.2,
        borderRadius: `${brand.radii.md}px`,
        height: 40,
        background: brand.gradients.primaryButton,
        boxShadow: brand.shadows.brand,
        color: '#fff',
        transition: 'transform .15s ease, filter .15s ease',
        '&:hover': {
            background: brand.gradients.primaryButton,
            filter: 'brightness(1.05)',
            boxShadow: brand.shadows.brand,
            transform: 'translateY(-1px)',
        },
        '&:active': { transform: 'translateY(0)' },
    },
    // Busy state — subtle progress fill using a background stripe behind the gradient.
    updateBtnBusy: (pct) => ({
        position: 'relative',
        overflow: 'hidden',
        '&.Mui-disabled': {
            color: '#fff',
            background: brand.gradients.primaryButton,
            boxShadow: brand.shadows.brand,
            opacity: 0.95,
        },
        '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background:
                'linear-gradient(90deg, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.22) 60%, rgba(255,255,255,0.28) 100%)',
            transition: 'width .25s ease',
            pointerEvents: 'none',
        },
    }),
    updateBtnIdle: {
        textTransform: 'none',
        fontWeight: brand.typography.weights.semibold,
        fontSize: 12.5,
        letterSpacing: 0.2,
        borderRadius: `${brand.radii.md}px`,
        height: 40,
        color: brand.colors.textMuted,
        borderColor: brand.colors.border,
        background: 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        '&.Mui-disabled': {
            color: brand.colors.textSubtle,
            borderColor: brand.colors.border,
        },
    },
    updateBadge: {
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: `${brand.radii.pill}px`,
        fontSize: 11,
        fontWeight: brand.typography.weights.bold,
        background: 'rgba(255,255,255,0.22)',
        color: '#fff',
        letterSpacing: 0.3,
    },
    metaItem: { display: 'flex', flexDirection: 'column', gap: 0.25 },
    metaLabel: {
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        color: brand.colors.textMuted,
        fontWeight: brand.typography.weights.semibold,
    },
    metaValue: {
        fontSize: 13,
        fontWeight: brand.typography.weights.bold,
        color: brand.colors.ink,
        whiteSpace: 'nowrap',
    },
    metaDivider: { width: '1px', background: brand.colors.border },

    // ——— Right panel ———
    panel: {
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2.5,
        background: brand.colors.paper,
        borderLeft: { md: `1px solid ${brand.colors.border}` },
        minHeight: 0,
        overflow: 'hidden',
    },
    card: {
        width: '100%',
        maxWidth: 400,
        background: brand.colors.paper,
        borderRadius: `${brand.radii.xl}px`,
        padding: 3,
        boxShadow: { xs: 'none', md: brand.shadows.lg },
        border: { xs: `1px solid ${brand.colors.border}`, md: 'none' },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.75,
    },
    cardHeader: { display: 'flex', alignItems: 'flex-start', gap: 1.5 },
    cardIcon: {
        width: 40,
        height: 40,
        borderRadius: `${brand.radii.md}px`,
        background: brand.colors.primaryLight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: brand.typography.weights.bold,
        color: brand.colors.ink,
        lineHeight: 1.2,
    },
    cardSubtitle: {
        marginTop: '3px',
        fontSize: 12.5,
        color: brand.colors.textMuted,
        lineHeight: 1.45,
    },

    qrSection: { display: 'flex', justifyContent: 'center' },
    qrBox: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.75,
        padding: 1.5,
        borderRadius: `${brand.radii.lg}px`,
        border: `1px solid ${brand.colors.border}`,
        background: brand.colors.paper,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        animation: `${softPulse} 2.6s ease-in-out infinite`,
        '&:hover': {
            borderColor: brand.colors.primary,
            boxShadow: brand.shadows.md,
            transform: 'translateY(-1px)',
        },
    },
    qrHint: {
        fontSize: 9.5,
        color: brand.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        fontWeight: brand.typography.weights.semibold,
    },
    qrOffline: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        padding: '14px 20px',
        borderRadius: `${brand.radii.lg}px`,
        background: brand.colors.bgAlt,
        border: `1px dashed ${brand.colors.borderStrong}`,
        width: '100%',
    },
    offlineImg: { maxWidth: 90, opacity: 0.75 },
    offlineText: {
        display: 'flex',
        alignItems: 'center',
        fontSize: 12,
        color: brand.colors.textMuted,
        fontWeight: brand.typography.weights.medium,
    },

    divider: { display: 'flex', alignItems: 'center', gap: 1.5 },
    dividerLine: { flex: 1, height: '1px', background: brand.colors.border },
    dividerText: {
        fontSize: 9.5,
        color: brand.colors.textSubtle,
        fontWeight: brand.typography.weights.semibold,
        letterSpacing: 1.5,
    },

    form: { display: 'flex', flexDirection: 'column', gap: 1.25 },
    input: {
        '& .MuiOutlinedInput-root': {
            borderRadius: `${brand.radii.md}px`,
            background: brand.colors.bg,
            transition: 'box-shadow .2s ease, border-color .2s ease',
            cursor: 'pointer',
            '& input': { cursor: 'pointer' },
            '& fieldset': { borderColor: brand.colors.border },
            '&:hover fieldset': { borderColor: brand.colors.borderStrong },
            '&.Mui-focused fieldset': { borderColor: brand.colors.primary, borderWidth: '1.5px' },
            '&.Mui-focused': { boxShadow: `0 0 0 4px ${brand.colors.primaryLight}` },
        },
        '& .MuiInputLabel-root.Mui-focused': { color: brand.colors.primary },
    },
    kbIconBtn: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        borderRadius: `${brand.radii.sm}px`,
        background: brand.colors.bgAlt,
        color: brand.colors.textMuted,
        cursor: 'pointer',
        transition: 'background .15s ease, color .15s ease',
        '&:hover': { background: brand.colors.primaryLight, color: brand.colors.primary },
    },
    submit: {
        mt: 0.25,
        height: 44,
        borderRadius: `${brand.radii.md}px`,
        textTransform: 'none',
        fontWeight: brand.typography.weights.bold,
        fontSize: 15,
        letterSpacing: 0.3,
        background: brand.gradients.primaryButton,
        boxShadow: brand.shadows.brand,
        transition: 'transform .15s ease, filter .15s ease',
        '&:hover': {
            background: brand.gradients.primaryButton,
            filter: 'brightness(1.05)',
            boxShadow: brand.shadows.brand,
            transform: 'translateY(-1px)',
        },
        '&:active': { transform: 'translateY(0)' },
    },

    footer: {
        marginTop: 0.25,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        paddingTop: 1.25,
        borderTop: `1px solid ${brand.colors.divider}`,
    },
    statusChip: (connected) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        padding: '3px 9px',
        borderRadius: `${brand.radii.pill}px`,
        fontSize: 10.5,
        fontWeight: brand.typography.weights.bold,
        letterSpacing: 0.4,
        color: connected ? brand.colors.success : brand.colors.danger,
        background: connected ? brand.colors.successBg : brand.colors.dangerBg,
    }),
    metaLine: {
        fontSize: 10.5,
        color: brand.colors.textMuted,
        fontFamily: brand.typography.monoFamily,
        letterSpacing: 0.3,
    },

    legal: {
        marginTop: 1.5,
        fontSize: 10.5,
        color: brand.colors.textSubtle,
        letterSpacing: 0.5,
    },
};

export default Login;
