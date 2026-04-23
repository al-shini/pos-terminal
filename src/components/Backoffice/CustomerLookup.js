import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faUserGroup, faMagnifyingGlass, faXmark, faMobile, faIdCard,
    faReceipt, faPiggyBank, faCashRegister, faFileCsv,
} from '@fortawesome/free-solid-svg-icons';

import classes from './Admin.module.css';
import {
    searchCustomers, setCustomerQuery, setCustomerSelected, clearCustomerSelected,
    fetchCustomerHistory, setCustomerHistoryDates,
} from '../../store/backofficeSlice';
import InvoiceDetailDrawer from './InvoiceDetailDrawer';
import { downloadCsv } from './csvExport';

const FIELDS = [
    { id: 'any', label: 'Any' },
    { id: 'mobile', label: 'Mobile' },
    { id: 'name', label: 'Name' },
    { id: 'sapId', label: 'SAP Id' },
    { id: 'key', label: 'Key' },
];

const fmt = (val) => {
    if (val === undefined || val === null || val === '') return '0.00';
    const n = Number(val);
    if (Number.isNaN(n)) return String(val);
    return n.toFixed(2);
};

const fmt4 = (val) => {
    if (val === undefined || val === null || val === '') return '0';
    const n = Number(val);
    if (Number.isNaN(n)) return String(val);
    return (Math.round(n * 10000) / 10000).toString();
};

