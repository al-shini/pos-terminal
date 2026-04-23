import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartColumn } from '@fortawesome/free-solid-svg-icons';

import classes from './Admin.module.css';
import { fetchHourlySales, setHourlySalesFilters } from '../../store/backofficeSlice';

const todayStr = () => new Date().toISOString().slice(0, 10);

const fmtAmount = (val) => {
    const num = Number(val || 0);
    if (Number.isNaN(num)) return '0';
    if (Math.abs(num) >= 1000) return Math.round(num).toLocaleString();
    return num.toFixed(2);
};

const HourlySalesChart = ({ defaultDateFrom, defaultDateTo }) => {
    const dispatch = useDispatch();
    const slice = useSelector((state) => state.backoffice?.hourlySales);
    const filters = slice?.filters || {};
    const buckets = slice?.buckets || [];
    const loading = slice?.loading;

    useEffect(() => {
        const from = defaultDateFrom || todayStr();
        const to = defaultDateTo || todayStr();
        dispatch(fetchHourlySales({ dateFrom: from, dateTo: to }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaultDateFrom, defaultDateTo]);

    const maxVal = useMemo(() => {
        let m = 0;
        for (const b of buckets) {
            const v = Number(b.total || 0);
            if (v > m) m = v;
        }
        return m || 1;
    }, [buckets]);

    const handleChange = (key) => (e) => {
        const next = { ...filters, [key]: e.target.value };
        dispatch(setHourlySalesFilters({ [key]: e.target.value }));
        dispatch(fetchHourlySales(next));
    };

    return (
        <div className={classes.LookupCard} style={{ marginTop: 18 }}>
            <div className={classes.LookupCardHeader}>
                <h4 className={classes.LookupCardTitle}>
                    <FontAwesomeIcon icon={faChartColumn} />
                    Hourly Sales
                </h4>
                <div className={classes.LookupCardActions}>
                    <div className={classes.FilterField}>
                        <span className={classes.FilterFieldLabel}>From</span>
                        <input
                            type="date"
                            className={classes.FilterFieldInput}
                            style={{ width: 150 }}
                            value={filters.dateFrom || ''}
                            onChange={handleChange('dateFrom')}
                        />
                    </div>
                    <div className={classes.FilterField}>
                        <span className={classes.FilterFieldLabel}>To</span>
                        <input
                            type="date"
                            className={classes.FilterFieldInput}
                            style={{ width: 150 }}
                            value={filters.dateTo || ''}
                            onChange={handleChange('dateTo')}
                        />
                    </div>
                </div>
            </div>
            <div className={classes.LookupCardBody}>
                <div className={classes.HourlyChart}>
                    {Array.from({ length: 24 }, (_, h) => {
                        const bucket = buckets.find((b) => Number(b.hour) === h) || { hour: h, total: 0, trxCount: 0 };
                        const pct = Math.max(0, Math.min(100, (Number(bucket.total || 0) / maxVal) * 100));
                        const isEmpty = Number(bucket.total || 0) === 0;
                        return (
                            <div key={h} className={classes.HourlyChartBarCell}>
                                <div className={classes.HourlyChartTip}>
                                    {String(h).padStart(2, '0')}:00 — {fmtAmount(bucket.total)}
                                    {bucket.trxCount ? ` (${bucket.trxCount} trx)` : ''}
                                </div>
                                <div
                                    className={`${classes.HourlyChartBar} ${isEmpty ? classes.HourlyChartBarEmpty : ''}`}
                                    style={{ height: `${pct}%` }}
                                />
                                <span className={classes.HourlyChartLabel}>{String(h).padStart(2, '0')}</span>
                            </div>
                        );
                    })}
                </div>
                {loading && (
                    <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 12, marginTop: 8 }}>
                        Loading…
                    </div>
                )}
            </div>
        </div>
    );
};

export default HourlySalesChart;
