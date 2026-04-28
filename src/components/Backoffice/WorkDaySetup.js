import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from '../../axios';
import classes from './Admin.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalendarDay, faHourglassEnd, faCashRegister, faLockOpen, faLock,
    faSackDollar, faHandHoldingDollar, faBan, faPause, faReceipt, faTriangleExclamation,
    faBusinessTime
} from '@fortawesome/free-solid-svg-icons';
import { notify } from '../../store/uiSlice';
import { setWorkDay, endDay } from '../../store/backofficeSlice';
import confirm from '../../components/UI/ConfirmDlg';
import HourlySalesChart from './HourlySalesChart';
import config from '../../config';

const fmtAmount = (val) => {
    if (val === undefined || val === null || val === '') return '0.00';
    const num = Number(val);
    if (Number.isNaN(num)) return String(val);
    return num.toFixed(2);
};

const KpiStat = ({ icon, label, value, caption, variant }) => (
    <div className={classes.KpiStat}>
        <span className={classes.KpiStatLabel}>
            {icon && <FontAwesomeIcon icon={icon} />}
            {label}
        </span>
        <span className={`${classes.KpiStatValue} ${variant === 'small' ? classes.KpiStatValueSmall : ''}`}>
            {value}
        </span>
        {caption && <span className={classes.KpiStatCaption}>{caption}</span>}
    </div>
);