const CustomerLookup = () => {
    const dispatch = useDispatch();
    const slice = useSelector((state) => state.backoffice?.customerSearch);
    const selected = useSelector((state) => state.backoffice?.customerSelected);

    const query = slice?.query || '';
    const field = slice?.field || 'any';
    const rows = slice?.rows || [];
    const loading = slice?.loading;

    const customer = selected?.customer;
    const history = selected?.history || [];
    const historyLoading = selected?.historyLoading;
    const historyFilters = selected?.historyFilters || {};

    const [selectedTrxKey, setSelectedTrxKey] = useState(null);

    useEffect(() => {
        if (rows.length === 0 && !loading && query) {
            dispatch(searchCustomers({ query, field }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const run = () => {
        dispatch(searchCustomers({ query, field }));
    };

    const pickCustomer = (c) => {
        dispatch(setCustomerSelected(c));
        dispatch(fetchCustomerHistory({
            customerKey: c.key,
            dateFrom: historyFilters.dateFrom,
            dateTo: historyFilters.dateTo,
        }));
    };

    const applyHistoryDates = (patch) => {
        const merged = { ...historyFilters, ...patch };
        dispatch(setCustomerHistoryDates(merged));
        if (customer) {
            dispatch(fetchCustomerHistory({
                customerKey: customer.key,
                dateFrom: merged.dateFrom,
                dateTo: merged.dateTo,
            }));
        }
    };

    const exportHistoryCsv = () => {
        if (!customer || history.length === 0) return;
        const headers = ['Serial', 'Date', 'Type', 'Status', 'Items', 'Total', 'Cashback Impact', 'Reference'];
        const dataRows = history.map((r) => {
            const impact = r.type === 'Refund'
                ? (-Number(r.totalCashbackAmt || 0))
                : (Number(r.totalCashbackAmt || 0));
            return [
                r.serial, r.businessDateAsString, r.type, r.status,
                r.itemCount, r.total, impact.toFixed(4), r.referenceNumber || '',
            ];
        });
        downloadCsv(`purchase-history-${customer.key}.csv`, headers, dataRows);
    };

    return (
        <>
            <div className={classes.LookupCard}>
                <div className={classes.LookupCardHeader}>
                    <h3 className={classes.LookupCardTitle}>
                        <FontAwesomeIcon icon={faUserGroup} />
                        Loyalty Customer Lookup
                    </h3>
                </div>

                <div className={classes.LookupCardBody}>
                    <div className={classes.FilterStrip}>
                        <div className={classes.FilterField} style={{ gridColumn: 'span 2' }}>
                            <span className={classes.FilterFieldLabel}>Query</span>
                            <input
                                className={classes.FilterFieldInput}
                                placeholder="Mobile, name, SAP id or key"
                                value={query}
                                onChange={(e) => dispatch(setCustomerQuery({ query: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && run()}
                                autoFocus
                            />
                        </div>
                        <div className={classes.FilterField}>
                            <span className={classes.FilterFieldLabel}>Search By</span>
                            <div className={classes.FilterChipGroup}>
                                {FIELDS.map((f) => (
                                    <button
                                        key={f.id}
                                        className={`${classes.FilterChip} ${field === f.id ? classes.FilterChipActive : ''}`}
                                        onClick={() => dispatch(setCustomerQuery({ field: f.id }))}
                                    >
                                        {f.label}
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
                            {loading ? 'Searching…' : 'Search'}
                        </button>
                    </div>

                    <div className={classes.DataTableWrap}>
                        <div className={classes.DataTableScroll} style={{ maxHeight: '30vh' }}>
                            <table className={classes.DataTable}>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Mobile</th>
                                        <th>SAP</th>
                                        <th style={{ textAlign: 'right' }}>Balance</th>
                                        <th style={{ textAlign: 'right' }}>Spent</th>
                                        <th style={{ textAlign: 'right' }}>Trx</th>
                                        <th>Last Trx</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className={classes.DataTableEmpty}>
                                                Search for a loyalty customer by mobile, name or SAP id.
                                            </td>
                                        </tr>
                                    )}
                                    {rows.map((c) => (
                                        <tr
                                            key={c.key}
                                            className={`${classes.DataTableRow} ${customer?.key === c.key ? classes.DataTableRowSelected : ''}`}
                                            onClick={() => pickCustomer(c)}
                                        >
                                            <td><b>{c.customerName || '—'}</b><br /><small style={{ color: '#9CA3AF' }}>{c.key}</small></td>
                                            <td>{c.mobileNumber || '—'}</td>
                                            <td>{c.sapId || '—'}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <span className={classes.AmountPositive}>{fmt4(c.cashbackBalance)}</span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <span className={classes.AmountNeutral}>{fmt(c.totalSpent)}</span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>{c.trxCount ?? 0}</td>
                                            <td>{c.lastTrxDateAsString || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {customer && (
                <div className={classes.LookupCard} style={{ marginTop: 18 }}>
                    <div className={classes.LookupCardHeader}>
                        <h3 className={classes.LookupCardTitle}>
                            <FontAwesomeIcon icon={faUserGroup} />
                            {customer.customerName}
                            <small style={{ color: '#6B7280', fontWeight: 500 }}>
                                {customer.mobileNumber ? ` · ${customer.mobileNumber}` : ''}
                            </small>
                        </h3>
                        <div className={classes.LookupCardActions}>
                            <button
                                className={classes.CsvBtn}
                                onClick={exportHistoryCsv}
                                disabled={history.length === 0}
                            >
                                <FontAwesomeIcon icon={faFileCsv} />
                                Export CSV
                            </button>
                            <button
                                className={`${classes.PillBtn} ${classes.PillBtnGhost} ${classes.PillBtnSmall}`}
                                onClick={() => dispatch(clearCustomerSelected())}
                            >
                                <span className={classes.PillBtnIcon}><FontAwesomeIcon icon={faXmark} /></span>
                                Close
                            </button>
                        </div>
                    </div>

                    <div className={classes.LookupCardBody}>
                        <div className={classes.KpiRow}>
                            <div className={classes.KpiCard}>
                                <div className={classes.KpiHeader}>
                                    <span className={`${classes.KpiHeaderIcon} ${classes.KpiHeaderIconBrand}`}>
                                        <FontAwesomeIcon icon={faCashRegister} />
                                    </span>
                                    <h4 className={classes.KpiTitle}>Spending</h4>
                                </div>
                                <div className={classes.KpiStats}>
                                    <div className={classes.KpiStat}>
                                        <span className={classes.KpiStatLabel}>Total Spent</span>
                                        <span className={classes.KpiStatValue}>{fmt(customer.totalSpent)}</span>
                                    </div>
                                    <div className={classes.KpiStat}>
                                        <span className={classes.KpiStatLabel}>Trx Count</span>
                                        <span className={classes.KpiStatValue}>{customer.trxCount ?? 0}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={classes.KpiCard}>
                                <div className={classes.KpiHeader}>
                                    <span className={`${classes.KpiHeaderIcon} ${classes.KpiHeaderIconGreen}`}>
                                        <FontAwesomeIcon icon={faPiggyBank} />
                                    </span>
                                    <h4 className={classes.KpiTitle}>Cashback</h4>
                                </div>
                                <div className={classes.KpiStats}>
                                    <div className={classes.KpiStat}>
                                        <span className={classes.KpiStatLabel}>Balance</span>
                                        <span className={classes.KpiStatValue}>{fmt4(customer.cashbackBalance)}</span>
                                    </div>
                                    <div className={classes.KpiStat}>
                                        <span className={classes.KpiStatLabel}>Earned</span>
                                        <span className={classes.KpiStatValue}>{fmt(customer.totalCashbackEarned)}</span>
                                    </div>
                                    <div className={classes.KpiStat}>
                                        <span className={classes.KpiStatLabel}>Used</span>
                                        <span className={classes.KpiStatValue}>{fmt(customer.totalCashbackUsed)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={classes.KpiCard}>
                                <div className={classes.KpiHeader}>
                                    <span className={`${classes.KpiHeaderIcon} ${classes.KpiHeaderIconAmber}`}>
                                        <FontAwesomeIcon icon={faIdCard} />
                                    </span>
                                    <h4 className={classes.KpiTitle}>Identity</h4>
                                </div>
                                <div className={classes.KpiStats}>
                                    <div className={classes.KpiStat}>
                                        <span className={classes.KpiStatLabel}><FontAwesomeIcon icon={faMobile} /> Mobile</span>
                                        <span className={classes.KpiStatValue} style={{ fontSize: 18 }}>{customer.mobileNumber || '—'}</span>
                                    </div>
                                    <div className={classes.KpiStat}>
                                        <span className={classes.KpiStatLabel}>SAP Id</span>
                                        <span className={classes.KpiStatValue} style={{ fontSize: 18 }}>{customer.sapId || '—'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={classes.SectionHeader} style={{ marginTop: 18 }}>
                            <h4 className={classes.SectionTitle}>
                                <span className={classes.SectionTitleIcon}>
                                    <FontAwesomeIcon icon={faReceipt} />
                                </span>
                                Purchase History
                            </h4>
                            <div className={classes.LookupCardActions}>
                                <div className={classes.FilterField}>
                                    <span className={classes.FilterFieldLabel}>From</span>
                                    <input type="date" className={classes.FilterFieldInput} style={{ width: 150 }}
                                           value={historyFilters.dateFrom || ''}
                                           onChange={(e) => applyHistoryDates({ dateFrom: e.target.value })} />
                                </div>
                                <div className={classes.FilterField}>
                                    <span className={classes.FilterFieldLabel}>To</span>
                                    <input type="date" className={classes.FilterFieldInput} style={{ width: 150 }}
                                           value={historyFilters.dateTo || ''}
                                           onChange={(e) => applyHistoryDates({ dateTo: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div className={classes.DataTableWrap}>
                            <div className={classes.DataTableScroll} style={{ maxHeight: '40vh' }}>
                                <table className={classes.DataTable}>
                                    <thead>
                                        <tr>
                                            <th>Serial</th>
                                            <th>Date</th>
                                            <th>Type</th>
                                            <th style={{ textAlign: 'right' }}>Items</th>
                                            <th style={{ textAlign: 'right' }}>Total</th>
                                            <th style={{ textAlign: 'right' }}>Cashback Impact</th>
                                            <th>Ref</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historyLoading && (
                                            <tr><td colSpan={7} className={classes.DataTableEmpty}>Loading…</td></tr>
                                        )}
                                        {!historyLoading && history.length === 0 && (
                                            <tr><td colSpan={7} className={classes.DataTableEmpty}>No transactions yet.</td></tr>
                                        )}
                                        {history.map((r) => {
                                            const cb = Number(r.totalCashbackAmt || 0);
                                            const impact = r.type === 'Refund' ? -cb : cb;
                                            const impactCls = impact > 0
                                                ? classes.AmountPositive
                                                : (impact < 0 ? classes.AmountNegative : classes.AmountNeutral);
                                            return (
                                                <tr key={r.key} className={classes.DataTableRow}
                                                    onClick={() => setSelectedTrxKey(r.key)}>
                                                    <td>#{r.serial}</td>
                                                    <td>{r.businessDateAsString}</td>
                                                    <td>
                                                        <span className={`${classes.TypeChip} ${r.type === 'Refund' ? classes.TypeChipRefund : classes.TypeChipSale}`}>
                                                            {r.type}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>{r.itemCount ?? 0}</td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <span className={r.type === 'Refund' ? classes.AmountNegative : classes.AmountPositive}>
                                                            {fmt(r.total)}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <span className={impactCls}>
                                                            {impact >= 0 ? '+' : ''}{impact.toFixed(4)}
                                                        </span>
                                                    </td>
                                                    <td>{r.referenceNumber || '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedTrxKey && (
                <InvoiceDetailDrawer
                    trxKey={selectedTrxKey}
                    onClose={() => setSelectedTrxKey(null)}
                />
            )}
        </>
    );
};

export default CustomerLookup;
