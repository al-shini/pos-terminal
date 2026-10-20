import React, { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import axiosImport from 'axios';
import config from '../../config';
import brand from '../../theme/brand';

// The Electron express app (public/electron.js) serves /localConfig and
// /restart on this port. Same fallback chain as trxSlice's print calls.
const LOCAL_PORT = config.expressPort ? config.expressPort : 3001;
const localAxios = axiosImport.create({ baseURL: `http://localhost:${LOCAL_PORT}/` });

// Known posconfig.json fields, offered as one-tap chips when absent. The
// defaults are what a fresh install typically needs to fill in.
const KNOWN_FIELDS = [
    { key: 'serverIp', def: '127.0.0.1' },
    { key: 'deviceId', def: '' },
    { key: 'tenant', def: 'palestine' },
    { key: 'admin', def: false },
    { key: 'selfService', def: false },
    { key: 'showCustomerScreen', def: false },
    { key: 'scale', def: false },
    { key: 'scaleAlphabet', def: false },
    { key: 'scaleCOM', def: 'COM1' },
    { key: 'autoUpdate', def: false },
    { key: 'printMethod', def: 'default' },
    { key: 'printTemplate', def: 'qr' },
    { key: 'systemCurrency', def: 'NIS' },
    { key: 'expressPort', def: 3001 },
    // Arab Bank Visa card terminal (COM) + its local Windows service. Read by
    // BOTH this app (public/arabBankVisa.js) and the service (lib/config.js).
    { key: 'arabiVisaCom', def: 'COM9' },
    { key: 'arabiVisaBaudRate', def: 115200 },
    { key: 'arabiVisaServicePort', def: 9700 },
    { key: 'arabiVisaTimeoutSec', def: 90 },
    { key: 'arabiVisaEnableReceipt', def: true },
];

// Keys that hold a serial port name get a dropdown of the ports currently
// present on this PC (with free-text fallback for a port that is unplugged).
const isComKey = (key) => /com$/i.test(key || '');

const normaliseCom = (v) => {
    const s = String(v === undefined || v === null ? '' : v).trim().toUpperCase();
    const m = s.match(/COM\s*(\d+)/);
    return m ? `COM${m[1]}` : s;
};

// Rows keep values as their real JSON type so booleans render as switches
// and numbers as numeric fields. Strings that LOOK like other types are
// normalized on save (see parseValue).
const toRows = (obj) => Object.keys(obj).map((k) => ({ key: k, value: obj[k] }));

const parseValue = (v) => {
    if (typeof v !== 'string') return v; // already boolean/number/object
    const t = v.trim();
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (t !== '' && !isNaN(Number(t)) && !/^0\d/.test(t)) return Number(t);
    // JSON objects/arrays typed as text
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
        try { return JSON.parse(t); } catch (_) { /* keep as string */ }
    }
    return v;
};

/**
 * Login-screen editor for C:/pos/posconfig.json. Creates the file when it
 * doesn't exist, edits/adds/removes arbitrary fields, and on save writes the
 * whole file then restarts the app so main + renderer reload it completely.
 * Works identically in normal POS and self-service mode (both boot through
 * the login screen).
 */
