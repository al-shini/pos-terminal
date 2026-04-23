import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalendarDay, faUsersGear, faSignOut, faStore, faCircleDot,
    faReceipt, faUserGroup, faChartColumn,
    faMagnifyingGlass, faShieldHalved, faSpinner, faXmark, faCheck,
} from '@fortawesome/free-solid-svg-icons';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { Alert, Snackbar } from '@mui/material';

import classes from './Admin.module.css';
import Logo from '../../assets/full-logo.png';
import WorkDaySetup from './WorkDaySetup';
import ActiveTills from './ActiveTills';
import InvoicesLookup from './InvoicesLookup';
import CustomerLookup from './CustomerLookup';
import Reports from './Reports';
import InvoicePrintA4 from './InvoicePrintA4';
import confirm from '../UI/ConfirmDlg';
import {
    setActiveTab,
    setGlobalSearchQuery,
    setTrxFilters,
    setCustomerQuery,
    searchTrx,
    searchCustomers,
    fetchCashiers,
    clearPrintInvoiceKey,
} from '../../store/backofficeSlice';

const TAB_KEYS = ['day', 'tills', 'invoices', 'loyalty', 'reports'];

// Gate for the Super-Admin shield. The only action currently behind it is
// "Force Close Till", which we're disabling for now — so the whole shield UI
// (and its password prompt) is hidden until we bring another super-admin
// feature online. Flip this to true to re-enable without touching the rest
// of the file.
const SUPER_ADMIN_ENABLED = false;

