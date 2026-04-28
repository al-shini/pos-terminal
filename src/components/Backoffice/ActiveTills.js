import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from '../../axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faLock, faUsersGear, faRotate, faCheck, faArrowLeft,
    faCashRegister, faMoneyBillWave, faCoins, faScaleBalanced,
    faCircleExclamation, faCircleCheck, faEllipsisH,
    faShieldHalved, faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { Table, InputNumber } from 'rsuite';
import { notify } from '../../store/uiSlice';
import {
    setTills, setSelectedTill, updateBalance, submitTillCounts, closeTill,
    forceCloseTill,
} from '../../store/backofficeSlice';
import confirm from '../../components/UI/ConfirmDlg';
import classes from './Admin.module.css';
import config from '../../config';

const { Column, HeaderCell, Cell } = Table;

const STATUS_META = {
    O: { label: 'Open',   className: 'StatusChipOpen' },
    L: { label: 'Locked', className: 'StatusChipLocked' },
    R: { label: 'Review', className: 'StatusChipReview' },
    C: { label: 'Closed', className: 'StatusChipClosed' }
};

const translateStatus = (status) => (STATUS_META[status] ? STATUS_META[status].label : status);

const StatusChip = ({ status }) => {
    const meta = STATUS_META[status] || { label: status, className: 'StatusChipClosed' };
    return (
        <span className={`${classes.StatusChip} ${classes[meta.className]}`}>
            {meta.label}
        </span>
    );
};

const initials = (name) => {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
};

const UserCell = ({ rowData }) => (
    <span className={classes.UserCell}>
        <span className={classes.UserAvatar}>{initials(rowData.user && rowData.user.username)}</span>
        <span>{rowData.user ? rowData.user.username : '—'}</span>
    </span>
);

const NumberCell = ({ value, muted }) => (
    <span className={`${classes.CellNumber} ${muted ? classes.CellNumberMuted : ''}`}>
        {value === undefined || value === null ? '0' : value}
    </span>
);

const CurrencyIcon = ({ currency }) => {
    const key = (currency || '').toUpperCase();
    if (key === 'JOD' || key === 'NIS' || key === 'ILS') return <FontAwesomeIcon icon={faCoins} />;
    if (key === 'USD') return <FontAwesomeIcon icon={faMoneyBillWave} />;
    if (key === 'EUR') return <FontAwesomeIcon icon={faMoneyBillWave} />;
    return <FontAwesomeIcon icon={faCoins} />;
};