const PosConfigEditor = ({ open, onClose }) => {
    const [state, setState] = useState({ loading: true, error: null, exists: true, path: '' });
    const [rows, setRows] = useState([]);
    const [newKey, setNewKey] = useState('');
    const [saving, setSaving] = useState(false);
    const [serialPorts, setSerialPorts] = useState([]);
    // COM rows where the user chose "Other…" and is typing a port by hand.
    const [manualCom, setManualCom] = useState({});

    useEffect(() => {
        if (!open) return;
        setState({ loading: true, error: null, exists: true, path: '' });
        setManualCom({});
        localAxios.get('/serialPorts', { timeout: 10000 }).then((res) => {
            setSerialPorts((res.data && res.data.ports) || []);
        }).catch(() => setSerialPorts([]));
        localAxios.get('/localConfig').then((res) => {
            const data = res.data || {};
            setRows(toRows(data.config || {}));
            setState({ loading: false, error: null, exists: !!data.exists, path: data.path || 'C:/pos/posconfig.json' });
        }).catch((err) => {
            setState({
                loading: false,
                exists: false,
                path: 'C:/pos/posconfig.json',
                error: 'Could not reach the local terminal service: '
                    + (err && err.message)
                    + '. The editor only works inside the POS app (Electron).',
            });
            setRows([]);
        });
    }, [open]);

    const setRowValue = (idx, value) => {
        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, value } : r)));
    };

    const removeRow = (idx) => {
        setRows((prev) => prev.filter((_, i) => i !== idx));
    };

    const addField = (key, def = '') => {
        const k = (key || '').trim();
        if (!k) return;
        if (rows.some((r) => r.key === k)) return;
        setRows((prev) => [...prev, { key: k, value: def }]);
        setNewKey('');
    };

    const missingKnown = KNOWN_FIELDS.filter((f) => !rows.some((r) => r.key === f.key));

    // COM-port sanity: the same port assigned twice (scale vs card terminal)
    // means one of them can never open it. Save is blocked until fixed.
    const comRows = rows.filter((r) => isComKey(r.key) && normaliseCom(r.value));
    const comDuplicates = comRows.filter((r, i) => comRows.some((o, j) => j !== i && normaliseCom(o.value) === normaliseCom(r.value)));
    const comConflictText = comDuplicates.length
        ? `${comDuplicates.map((r) => r.key).join(' and ')} point at the same port (${normaliseCom(comDuplicates[0].value)}). The scale and the card terminal cannot share a COM port.`
        : null;
    const presentPortNames = serialPorts.map((p) => normaliseCom(p.path));
    const absentComRows = comRows.filter((r) => presentPortNames.length && presentPortNames.indexOf(normaliseCom(r.value)) < 0);

    const handleSave = async () => {
        if (comConflictText) return; // button is disabled too; belt and braces
        const cfg = {};
        for (const r of rows) {
            if (!r.key || !r.key.trim()) continue;
            const key = r.key.trim();
            cfg[key] = isComKey(key) ? normaliseCom(r.value) : parseValue(r.value);
        }
        setSaving(true);
        try {
            await localAxios.post('/localConfig', cfg);
            // Full reload: relaunch Electron so BOTH the main process (window
            // layout, customer screen, print method) and the renderer pick up
            // the new file from scratch.
            try { await localAxios.get('/restart'); } catch (_) { /* app is exiting */ }
        } catch (err) {
            setState((prev) => ({
                ...prev,
                error: 'Save failed: ' + (err.response && err.response.data ? err.response.data : err.message),
            }));
            setSaving(false);
        }
    };

    const renderValueEditor = (row, idx) => {
        if (isComKey(row.key) && typeof row.value !== 'boolean') {
            const current = normaliseCom(row.value);
            const inList = presentPortNames.indexOf(current) >= 0;
            const manual = !!manualCom[row.key] || (!!current && !inList) || serialPorts.length === 0;
            const OTHER = '__other__';
            return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
                        select
                        size="small"
                        value={manual ? OTHER : (current || '')}
                        onChange={(e) => {
                            if (e.target.value === OTHER) {
                                setManualCom((prev) => ({ ...prev, [row.key]: true }));
                            } else {
                                setManualCom((prev) => ({ ...prev, [row.key]: false }));
                                setRowValue(idx, e.target.value);
                            }
                        }}
                        SelectProps={{ native: true }}
                        sx={{ width: manual ? 170 : 320 }}
                        inputProps={{ style: { fontFamily: brand.typography.monoFamily, fontSize: 13.5 } }}
                    >
                        <option value="">— select port —</option>
                        {serialPorts.map((p) => (
                            <option key={p.path} value={normaliseCom(p.path)}>
                                {normaliseCom(p.path)}{p.friendlyName ? ` · ${p.friendlyName.replace(/\s*\(COM\d+\)\s*$/, '')}` : (p.manufacturer ? ` · ${p.manufacturer}` : '')}
                            </option>
                        ))}
                        <option value={OTHER}>Other / not plugged in…</option>
                    </TextField>
                    {manual && (
                        <TextField
                            size="small"
                            placeholder="COM9"
                            value={String(row.value === undefined || row.value === null ? '' : row.value)}
                            onChange={(e) => setRowValue(idx, e.target.value)}
                            onBlur={(e) => setRowValue(idx, normaliseCom(e.target.value))}
                            sx={{ width: 140 }}
                            inputProps={{ style: { fontFamily: brand.typography.monoFamily, fontSize: 13.5 } }}
                        />
                    )}
                    {current && !inList && presentPortNames.length > 0 && (
                        <Chip size="small" color="warning" variant="outlined" label="not present now" sx={{ fontSize: 11 }} />
                    )}
                </Box>
            );
        }
        if (typeof row.value === 'boolean') {
            return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Switch
                        checked={row.value}
                        onChange={(e) => setRowValue(idx, e.target.checked)}
                        size="small"
                    />
                    <Box sx={{ fontSize: 13, color: brand.colors.textMuted, fontFamily: brand.typography.monoFamily }}>
                        {String(row.value)}
                    </Box>
                </Box>
            );
        }
        const display = typeof row.value === 'object' && row.value !== null
            ? JSON.stringify(row.value)
            : String(row.value === undefined || row.value === null ? '' : row.value);
        return (
            <TextField
                fullWidth
                size="small"
                value={display}
                type={typeof row.value === 'number' ? 'number' : 'text'}
                onChange={(e) => setRowValue(idx, e.target.value)}
                inputProps={{ style: { fontFamily: brand.typography.monoFamily, fontSize: 13.5 } }}
            />
        );
    };

    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pb: 1 }}>
                <SettingsRoundedIcon sx={{ color: brand.colors.primary }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    Terminal Configuration
                    <Box sx={{ fontSize: 12, fontWeight: 400, color: brand.colors.textMuted, fontFamily: brand.typography.monoFamily }}>
                        {state.path || 'C:/pos/posconfig.json'}
                    </Box>
                </Box>
            </DialogTitle>

            <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {state.loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                        <CircularProgress size={28} />
                    </Box>
                )}

                {!state.loading && state.error && (
                    <Alert severity="error">{state.error}</Alert>
                )}

                {!state.loading && !state.error && !state.exists && (
                    <Alert severity="warning">
                        No configuration file found — it will be created on save. Add the
                        fields you need below (tap a suggested field or type a custom key).
                    </Alert>
                )}

                {!state.loading && comConflictText && (
                    <Alert severity="error">{comConflictText}</Alert>
                )}

                {!state.loading && !comConflictText && absentComRows.length > 0 && (
                    <Alert severity="warning">
                        {absentComRows.map((r) => `${r.key} = ${normaliseCom(r.value)}`).join(', ')} — not detected on this PC right now
                        (present: {presentPortNames.join(', ') || 'none'}). Plug the device in, or pick a port from the list.
                    </Alert>
                )}

                {!state.loading && !state.error && (
                    <>
                        {/* Existing fields */}
                        {rows.length === 0 && (
                            <Box sx={{ textAlign: 'center', color: brand.colors.textMuted, fontSize: 13.5, py: 2 }}>
                                No fields yet.
                            </Box>
                        )}
                        {rows.map((row, idx) => (
                            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                                <Box sx={{
                                    width: 210, flexShrink: 0, fontFamily: brand.typography.monoFamily,
                                    fontSize: 13.5, fontWeight: 700, color: brand.colors.ink,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                    {row.key}
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    {renderValueEditor(row, idx)}
                                </Box>
                                <IconButton size="small" onClick={() => removeRow(idx)} aria-label={`remove ${row.key}`}>
                                    <DeleteOutlineRoundedIcon sx={{ fontSize: 20, color: brand.colors.danger }} />
                                </IconButton>
                            </Box>
                        ))}

                        {/* Add custom field */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mt: 1 }}>
                            <TextField
                                size="small"
                                label="New field key"
                                value={newKey}
                                onChange={(e) => setNewKey(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') addField(newKey); }}
                                sx={{ width: 260 }}
                                inputProps={{ style: { fontFamily: brand.typography.monoFamily, fontSize: 13.5 } }}
                            />
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<AddRoundedIcon />}
                                disabled={!newKey.trim() || rows.some((r) => r.key === newKey.trim())}
                                onClick={() => addField(newKey)}
                            >
                                Add field
                            </Button>
                        </Box>

                        {/* Known-field suggestions */}
                        {missingKnown.length > 0 && (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                                {missingKnown.map((f) => (
                                    <Chip
                                        key={f.key}
                                        label={f.key}
                                        size="small"
                                        variant="outlined"
                                        onClick={() => addField(f.key, f.def)}
                                        sx={{ fontFamily: brand.typography.monoFamily, fontSize: 12 }}
                                    />
                                ))}
                            </Box>
                        )}
                    </>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 1.75 }}>
                <Box sx={{ flex: 1, fontSize: 12, color: brand.colors.textMuted }}>
                    Saving rewrites the whole file and restarts the app.
                </Box>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving || state.loading || !!(state.error) || !!comConflictText}
                    startIcon={saving ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : null}
                >
                    {saving ? 'Saving — restarting…' : 'Save & Restart'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default PosConfigEditor;