const WorkDaySetup = () => {
    const dispatch = useDispatch();
    const backofficeSlice = useSelector((state) => state.backoffice);
    const terminalSlice = useSelector((state) => state.terminal);

    const loadOpenWorkDay = () => {
        if (terminalSlice.store) {
            axios({
                method: 'post',
                url: '/bo/checkOpenWorkday',
                headers: { storeKey: terminalSlice.store.key }
            }).then((response) => {
                if (response && response.data) {
                    dispatch(setWorkDay(response.data));
                    window.setTimeout(loadOpenWorkDay, 60000);
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
        loadOpenWorkDay();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const workDay = backofficeSlice.workDay;
    const hasWorkDay = !!(workDay && workDay.businessDate);

    const handleCloseDay = () => {
        if (!hasWorkDay) return;
        confirm(
            'End Day?',
            'Are you sure you want to close day ' + workDay.description + '?',
            () => { dispatch(endDay()); },
            'danger'
        );
    };

    if (!hasWorkDay) {
        return (
            <div className={classes.EmptyState}>
                <span className={classes.EmptyStateIcon}>
                    <FontAwesomeIcon icon={faBusinessTime} />
                </span>
                <span className={classes.EmptyStateTitle}>No open work day</span>
                <span className={classes.EmptyStateText}>
                    Once a work day is opened for this store, the overview will appear here.
                </span>
            </div>
        );
    }

    const totalTills = Number(workDay.totalTills || 0);
    const closedTills = Number(workDay.closedTills || 0);
    const openTills = Number(workDay.openTills || 0);
    const closedRatio = totalTills > 0 ? Math.min(100, Math.round((closedTills / totalTills) * 100)) : 0;
    const endDisabled = openTills > 0;

    return (
        <>
            <div className={classes.SectionHeader}>
                <h3 className={classes.SectionTitle}>
                    <span className={classes.SectionTitleIcon}>
                        <FontAwesomeIcon icon={faCalendarDay} />
                    </span>
                    Day Overview
                </h3>
            </div>

            <div className={classes.OverviewGrid}>
                {/* ---- Hero: Work Day card ---- */}
                <div className={classes.HeroCard}>
                    <div className={classes.HeroTop}>
                        <div>
                            <div className={classes.HeroLabel}>Work Day</div>
                            <div className={classes.HeroDate}>{workDay.businessDateAsString}</div>
                            <div className={classes.HeroDescription}>{workDay.description}</div>
                        </div>
                        <span className={classes.HeroChip}>
                            <FontAwesomeIcon icon={faLockOpen} />
                            Open
                        </span>
                    </div>

                    <div className={classes.HeroCta}>
                        <button
                            type="button"
                            className={`${classes.PillBtn} ${classes.PillBtnDanger}`}
                            onClick={handleCloseDay}
                            disabled={endDisabled}
                            title={endDisabled ? 'Close all tills first' : 'End the current work day'}
                        >
                            <span className={classes.PillBtnIcon}>
                                <FontAwesomeIcon icon={faHourglassEnd} />
                            </span>
                            End Day
                        </button>
                        {endDisabled && (
                            <span className={classes.HeroCtaHint}>
                                <FontAwesomeIcon icon={faTriangleExclamation} />
                                Close all tills first
                            </span>
                        )}
                    </div>
                </div>

                {/* ---- KPI row ---- */}
                <div className={classes.KpiRow}>
                    <div className={classes.KpiCard}>
                        <div className={classes.KpiHeader}>
                            <span className={`${classes.KpiHeaderIcon} ${classes.KpiHeaderIconBrand}`}>
                                <FontAwesomeIcon icon={faCashRegister} />
                            </span>
                            <h4 className={classes.KpiTitle}>Tills</h4>
                        </div>
                        <div className={`${classes.KpiStats} ${classes.KpiStatsThree}`}>
                            <KpiStat icon={faCashRegister} label="Total" value={totalTills} variant="small" />
                            <KpiStat icon={faLockOpen}    label="Open"  value={openTills}   variant="small" />
                            <KpiStat icon={faLock}        label="Closed" value={closedTills} variant="small" />
                        </div>
                        <div className={classes.KpiProgress} title={`${closedRatio}% closed`}>
                            <div
                                className={classes.KpiProgressFill}
                                style={{ width: `${closedRatio}%` }}
                            />
                        </div>
                        <span className={classes.KpiStatCaption}>
                            {closedTills} of {totalTills} tills closed ({closedRatio}%)
                        </span>
                    </div>

                    <div className={classes.KpiCard}>
                        <div className={classes.KpiHeader}>
                            <span className={`${classes.KpiHeaderIcon} ${classes.KpiHeaderIconGreen}`}>
                                <FontAwesomeIcon icon={faSackDollar} />
                            </span>
                            <h4 className={classes.KpiTitle}>Sales &amp; Refunds</h4>
                        </div>
                        <div className={classes.KpiStats}>
                            <KpiStat
                                icon={faReceipt}
                                label="Sale Trx"
                                value={workDay.currentSaleTrxCount || 0}
                            />
                            <KpiStat
                                icon={faHandHoldingDollar}
                                label="Refund Trx"
                                value={workDay.currentRefundTrxCount || 0}
                            />
                            <KpiStat
                                icon={faHandHoldingDollar}
                                label="Refund Amount"
                                value={fmtAmount(workDay.currentRefundTrxValue)}
                                caption={config.currencySymbol}
                                variant="small"
                            />
                        </div>
                    </div>

                    <div className={classes.KpiCard}>
                        <div className={classes.KpiHeader}>
                            <span className={`${classes.KpiHeaderIcon} ${classes.KpiHeaderIconAmber}`}>
                                <FontAwesomeIcon icon={faTriangleExclamation} />
                            </span>
                            <h4 className={classes.KpiTitle}>Incidents</h4>
                        </div>
                        <div className={classes.KpiStats}>
                            <KpiStat
                                icon={faBan}
                                label="Voided"
                                value={workDay.currentVoidedCount || 0}
                                caption={`${config.currencySymbol} ${fmtAmount(workDay.currentVoidedValue)}`}
                            />
                            <KpiStat
                                icon={faPause}
                                label="Suspended"
                                value={workDay.currentSuspendedCount || 0}
                                caption={`${config.currencySymbol} ${fmtAmount(workDay.currentSuspendedValue)}`}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {config.features && config.features.adminHourlySales && (
                <HourlySalesChart
                    defaultDateFrom={workDay.businessDateAsString}
                    defaultDateTo={workDay.businessDateAsString}
                />
            )}
        </>
    );
};

export default WorkDaySetup;