const ActiveTills = ({ superAdmin } = {}) => {
    const dispatch = useDispatch();
    const backofficeSlice = useSelector((state) => state.backoffice);
    const terminalSlice = useSelector((state) => state.terminal);

    const [closeMode, setCloseMode] = React.useState(false);
    const [forcePrompt, setForcePrompt] = React.useState(false);
    const [forcePwd, setForcePwd] = React.useState('');
    const [forceError, setForceError] = React.useState('');

    const selectedTill = backofficeSlice.selectedTill;
    const balances = selectedTill && selectedTill.balances ? selectedTill.balances : [];

    // Keep the exact same data shape mapping as before.
    const rows = useMemo(() => balances.map((bv, i) => ({
        key: i,
        paymentMethod: bv.paymentMethodDescription,
        paymentMethodKey: bv.paymentMethodKey,
        currency: bv.currency,
        closingBalance: bv.closingBalance + ' ' + bv.currency,
        counted: {
            value: bv.closingBalance,
            editable: selectedTill && selectedTill.status !== 'C',
            currency: bv.currency,
        },
        actual: {
            value:
                bv.currency === config.systemCurrency && bv.paymentMethodKey === 'Cash'
                    ? (selectedTill && selectedTill.actualBalance)
                    : bv.actualBalance,
            editable: false,
        },
        variance: {
            value:
                bv.currency === config.systemCurrency && bv.paymentMethodKey === 'Cash'
                    ? (selectedTill && selectedTill.variance)
                    : bv.ogCurrencyVariance,
            editable: false,
        },
    })), [balances, selectedTill]);

    // Group rows by currency, preserving first-seen order.
    const currencyGroups = useMemo(() => {
        const order = [];
        const map = new Map();
        rows.forEach((row) => {
            const cur = row.currency || '—';
            if (!map.has(cur)) {
                order.push(cur);
                map.set(cur, []);
            }
            map.get(cur).push(row);
        });
        return order.map((cur) => ({ currency: cur, rows: map.get(cur) }));
    }, [rows]);

    const handleChange = (e, i) => {
        dispatch(updateBalance({ i, balance: e }));
    };

    const loadActiveTills = () => {
        if (terminalSlice.store && backofficeSlice.workDay) {
            axios({
                method: 'post',
                url: '/bo/loadTills',
                headers: { workDayKey: backofficeSlice.workDay.key }
            }).then((response) => {
                if (response && response.data) {
                    dispatch(setTills(response.data));
                } else {
                    dispatch(notify({ msg: 'Incorrect server response', sev: 'error' }));
                }
            }).catch((error) => {
                if (error.response) {
                    if (error.response.status === 401) {
                        dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    } else if (error.response.status === 404) {
                        dispatch(notify({ msg: 'No Open Work Day For Store', sev: 'warning' }));
                    } else {
                        dispatch(notify({ msg: 'error: ' + error.response.data, sev: 'error' }));
                    }
                } else {
                    dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
                }
            });
        }
    };

    useEffect(() => {
        if (backofficeSlice.workDay) loadActiveTills();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCloseTill = (till) => {
        dispatch(setSelectedTill(till));
        setCloseMode(true);
    };

    const handleSubmitCount = () => {
        if (!selectedTill) {
            dispatch(notify({ msg: 'No valid selected till', sev: 'error' }));
            return;
        }
        dispatch(submitTillCounts(selectedTill.balances));
    };

    const handleForceClose = () => {
        if (!selectedTill) {
            dispatch(notify({ msg: 'No valid selected till', sev: 'error' }));
            return;
        }
        if (!forcePwd) {
            setForceError('Super admin password required');
            return;
        }
        dispatch(forceCloseTill({ tillKey: selectedTill.key, password: forcePwd }))
            .unwrap()
            .then(() => {
                setForcePrompt(false);
                setForcePwd('');
                setForceError('');
                setCloseMode(false);
            })
            .catch((err) => {
                setForceError(typeof err === 'string' ? err : 'Incorrect password');
            });
    };

    const handleFinalCloseTill = () => {
        if (!selectedTill) {
            dispatch(notify({ msg: 'No valid selected till', sev: 'error' }));
            return;
        }
        if (selectedTill.status === 'R') {
            dispatch(closeTill());
            setCloseMode(false);
        } else {
            dispatch(notify({ msg: 'Till not submitted', sev: 'warning' }));
        }
    };

    /* -------------------- LIST MODE -------------------- */

    if (!closeMode) {
        return (
            <>
                <div className={classes.SectionHeader}>
                    <h3 className={classes.SectionTitle}>
                        <span className={classes.SectionTitleIcon}>
                            <FontAwesomeIcon icon={faUsersGear} />
                        </span>
                        Active Tills
                    </h3>
                </div>

                <div className={classes.TillsCard}>
                    <div className={classes.TillsCardHeader}>
                        <h4 className={classes.TillsCardTitle}>
                            <FontAwesomeIcon icon={faCashRegister} />
                            Tills for this work day
                        </h4>
                        <button
                            type="button"
                            className={classes.IconBtn}
                            onClick={loadActiveTills}
                            title="Refresh tills"
                            aria-label="Refresh tills"
                        >
                            <FontAwesomeIcon icon={faRotate} />
                        </button>
                    </div>

                    <div className={classes.TableWrap}>
                        <Table
                            autoHeight
                            rowHeight={60}
                            headerHeight={44}
                            data={backofficeSlice.tills || []}
                            rowClassName="bo-tills-row"
                        >
                            <Column width={180} align="center">
                                <HeaderCell>Action</HeaderCell>
                                <Cell>
                                    {(rowData) => {
                                        const disabled = rowData.status !== 'L' && rowData.status !== 'R';
                                        return (
                                            <button
                                                type="button"
                                                className={`${classes.PillBtn} ${classes.PillBtnDanger} ${classes.PillBtnSmall}`}
                                                onClick={() => handleCloseTill(rowData)}
                                                disabled={disabled}
                                                title={disabled ? 'Till must be Locked or in Review' : 'Close this till'}
                                            >
                                                <span className={classes.PillBtnIcon}>
                                                    <FontAwesomeIcon icon={faLock} />
                                                </span>
                                                Close Till
                                            </button>
                                        );
                                    }}
                                </Cell>
                            </Column>
                            <Column width={140} align="center">
                                <HeaderCell>Status</HeaderCell>
                                <Cell>
                                    {(rowData) => <StatusChip status={rowData.status} />}
                                </Cell>
                            </Column>
                            <Column flexGrow={1} minWidth={220} align="left">
                                <HeaderCell>User</HeaderCell>
                                <Cell>
                                    {(rowData) => <UserCell rowData={rowData} />}
                                </Cell>
                            </Column>
                            <Column width={160} align="center">
                                <HeaderCell>Sale Trx</HeaderCell>
                                <Cell>
                                    {(rowData) => (
                                        <NumberCell
                                            value={rowData.currentSaleTrxCount}
                                            muted={!rowData.currentSaleTrxCount}
                                        />
                                    )}
                                </Cell>
                            </Column>
                            <Column width={160} align="center">
                                <HeaderCell>Refund Trx</HeaderCell>
                                <Cell>
                                    {(rowData) => (
                                        <NumberCell
                                            value={rowData.currentRefundTrxCount}
                                            muted={!rowData.currentRefundTrxCount}
                                        />
                                    )}
                                </Cell>
                            </Column>
                            <Column width={160} align="center">
                                <HeaderCell>Voided</HeaderCell>
                                <Cell>
                                    {(rowData) => (
                                        <NumberCell
                                            value={rowData.currentVoidedCount}
                                            muted={!rowData.currentVoidedCount}
                                        />
                                    )}
                                </Cell>
                            </Column>
                            <Column width={160} align="center">
                                <HeaderCell>Suspended</HeaderCell>
                                <Cell>
                                    {(rowData) => (
                                        <NumberCell
                                            value={rowData.currentSuspendedCount}
                                            muted={!rowData.currentSuspendedCount}
                                        />
                                    )}
                                </Cell>
                            </Column>
                        </Table>

                        {(!backofficeSlice.tills || backofficeSlice.tills.length === 0) && (
                            <div className={classes.EmptyState} style={{ margin: 12 }}>
                                <span className={classes.EmptyStateIcon}>
                                    <FontAwesomeIcon icon={faEllipsisH} />
                                </span>
                                <span className={classes.EmptyStateTitle}>No tills yet</span>
                                <span className={classes.EmptyStateText}>
                                    Tills will appear here once cashiers open them.
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </>
        );
    }

    /* -------------------- CLOSE-TILL WORKSPACE -------------------- */

    const username = selectedTill && selectedTill.user ? selectedTill.user.username : '—';
    const terminalKey = selectedTill && selectedTill.terminal ? (selectedTill.terminal.description || selectedTill.terminal.key) : null;
    const openingBalance = selectedTill && selectedTill.openingBalance;
    const variance = selectedTill ? selectedTill.totalNisVariance : 0;
    const hasReview = selectedTill && selectedTill.status === 'R';
    const varianceIsPositive = Number(variance) >= 0;

    return (
        <div className={classes.CloseTillShell}>
            <div className={classes.CloseTillHeader}>
                <button
                    type="button"
                    className={classes.BackChip}
                    onClick={() => setCloseMode(false)}
                >
                    <FontAwesomeIcon icon={faArrowLeft} />
                    Back to tills
                </button>

                <div className={classes.CloseTillCashier}>
                    <span className={classes.CloseTillCashierLabel}>Cashier</span>
                    <span className={classes.CloseTillCashierName}>
                        <span className={classes.UserAvatar}>{initials(username)}</span>
                        {username}
                        {selectedTill && <StatusChip status={selectedTill.status} />}
                    </span>
                </div>

                <div className={classes.CloseTillMeta}>
                    {terminalKey && (
                        <span className={classes.CloseTillMetaPill}>
                            <FontAwesomeIcon icon={faCashRegister} style={{ color: '#6B7280' }} />
                            Terminal <b>{terminalKey}</b>
                        </span>
                    )}
                    {openingBalance !== undefined && openingBalance !== null && (
                        <span className={classes.CloseTillMetaPill}>
                            <FontAwesomeIcon icon={faCoins} style={{ color: '#6B7280' }} />
                            Opening <b>{openingBalance}</b>
                        </span>
                    )}
                </div>
            </div>

            {hasReview && (
                <div
                    className={`${classes.VarianceBanner} ${varianceIsPositive ? classes.VarianceBannerPositive : classes.VarianceBannerNegative}`}
                >
                    <span className={classes.VarianceBannerIcon}>
                        <FontAwesomeIcon icon={varianceIsPositive ? faCircleCheck : faCircleExclamation} />
                    </span>
                    <div>
                        <div className={classes.VarianceBannerLabel}>Final till variance</div>
                        <div className={classes.VarianceBannerTitle}>
                            {varianceIsPositive
                                ? 'Till balances within tolerance.'
                                : 'Cash shortage detected — please re-verify the counts.'}
                        </div>
                    </div>
                    <div className={classes.VarianceBannerAmount}>
                        {variance} <span style={{ fontSize: 18, marginLeft: 6, letterSpacing: 1 }}>{config.currencySymbol}</span>
                    </div>
                </div>
            )}

            {currencyGroups.length === 0 && (
                <div className={classes.EmptyState}>
                    <span className={classes.EmptyStateIcon}>
                        <FontAwesomeIcon icon={faScaleBalanced} />
                    </span>
                    <span className={classes.EmptyStateTitle}>No balances to count</span>
                    <span className={classes.EmptyStateText}>
                        This till has no balance rows. Go back and re-load the tills list.
                    </span>
                </div>
            )}

            <div className={classes.CurrencyGroups}>
                {currencyGroups.map((group) => (
                    <div className={classes.CurrencyGroup} key={group.currency}>
                        <div className={classes.CurrencyGroupHeader}>
                            <h4 className={classes.CurrencyGroupTitle}>
                                <CurrencyIcon currency={group.currency} />
                                {group.currency}
                            </h4>
                            <span className={classes.CurrencyBadge}>{group.currency}</span>
                        </div>

                        <div className={classes.CurrencyGroupBody}>
                            <div className={classes.CountRowHeader}>
                                <span>Payment Method</span>
                                <span>Counted</span>
                                {hasReview && <span>Actual</span>}
                                {hasReview && <span>Variance</span>}
                            </div>

                            {group.rows.map((row) => (
                                <div className={classes.CountRow} key={row.key}>
                                    <span className={classes.CountRowLabel}>
                                        <span className={classes.CountRowLabelIcon}>
                                            <FontAwesomeIcon icon={faCoins} />
                                        </span>
                                        {row.paymentMethod}
                                    </span>

                                    <span className={classes.CountInputWrap}>
                                        <InputNumber
                                            disabled={!row.counted.editable}
                                            prefix={row.counted.currency}
                                            value={row.counted.value}
                                            onChange={(value) => handleChange(value, row.key)}
                                        />
                                    </span>

                                    {hasReview && (
                                        <span className={classes.CountInputWrap}>
                                            <InputNumber
                                                disabled
                                                prefix={row.counted.currency}
                                                value={row.actual.value}
                                            />
                                        </span>
                                    )}

                                    {hasReview && (
                                        <span className={classes.CountInputWrap}>
                                            <InputNumber
                                                disabled
                                                prefix={row.counted.currency}
                                                value={row.variance.value}
                                            />
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className={classes.ActionBar}>
                <div className={classes.ActionBarGroup}>
                    <button
                        type="button"
                        className={classes.GhostBtn}
                        onClick={() => setCloseMode(false)}
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                        Back
                    </button>
                    <span className={classes.ActionBarStatus}>
                        {selectedTill && (
                            <>
                                <span>Status</span>
                                <StatusChip status={selectedTill.status} />
                            </>
                        )}
                    </span>
                </div>

                <div className={classes.ActionBarGroup}>
                    {superAdmin && selectedTill && selectedTill.status !== 'C' && (
                        <button
                            type="button"
                            className={`${classes.PillBtn} ${classes.PillBtnWarning}`}
                            onClick={() => {
                                setForcePwd('');
                                setForceError('');
                                setForcePrompt(true);
                            }}
                            title="Super-admin override: close till regardless of status"
                        >
                            <span className={classes.PillBtnIcon}>
                                <FontAwesomeIcon icon={faShieldHalved} />
                            </span>
                            Force Close
                        </button>
                    )}
                    <button
                        type="button"
                        className={`${classes.PillBtn} ${classes.PillBtnSuccess}`}
                        onClick={handleSubmitCount}
                        disabled={!selectedTill || selectedTill.status === 'C'}
                        title={
                            !selectedTill || selectedTill.status === 'C'
                                ? 'Till already closed'
                                : 'Submit the counted balances for review'
                        }
                    >
                        <span className={classes.PillBtnIcon}>
                            <FontAwesomeIcon icon={faCheck} />
                        </span>
                        Submit Counting
                    </button>
                    <button
                        type="button"
                        className={`${classes.PillBtn} ${classes.PillBtnDanger}`}
                        disabled={!hasReview}
                        title={
                            hasReview
                                ? 'Permanently close this till for the work day'
                                : 'Submit the counting first (till must be in Review)'
                        }
                        onClick={() => {
                            confirm(
                                'Close Till?',
                                'The till will be permanently closed for this work day.',
                                () => { handleFinalCloseTill(); },
                                'danger'
                            );
                        }}
                    >
                        <span className={classes.PillBtnIcon}>
                            <FontAwesomeIcon icon={faLock} />
                        </span>
                        Close Till
                    </button>
                </div>
            </div>

            {forcePrompt && (
                <div className={classes.SuperAdminOverlay}>
                    <div className={classes.SuperAdminDialog}>
                        <div className={classes.SuperAdminDialogHeader}>
                            <FontAwesomeIcon icon={faShieldHalved} />
                            Force Close Till
                        </div>
                        <div className={classes.SuperAdminDialogBody}>
                            <label>Super Admin Password</label>
                            <input
                                type="password"
                                autoFocus
                                value={forcePwd}
                                onChange={(e) => {
                                    setForcePwd(e.target.value);
                                    if (forceError) setForceError('');
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleForceClose();
                                    if (e.key === 'Escape') setForcePrompt(false);
                                }}
                            />
                            {forceError && (
                                <div style={{ color: '#B3141B', fontSize: 12, fontWeight: 600 }}>{forceError}</div>
                            )}
                            <div className={classes.SuperAdminDialogHint}>
                                This bypasses the normal Locked/Review requirement and marks the till as Closed.
                                The action will be recorded in the audit log.
                            </div>
                        </div>
                        <div className={classes.SuperAdminDialogActions}>
                            <button
                                className={`${classes.PillBtn} ${classes.PillBtnGhost} ${classes.PillBtnSmall}`}
                                onClick={() => setForcePrompt(false)}
                            >
                                <span className={classes.PillBtnIcon}><FontAwesomeIcon icon={faXmark} /></span>
                                Cancel
                            </button>
                            <button
                                className={`${classes.PillBtn} ${classes.PillBtnWarning} ${classes.PillBtnSmall}`}
                                onClick={handleForceClose}
                            >
                                <span className={classes.PillBtnIcon}><FontAwesomeIcon icon={faCheck} /></span>
                                Force Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export { translateStatus };
export default ActiveTills;