const Admin = () => {
    const dispatch = useDispatch();
    const uiSlice = useSelector((state) => state.ui);
    const backofficeSlice = useSelector((state) => state.backoffice);
    const terminalSlice = useSelector((state) => state.terminal);

    const activeTab = backofficeSlice?.activeTab || 'day';
    const tabIndex = Math.max(0, TAB_KEYS.indexOf(activeTab));
    const printInvoiceKey = backofficeSlice?.printInvoiceKey || null;

    const [superAdmin, setSuperAdmin] = useState(false);
    const [superAdminPrompt, setSuperAdminPrompt] = useState(false);
    const [superAdminInput, setSuperAdminInput] = useState('');
    const [superAdminError, setSuperAdminError] = useState('');
    const [globalQuery, setLocalGlobalQuery] = useState('');
    const [globalResolving, setGlobalResolving] = useState(false);

    const searchInputRef = useRef(null);

    useEffect(() => {
        dispatch(fetchCashiers());
    }, [dispatch]);

    const handleChange = (_event, newValue) => {
        dispatch(setActiveTab(TAB_KEYS[newValue] || 'day'));
    };

    const handleExit = () => {
        confirm('Exit Back Office?', 'The admin console window will close.', () => {
            window.close();
        }, 'danger');
    };

    const handleSuperAdminToggle = () => {
        if (superAdmin) {
            setSuperAdmin(false);
            return;
        }
        setSuperAdminInput('');
        setSuperAdminError('');
        setSuperAdminPrompt(true);
    };

    const confirmSuperAdmin = () => {
        if (!superAdminInput) {
            setSuperAdminError('Password required');
            return;
        }
        // We trust the password; individual destructive endpoints re-verify
        // server-side (e.g. forceCloseTill). The shield just unlocks the UI.
        setSuperAdmin(true);
        setSuperAdminPrompt(false);
        setSuperAdminInput('');
    };

    // Global search — best-effort resolver:
    // - numeric => trx serial lookup
    // - 21 chars => nanoId lookup
    // - starts with LC / digits => loyalty customer
    // - else => loyalty name
    const runGlobalSearch = async () => {
        const q = (globalQuery || '').trim();
        if (!q) return;
        setGlobalResolving(true);
        dispatch(setGlobalSearchQuery(q));
        try {
            if (/^\d+$/.test(q)) {
                dispatch(setTrxFilters({ serial: q, nanoId: '', offset: 0 }));
                dispatch(setActiveTab('invoices'));
                await dispatch(searchTrx({ serial: q, nanoId: '', offset: 0 }));
            } else if (q.length >= 18 && /^[A-Za-z0-9_-]+$/.test(q)) {
                dispatch(setTrxFilters({ serial: '', nanoId: q, offset: 0 }));
                dispatch(setActiveTab('invoices'));
                await dispatch(searchTrx({ serial: '', nanoId: q, offset: 0 }));
            } else if (/^\+?\d[\d\s-]{5,}$/.test(q)) {
                dispatch(setCustomerQuery({ query: q, field: 'mobile' }));
                dispatch(setActiveTab('loyalty'));
                await dispatch(searchCustomers({ query: q, field: 'mobile' }));
            } else {
                dispatch(setCustomerQuery({ query: q, field: 'any' }));
                dispatch(setActiveTab('loyalty'));
                await dispatch(searchCustomers({ query: q, field: 'any' }));
            }
        } finally {
            setGlobalResolving(false);
        }
    };

    const onGlobalKeyDown = (e) => {
        if (e.key === 'Enter') runGlobalSearch();
        if (e.key === 'Escape') setLocalGlobalQuery('');
    };

    const store = terminalSlice && terminalSlice.store;
    const storeLabel = store ? (store.description || store.key) : null;
    const workDay = backofficeSlice && backofficeSlice.workDay;
    const businessDate = workDay && workDay.businessDateAsString;

    const contextValue = useMemo(() => ({ superAdmin }), [superAdmin]);

    return (
        <div className={classes.Shell}>
            <div className={classes.TopBar}>
                <div className={classes.BrandBlock}>
                    <img src={Logo} alt="Shini" className={classes.BrandLogo} />
                    <div className={classes.BrandTitle}>
                        <b>Back Office</b>
                        <small>Admin Console</small>
                    </div>
                </div>

                <div className={classes.StorePill}>
                    {storeLabel && (
                        <>
                            <FontAwesomeIcon icon={faStore} style={{ color: '#B3141B', fontSize: 12 }} />
                            <span className={classes.StorePillLabel}>Store</span>
                            <span className={classes.StorePillValue}>{storeLabel}</span>
                        </>
                    )}
                    {businessDate && (
                        <>
                            <span className={classes.StorePillDot} />
                            <span className={classes.StorePillLabel}>Day</span>
                            <span className={classes.StorePillDate}>{businessDate}</span>
                        </>
                    )}
                    {!storeLabel && !businessDate && (
                        <>
                            <FontAwesomeIcon icon={faCircleDot} style={{ color: '#9CA3AF', fontSize: 11 }} />
                            <span className={classes.StorePillLabel}>Loading</span>
                        </>
                    )}
                </div>

                <div className={classes.TopBarRight}>
                    <div className={classes.TopBarSearch}>
                        <FontAwesomeIcon icon={faMagnifyingGlass} className={classes.TopBarSearchIcon} />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search trx serial, nanoId, mobile, name…"
                            value={globalQuery}
                            onChange={(e) => setLocalGlobalQuery(e.target.value)}
                            onKeyDown={onGlobalKeyDown}
                        />
                        {globalResolving && (
                            <FontAwesomeIcon icon={faSpinner} spin className={classes.TopBarSearchSpinner} />
                        )}
                    </div>

                    {SUPER_ADMIN_ENABLED && (
                        <button
                            type="button"
                            className={`${classes.SuperAdminShield} ${superAdmin ? classes.SuperAdminShieldActive : ''}`}
                            onClick={handleSuperAdminToggle}
                            title={superAdmin ? 'Super-admin mode active — click to disable' : 'Enable super-admin actions'}
                        >
                            <FontAwesomeIcon icon={faShieldHalved} />
                            {superAdmin ? 'Super' : 'Super Admin'}
                        </button>
                    )}

                    <button type="button" className={classes.ExitBtn} onClick={handleExit}>
                        <FontAwesomeIcon icon={faSignOut} />
                        Exit
                    </button>
                </div>
            </div>

            <div className={classes.NavBar}>
                <Tabs
                    value={tabIndex}
                    onChange={handleChange}
                    className={classes.TabSwitch}
                    aria-label="Back office sections"
                    variant="scrollable"
                    scrollButtons={false}
                >
                    <Tab disableRipple label={<span className={classes.TabLabel}><FontAwesomeIcon icon={faCalendarDay} />Day Overview</span>} />
                    <Tab disableRipple label={<span className={classes.TabLabel}><FontAwesomeIcon icon={faUsersGear} />Active Tills</span>} />
                    <Tab disableRipple label={<span className={classes.TabLabel}><FontAwesomeIcon icon={faReceipt} />Invoices</span>} />
                    <Tab disableRipple label={<span className={classes.TabLabel}><FontAwesomeIcon icon={faUserGroup} />Loyalty</span>} />
                    <Tab disableRipple label={<span className={classes.TabLabel}><FontAwesomeIcon icon={faChartColumn} />Reports</span>} />
                </Tabs>
            </div>

            <div className={classes.AccentBar} />

            <div className={classes.ContentScroll}>
                {activeTab === 'day' && <WorkDaySetup />}
                {activeTab === 'tills' && <ActiveTills superAdmin={contextValue.superAdmin} />}
                {activeTab === 'invoices' && <InvoicesLookup />}
                {activeTab === 'loyalty' && <CustomerLookup />}
                {activeTab === 'reports' && <Reports />}
            </div>

            {printInvoiceKey && (
                <InvoicePrintA4
                    trxKey={printInvoiceKey}
                    onClose={() => dispatch(clearPrintInvoiceKey())}
                />
            )}

            {SUPER_ADMIN_ENABLED && superAdminPrompt && (
                <div className={classes.SuperAdminOverlay}>
                    <div className={classes.SuperAdminDialog}>
                        <div className={classes.SuperAdminDialogHeader}>
                            <FontAwesomeIcon icon={faShieldHalved} />
                            Super Admin Access
                        </div>
                        <div className={classes.SuperAdminDialogBody}>
                            <label>Password</label>
                            <input
                                type="password"
                                autoFocus
                                value={superAdminInput}
                                onChange={(e) => {
                                    setSuperAdminInput(e.target.value);
                                    if (superAdminError) setSuperAdminError('');
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') confirmSuperAdmin();
                                    if (e.key === 'Escape') setSuperAdminPrompt(false);
                                }}
                            />
                            {superAdminError && (
                                <div style={{ color: '#B3141B', fontSize: 12, fontWeight: 600 }}>{superAdminError}</div>
                            )}
                            <div className={classes.SuperAdminDialogHint}>
                                Unlocks destructive actions like force-closing a till.
                                Each action will still re-verify the password with the backend.
                            </div>
                        </div>
                        <div className={classes.SuperAdminDialogActions}>
                            <button
                                className={`${classes.PillBtn} ${classes.PillBtnGhost} ${classes.PillBtnSmall}`}
                                onClick={() => setSuperAdminPrompt(false)}
                            >
                                <span className={classes.PillBtnIcon}><FontAwesomeIcon icon={faXmark} /></span>
                                Cancel
                            </button>
                            <button
                                className={`${classes.PillBtn} ${classes.PillBtnWarning} ${classes.PillBtnSmall}`}
                                onClick={confirmSuperAdmin}
                            >
                                <span className={classes.PillBtnIcon}><FontAwesomeIcon icon={faCheck} /></span>
                                Unlock
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Snackbar
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                open={uiSlice.toastOpen}
            >
                <Alert severity={uiSlice.toastType} sx={{ width: '100%' }}>
                    {uiSlice.toastMsg}
                </Alert>
            </Snackbar>
        </div>
    );
};

export default Admin;
