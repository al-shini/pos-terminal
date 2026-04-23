import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faReceipt, faMagnifyingGlass, faFileCsv, faRotateLeft, faFilter,
} from '@fortawesome/free-solid-svg-icons';

import classes from './Admin.module.css';
import {
    searchTrx, setTrxFilters, resetTrxSearch,
} from '../../store/backofficeSlice';
import InvoiceDetailDrawer from './InvoiceDetailDrawer';
import { downloadCsv } from './csvExport';

const todayStr = () => new Date().toISOString().slice(0, 10);

const fmtAmount = (val) => {
    if (val === undefined || val === null || val === '') return '0.00';
    const n = Number(val);
    if (Number.isNaN(n)) return String(val);
    return n.toFixed(2);
};

const TYPE_OPTIONS = ['All', 'Sale', 'Refund'];
const STATUS_OPTIONS = ['All', 'CLOSED', 'VOIDED', 'SUSPENDED'];

const InvoicesLookup = () => {
    const dispatch = useDispatch();
    const slice = useSelector((state) => state.backoffice?.trxSearch);
    const cashiers = useSelector((state) => state.backoffice?.cashiers) || [];
    const filters = slice?.filters || {};
    const rows = slice?.rows || [];
    const totalCount = slice?.totalCount || 0;
    const loading = slice?.loading;

    const [selectedTrxKey, setSelectedTrxKey] = useState(null);

    useEffect(() => {
        // Seed dates to "today" only on first mount if empty.
        if (!filters.dateFrom && !filters.dateTo && !filters.serial && !filters.nanoId) {
            dispatch(setTrxFilters({ dateFrom: todayStr(), dateTo: todayStr() }));
            dispatch(searchTrx({ dateFrom: todayStr(), dateTo: todayStr(), offset: 0 }));
        } else if (slice.rows.length === 0) {
            dispatch(searchTrx({}));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onChange = (key) => (e) => {
        dispatch(setTrxFilters({ [key]: e.target.value, offset: 0 }));
    };

    const run = () => dispatch(searchTrx({ offset: 0 }));

    const clearAll = () => {
        dispatch(resetTrxSearch());
        dispatch(setTrxFilters({ dateFrom: todayStr(), dateTo: todayStr() }));
        dispatch(searchTrx({ dateFrom: todayStr(), dateTo: todayStr(), offset: 0 }));
    };

    const exportCsv = () => {
        const headers = [
            'Serial', 'NanoId', 'Date', 'Time', 'Type', 'Status',
            'Items', 'Total', 'Tax', 'Cashback',
            'Customer', 'Mobile', 'Reference', 'Cashier',
        ];
        const dataRows = rows.map((r) => [
            r.serial, r.nanoId, r.businessDateAsString,
            r.createdAtAsString ? r.createdAtAsString.substring(11) : '',
            r.type, r.status,
            r.itemCount, r.total, r.totalTax, r.totalCashbackAmt,
            r.customerName || '', r.customerMobile || '', r.referenceNumber || '',
            r.cashier || '',
        ]);
        downloadCsv(`invoices-${todayStr()}.csv`, headers, dataRows);
    };

    const pagerNext = () => {
        const nextOffset = (filters.offset || 0) + (filters.limit || 50);
        if (nextOffset >= totalCount) return;
        dispatch(setTrxFilters({ offset: nextOffset }));
        dispatch(searchTrx({ offset: nextOffset }));
    };

    const pagerPrev = () => {
        const prev = Math.max(0, (filters.offset || 0) - (filters.limit || 50));
        dispatch(setTrxFilters({ offset: prev }));
        dispatch(searchTrx({ offset: prev }));
    };

    const showingFrom = rows.length === 0 ? 0 : (filters.offset || 0) + 1;
    const showingTo = (filters.offset || 0) + rows.length;

    return (
        <>
            <div className={classes.LookupCard}>
                <div className={classes.LookupCardHeader}>
                    <h3 className={classes.LookupCardTitle}>
                        <FontAwesomeIcon icon={faReceipt} />
                        Invoice Lookup
                    </h3>
                    <div className={classes.LookupCardActions}>
                        <button
                            className={classes.CsvBtn}
                            onClick={exportCsv}
                            disabled={rows.length === 0}
                            title="Export current results to CSV"
                        >
                            <FontAwesomeIcon icon={faFileCsv} />
                            Export CSV
                        </button>
                    </div>
                </div>

                <div className={classes.LookupCardBody}>
                    <div className={classes.FilterStrip}>
                        <div className={classes.FilterField}>
                            <span className={classes.FilterFieldLabel}>Serial</span>
                            <input className={classes.FilterFieldInput} placeholder="e.g. 45823"
                                   value={filters.serial || ''} onChange={onChange('serial')}
                                   onKeyDown={(e) => e.key === 'Enter' && run()} />
                        </div>
                        <div className={classes.FilterField}>
                            <span className={classes.FilterFieldLabel}>Nano ID</span>
                            <input className={classes.FilterFieldInput} placeholder="21-char id"
                                   value={filters.nanoId || ''} onChange={onChange('nanoId')}
                                   onKeyDown={(e) => e.key === 'Enter' && run()} />
                        </div>
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
                                    <option key={u.key} value={u.key}>
                                        {u.employeeNumber || u.username}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className={classes.FilterField}>
                            <span className={classes.FilterFieldLabel}>Type</span>
                            <div className={classes.FilterChipGroup}>
                                {TYPE_OPTIONS.map((t) => (
                                    <button
                                        key={t}
                                        className={`${classes.FilterChip} ${filters.type === t ? classes.FilterChipActive : ''}`}
                                        onClick={() => dispatch(setTrxFilters({ type: t, offset: 0 }))}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className={classes.FilterField}>
                            <span className={classes.FilterFieldLabel}>Status</span>
                            <div className={classes.FilterChipGroup}>
                                {STATUS_OPTIONS.map((s) => (
                                    <button
                                        key={s}
                                        className={`${classes.FilterChip} ${filters.status === s ? classes.FilterChipActive : ''}`}
                                        onClick={() => dispatch(setTrxFilters({ status: s, offset: 0 }))}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className={classes.FilterStripActions}>
                        <button
                            className={`${classes.PillBtn} ${classes.PillBtnGhost} ${classes.PillBtnSmall}`}
                            onClick={clearAll}
                        >
                            <span className={classes.PillBtnIcon}><FontAwesomeIcon icon={faRotateLeft} /></span>
                            Reset
                        </button>
                        <button
                            className={`${classes.PillBtn} ${classes.PillBtnDanger} ${classes.PillBtnSmall}`}
                            onClick={run}
                            disabled={loading}
                        >
                            <span className={classes.PillBtnIcon}><FontAwesomeIcon icon={faMagnifyingGlass} /></span>
                            {loading ? 'Searching…' : 'Search'}
                        </button>
                    </div>

                    <div className={classes.DataTableWrap}>
                        <div className={classes.DataTableScroll}>
                            <table className={classes.DataTable}>
                                <thead>
                                    <tr>
                                        <th>Serial</th>
                                        <th>Date</th>
                                        <th>Type</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: 'right' }}>Items</th>
                                        <th style={{ textAlign: 'right' }}>Total</th>
                                        <th>Customer</th>
                                        <th>Cashier</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className={classes.DataTableEmpty}>
                                                <FontAwesomeIcon icon={faFilter} style={{ marginRight: 6 }} />
                                                No invoices match these filters.
                                            </td>
                                        </tr>
                                    )}
                                    {rows.map((r) => (
                                        <tr
                                            key={r.key}
                                            className={`${classes.DataTableRow} ${selectedTrxKey === r.key ? classes.DataTableRowSelected : ''}`}
                                            onClick={() => setSelectedTrxKey(r.key)}
                                        >
                                            <td><b>#{r.serial ?? '—'}</b><br /><small style={{ color: '#9CA3AF' }}>{r.nanoId}</small></td>
                                            <td>{r.businessDateAsString}<br /><small style={{ color: '#9CA3AF' }}>{r.createdAtAsString?.substring(11)}</small></td>
                                            <td>
                                                <span className={`${classes.TypeChip} ${r.type === 'Refund' ? classes.TypeChipRefund : classes.TypeChipSale}`}>
                                                    {r.type}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`${classes.TypeChip} ${r.status === 'VOIDED' ? classes.TypeChipVoid : classes.TypeChipSale}`}>
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>{r.itemCount ?? 0}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <span className={r.type === 'Refund' ? classes.AmountNegative : classes.AmountPositive}>
                                                    {fmtAmount(r.total)}
                                                </span>
                                            </td>
                                            <td>
                                                {r.customerName || '—'}
                                                {r.customerMobile && (
                                                    <><br /><small style={{ color: '#9CA3AF' }}>{r.customerMobile}</small></>
                                                )}
                                            </td>
                                            <td>{r.cashier || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className={classes.PagerBar}>
                            <span>
                                Showing {showingFrom}-{showingTo} of {totalCount}
                            </span>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={pagerPrev} disabled={!filters.offset}>Prev</button>
                                <button onClick={pagerNext} disabled={showingTo >= totalCount}>Next</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {selectedTrxKey && (
                <InvoiceDetailDrawer
                    trxKey={selectedTrxKey}
                    onClose={() => setSelectedTrxKey(null)}
                />
            )}
        </>
    );
};

export default InvoicesLookup;
