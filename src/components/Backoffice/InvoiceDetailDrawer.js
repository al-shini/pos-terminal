import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faReceipt, faXmark, faPrint, faUserTag, faUser, faCashRegister,
    faCalendarDay, faBarcode, faTag,
} from '@fortawesome/free-solid-svg-icons';

import classes from './Admin.module.css';
import { fetchTrxDetails, clearTrxSelected, setPrintInvoiceKey } from '../../store/backofficeSlice';

const fmt = (val) => {
    if (val === undefined || val === null || val === '') return '0.00';
    const n = Number(val);
    if (Number.isNaN(n)) return String(val);
    return n.toFixed(2);
};

const InvoiceDetailDrawer = ({ trxKey, onClose }) => {
    const dispatch = useDispatch();
    const selected = useSelector((state) => state.backoffice?.trxSelected);
    const trx = selected?.trx;
    const loading = selected?.loading;

    useEffect(() => {
        if (trxKey) {
            dispatch(fetchTrxDetails(trxKey));
        }
        return () => {
            dispatch(clearTrxSelected());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trxKey]);

    const isOpen = !!trxKey;

    const openPrintView = () => {
        if (!trx) return;
        // Render the A4 print view as an in-app overlay. Electron silently
        // blocks window.open() without a setWindowOpenHandler, which is what
        // used to crash the "Reprint A4" flow. Using redux state + @media
        // print CSS keeps the admin context and works in both dev + prod.
        dispatch(setPrintInvoiceKey(trx.key));
    };

    const totals = useMemo(() => {
        if (!trx) return {};
        return {
            subtotal: fmt(trx.totalBeforeDiscount || trx.totalBeforediscount || trx.totalafterdiscount),
            tax: fmt(trx.totaltaxamt || trx.totalTaxAmt),
            discount: fmt(trx.totaldiscountamt || trx.totalDiscountAmt),
            grand: fmt(trx.totalafterdiscount || trx.totalAfterDiscount),
            saved: fmt(trx.totalcashbackamt || trx.totalCashbackAmt),
        };
    }, [trx]);

    return (
        <>
            <div
                className={`${classes.DetailDrawerBackdrop} ${isOpen ? classes.DetailDrawerBackdropOpen : ''}`}
                onClick={onClose}
            />
            <aside className={`${classes.DetailDrawer} ${isOpen ? classes.DetailDrawerOpen : ''}`}>
                <div className={classes.DetailDrawerHeader}>
                    <h3 className={classes.DetailDrawerTitle}>
                        <FontAwesomeIcon icon={faReceipt} />
                        Invoice {trx?.serialNumber ? `#${trx.serialNumber}` : ''}
                    </h3>
                    <div className={classes.DetailDrawerActions}>
                        <button
                            className={`${classes.PillBtn} ${classes.PillBtnDanger} ${classes.PillBtnSmall}`}
                            onClick={openPrintView}
                            disabled={!trx}
                            title="Open A4 print view"
                        >
                            <span className={classes.PillBtnIcon}><FontAwesomeIcon icon={faPrint} /></span>
                            Reprint A4
                        </button>
                        <button
                            className={`${classes.PillBtn} ${classes.PillBtnGhost} ${classes.PillBtnSmall}`}
                            onClick={onClose}
                        >
                            <span className={classes.PillBtnIcon}><FontAwesomeIcon icon={faXmark} /></span>
                            Close
                        </button>
                    </div>
                </div>

                <div className={classes.DetailDrawerBody}>
                    {loading && (
                        <div style={{ color: '#6B7280', fontSize: 13 }}>Loading…</div>
                    )}

                    {!loading && trx && (
                        <>
                            <section className={classes.DetailSection}>
                                <div className={classes.DetailSectionHeader}>Transaction</div>
                                <div className={classes.DetailSectionBody}>
                                    <div className={classes.DetailGrid}>
                                        <div className={classes.DetailKv}>
                                            <span className={classes.DetailKvLabel}><FontAwesomeIcon icon={faBarcode} /> Serial</span>
                                            <span className={`${classes.DetailKvValue} ${classes.DetailKvValueMono}`}>
                                                #{trx.serialNumber}
                                            </span>
                                        </div>
                                        <div className={classes.DetailKv}>
                                            <span className={classes.DetailKvLabel}>Nano ID</span>
                                            <span className={classes.DetailKvValue}>{trx.nanoId || '—'}</span>
                                        </div>
                                        <div className={classes.DetailKv}>
                                            <span className={classes.DetailKvLabel}><FontAwesomeIcon icon={faCalendarDay} /> Date</span>
                                            <span className={classes.DetailKvValue}>{trx.dateAsString || trx.createdAtAsString}</span>
                                        </div>
                                        <div className={classes.DetailKv}>
                                            <span className={classes.DetailKvLabel}><FontAwesomeIcon icon={faTag} /> Type</span>
                                            <span className={classes.DetailKvValue}>{trx.type}</span>
                                        </div>
                                        <div className={classes.DetailKv}>
                                            <span className={classes.DetailKvLabel}>Status</span>
                                            <span className={classes.DetailKvValue}>{trx.status}</span>
                                        </div>
                                        <div className={classes.DetailKv}>
                                            <span className={classes.DetailKvLabel}><FontAwesomeIcon icon={faCashRegister} /> Cashier</span>
                                            <span className={classes.DetailKvValue}>{trx.username || '—'}</span>
                                        </div>
                                        {trx.referenceNumber && (
                                            <div className={classes.DetailKv}>
                                                <span className={classes.DetailKvLabel}>Reference</span>
                                                <span className={classes.DetailKvValue}>{trx.referenceNumber}</span>
                                            </div>
                                        )}
                                        {trx.branch && (
                                            <div className={classes.DetailKv}>
                                                <span className={classes.DetailKvLabel}>Branch</span>
                                                <span className={classes.DetailKvValue}>{trx.branch}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>

                            <section className={classes.DetailSection}>
                                <div className={classes.DetailSectionHeader}>Customer</div>
                                <div className={classes.DetailSectionBody}>
                                    <div className={classes.DetailGrid}>
                                        <div className={classes.DetailKv}>
                                            <span className={classes.DetailKvLabel}><FontAwesomeIcon icon={faUserTag} /> Loyalty</span>
                                            <span className={classes.DetailKvValue}>{trx.loyalCustomerName || '—'}</span>
                                        </div>
                                        <div className={classes.DetailKv}>
                                            <span className={classes.DetailKvLabel}><FontAwesomeIcon icon={faUser} /> Name</span>
                                            <span className={classes.DetailKvValue}>{trx.customCustomerName || '—'}</span>
                                        </div>
                                        <div className={classes.DetailKv}>
                                            <span className={classes.DetailKvLabel}>Mobile</span>
                                            <span className={classes.DetailKvValue}>{trx.customCustomerMobile || '—'}</span>
                                        </div>
                                        {trx.cashbackApplied && (
                                            <div className={classes.DetailKv}>
                                                <span className={classes.DetailKvLabel}>Cashback</span>
                                                <span className={`${classes.DetailKvValue} ${classes.AmountPositive}`}>
                                                    {fmt(trx.totalcashbackamt || trx.totalCashbackAmt)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {trx.printableLines && trx.printableLines.length > 0 && (
                                <section className={classes.DetailSection}>
                                    <div className={classes.DetailSectionHeader}>
                                        Lines ({trx.printableLines.length})
                                    </div>
                                    <div className={classes.DataTableScroll} style={{ maxHeight: '36vh' }}>
                                        <table className={classes.DataTable}>
                                            <thead>
                                                <tr>
                                                    <th>Description</th>
                                                    <th style={{ textAlign: 'right' }}>Qty</th>
                                                    <th style={{ textAlign: 'right' }}>Total</th>
                                                    <th style={{ textAlign: 'right' }}>Final</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {trx.printableLines.map((l, i) => (
                                                    <tr key={i}>
                                                        <td>{l.description}</td>
                                                        <td style={{ textAlign: 'right' }}>{fmt(l.qty)}</td>
                                                        <td style={{ textAlign: 'right' }}>{fmt(l.totalPrice)}</td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <span className={classes.AmountNeutral}>{fmt(l.finalPrice)}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            )}

                            <section className={classes.DetailSection}>
                                <div className={classes.DetailSectionHeader}>Totals</div>
                                <div className={classes.DetailSectionBody}>
                                    <div className={classes.DetailGrid}>
                                        <div className={classes.DetailKv}>
                                            <span className={classes.DetailKvLabel}>Tax</span>
                                            <span className={`${classes.DetailKvValue} ${classes.DetailKvValueMono}`}>{totals.tax}</span>
                                        </div>
                                        <div className={classes.DetailKv}>
                                            <span className={classes.DetailKvLabel}>Discount</span>
                                            <span className={`${classes.DetailKvValue} ${classes.DetailKvValueMono}`}>{totals.discount}</span>
                                        </div>
                                        <div className={classes.DetailKv}>
                                            <span className={classes.DetailKvLabel}>Grand Total</span>
                                            <span className={`${classes.DetailKvValue} ${classes.DetailKvValueMono} ${classes.AmountPositive}`}>
                                                {totals.grand}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {trx.paymentSummaryList && trx.paymentSummaryList.length > 0 && (
                                <section className={classes.DetailSection}>
                                    <div className={classes.DetailSectionHeader}>Payments</div>
                                    <div className={classes.DetailSectionBody}>
                                        {trx.paymentSummaryList.map((p, i) => (
                                            <div key={i} className={classes.PrintPaymentRow} style={{ fontSize: 13 }}>
                                                <span>{p.paymentMethodName} <small style={{ color: '#6B7280' }}>({p.currency})</small></span>
                                                <span className={classes.DetailKvValueMono}>{fmt(p.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </>
                    )}
                </div>
            </aside>
        </>
    );
};

export default InvoiceDetailDrawer;
