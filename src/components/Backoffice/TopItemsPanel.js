import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faRankingStar, faMagnifyingGlass, faFileCsv,
} from '@fortawesome/free-solid-svg-icons';

import classes from './Admin.module.css';
import { fetchTopItems, setTopItemsFilters } from '../../store/backofficeSlice';
import { downloadCsv } from './csvExport';

const todayStr = () => new Date().toISOString().slice(0, 10);

const fmt = (val) => {
    if (val === undefined || val === null || val === '') return '0.00';
    const n = Number(val);
    if (Number.isNaN(n)) return String(val);
    return n.toFixed(2);
};

const SORTS = [
    { id: 'revenue', label: 'By Revenue' },
    { id: 'qty',     label: 'By Quantity' },
];

const TopItemsPanel = () => {
    const dispatch = useDispatch();
    const slice = useSelector((state) => state.backoffice?.topItems);
    const filters = slice?.filters || {};
    const rows = slice?.rows || [];
    const loading = slice?.loading;

    useEffect(() => {
        if (!filters.dateFrom && !filters.dateTo) {
            dispatch(setTopItemsFilters({ dateFrom: todayStr(), dateTo: todayStr() }));
            dispatch(fetchTopItems({ dateFrom: todayStr(), dateTo: todayStr() }));
        } else if (rows.length === 0 && !loading) {
            dispatch(fetchTopItems({}));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onChange = (key) => (e) => {
        dispatch(setTopItemsFilters({ [key]: e.target.value || null }));
    };

    const run = () => dispatch(fetchTopItems({ offset: 0 }));

    const exportCsv = () => {
        const headers = ['Rank', 'Item Code', 'Description', 'Qty', 'Revenue', 'Trx Count'];
        const dataRows = rows.map((r, i) => [
            i + 1, r.itemCode || '', r.description || '', r.qty, r.revenue, r.trxCount,
        ]);
        downloadCsv(`top-items-${todayStr()}.csv`, headers, dataRows);
    };

    return (
        <div className={classes.LookupCard}>
            <div className={classes.LookupCardHeader}>
                <h3 className={classes.LookupCardTitle}>
                    <FontAwesomeIcon icon={faRankingStar} />
                    Top-Selling Items
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
                        <span className={classes.FilterFieldLabel}>Sort By</span>
                        <div className={classes.FilterChipGroup}>
                            {SORTS.map((s) => (
                                <button
                                    key={s.id}
                                    className={`${classes.FilterChip} ${filters.sortBy === s.id ? classes.FilterChipActive : ''}`}
                                    onClick={() => dispatch(setTopItemsFilters({ sortBy: s.id }))}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className={classes.FilterField}>
                        <span className={classes.FilterFieldLabel}>Limit</span>
                        <select className={classes.FilterFieldInput}
                                value={filters.limit || 50}
                                onChange={(e) => dispatch(setTopItemsFilters({ limit: Number(e.target.value), offset: 0 }))}>
                            {[20, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                </div>

                <div className={classes.FilterStripActions}>
                    <button
                        className={`${classes.PillBtn} ${classes.PillBtnDanger} ${classes.PillBtnSmall}`}
                        onClick={run}
                        disabled={loading}
                    >
                        <span className={classes.PillBtnIcon}><FontAwesomeIcon icon={faMagnifyingGlass} /></span>
                        {loading ? 'Loading…' : 'Run Report'}
                    </button>
                </div>

                <div className={classes.DataTableWrap}>
                    <div className={classes.DataTableScroll}>
                        <table className={classes.DataTable}>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Code</th>
                                    <th>Description</th>
                                    <th style={{ textAlign: 'right' }}>Qty</th>
                                    <th style={{ textAlign: 'right' }}>Revenue</th>
                                    <th style={{ textAlign: 'right' }}>Trx</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 && (
                                    <tr><td colSpan={6} className={classes.DataTableEmpty}>No items in this range.</td></tr>
                                )}
                                {rows.map((r, i) => (
                                    <tr key={`${r.itemKey}-${i}`} className={classes.DataTableRow}>
                                        <td><b>{i + 1}</b></td>
                                        <td>{r.itemCode || '—'}</td>
                                        <td>{r.description || '—'}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span className={classes.AmountNeutral}>{fmt(r.qty)}</span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span className={classes.AmountPositive}>{fmt(r.revenue)}</span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>{r.trxCount ?? 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TopItemsPanel;
