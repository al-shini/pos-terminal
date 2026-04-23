import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faShieldHalved, faBan, faPenToSquare, faCircleXmark, faMagnifyingGlass,
    faFileCsv,
} from '@fortawesome/free-solid-svg-icons';

import classes from './Admin.module.css';
import { fetchAuditEvents, setAuditFilters } from '../../store/backofficeSlice';
import { downloadCsv } from './csvExport';

const todayStr = () => new Date().toISOString().slice(0, 10);

const fmt = (val) => {
    if (val === undefined || val === null || val === '') return '0.00';
    const n = Number(val);
    if (Number.isNaN(n)) return String(val);
    return n.toFixed(2);
};

const TYPES = [
    { id: 'VoidLine',    label: 'Void Line',    icon: faCircleXmark, cls: classes.TypeChipVoid },
    { id: 'VoidTrx',     label: 'Void Trx',     icon: faBan,          cls: classes.TypeChipRefund },
    { id: 'PriceChange', label: 'Price Change', icon: faPenToSquare,  cls: classes.TypeChipPrice },
];

const AuditPanel = () => {
    const dispatch = useDispatch();
    const slice = useSelector((state) => state.backoffice?.auditLog);
    const cashiers = useSelector((state) => state.backoffice?.cashiers) || [];
    const filters = slice?.filters || {};
    const rows = slice?.rows || [];
    const loading = slice?.loading;

    useEffect(() => {
        if (!filters.dateFrom && !filters.dateTo) {
            dispatch(setAuditFilters({ dateFrom: todayStr(), dateTo: todayStr() }));
            dispatch(fetchAuditEvents({ dateFrom: todayStr(), dateTo: todayStr() }));
        } else if (rows.length === 0 && !loading) {
            dispatch(fetchAuditEvents({}));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onChange = (key) => (e) => {
        dispatch(setAuditFilters({ [key]: e.target.value || null }));
    };

    const toggleType = (id) => {
        const cur = filters.types || [];
        const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
        dispatch(setAuditFilters({ types: next }));
    };

    const run = () => dispatch(fetchAuditEvents({}));

    const exportCsv = () => {
        const headers = ['Type', 'Date/Time', 'Cashier', 'Trx Serial', 'Line', 'Amount', 'Reason'];
        const dataRows = rows.map((r) => [
            r.type, r.atAsString || '', r.cashier || '',
            r.trxSerial ? `#${r.trxSerial}` : '',
            r.lineDescription || '', r.amount, r.reason || '',
        ]);
        downloadCsv(`audit-log-${todayStr()}.csv`, headers, dataRows);
    };

    return (
        <div className={classes.LookupCard}>
            <div className={classes.LookupCardHeader}>
                <h3 className={classes.LookupCardTitle}>
                    <FontAwesomeIcon icon={faShieldHalved} />
                    Audit Log — Voids &amp; Price Changes
                </h3>
                <div className={classes.LookupCardActions}>
                    <button className={classes.CsvBtn} onClick={exportCsv} disabled={rows.length === 0}>
                        <FontAwesomeIcon icon={faFileCsv} /> Export CSV
                    </button>
                </div>
            </div>

            <div className={classes.LookupCardBody}>
                <div className={classes.FilterStrip}>
                    <div className={classes.FilterField}>
                        <span className={classes.FilterFieldLabel}>Date From</span>
                        <input type="date" className={classes.FilterFieldInput}
                               value={filters.dateFrom || ''} onChange={onChange('dateFrom')} />
                    </div>
                    <div className={classes.FilterField}>
                        <span className={classes.FilterFieldLabel}>Date To</span>
                        <input type="date" className={classes.FilterFieldInput}
                               value={filters.dateTo || ''} onChange={onChange('dateTo')} />
                    </div>
                    <div className={classes.FilterField}>
                        <span className={classes.FilterFieldLabel}>Cashier</span>
                        <select className={classes.FilterFieldInput}
                                value={filters.cashierKey || ''} onChange={onChange('cashierKey')}>
                            <option value="">Any</option>
                            {cashiers.map((u) => (
                                <option key={u.key} value={u.key}>{u.employeeNumber || u.username}</option>
                            ))}
                        </select>
                    </div>
                    <div className={classes.FilterField}>
                        <span className={classes.FilterFieldLabel}>Events</span>
                        <div className={classes.FilterChipGroup}>
                            {TYPES.map((t) => (
                                <button
                                    key={t.id}
                                    className={`${classes.FilterChip} ${(filters.types || []).includes(t.id) ? classes.FilterChipActive : ''}`}
                                    onClick={() => toggleType(t.id)}
                                >
                                    <FontAwesomeIcon icon={t.icon} /> {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={classes.FilterStripActions}>
                    <button
                        className={`${classes.PillBtn} ${classes.PillBtnDanger} ${classes.PillBtnSmall}`}
                        onClick={run}
                        disabled={loading}
                    >
                        <span className={classes.PillBtnIcon}><FontAwesomeIcon icon={faMagnifyingGlass} /></span>
                        {loading ? 'Loading…' : 'Refresh'}
                    </button>
                </div>

                <div className={classes.DataTableWrap}>
                    <div className={classes.DataTableScroll}>
                        <table className={classes.DataTable}>
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>When</th>
                                    <th>Cashier</th>
                                    <th>Trx</th>
                                    <th>Line</th>
                                    <th style={{ textAlign: 'right' }}>Amount</th>
                                    <th>Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 && (
                                    <tr><td colSpan={7} className={classes.DataTableEmpty}>No audit events in this range.</td></tr>
                                )}
                                {rows.map((r, i) => {
                                    const t = TYPES.find((x) => x.id === r.type);
                                    const amtCls = r.type === 'PriceChange'
                                        ? (Number(r.amount) < 0 ? classes.AmountNegative : classes.AmountPositive)
                                        : classes.AmountNeutral;
                                    return (
                                        <tr key={i}>
                                            <td>
                                                <span className={`${classes.TypeChip} ${t?.cls || ''}`}>
                                                    {t && <FontAwesomeIcon icon={t.icon} />}
                                                    &nbsp;{r.type}
                                                </span>
                                            </td>
                                            <td>{r.atAsString || '—'}</td>
                                            <td>{r.cashier || '—'}</td>
                                            <td>{r.trxSerial ? `#${r.trxSerial}` : '—'}</td>
                                            <td>{r.lineDescription || '—'}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <span className={amtCls}>{fmt(r.amount)}</span>
                                            </td>
                                            <td>{r.reason || '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuditPanel;
