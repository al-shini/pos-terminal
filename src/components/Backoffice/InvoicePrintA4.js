import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPrint, faXmark } from '@fortawesome/free-solid-svg-icons';

import classes from './Admin.module.css';
import axios from '../../axios';
import Logo from '../../assets/full-logo.png';

const fmt = (val) => {
    if (val === undefined || val === null || val === '') return '0.00';
    const n = Number(val);
    if (Number.isNaN(n)) return String(val);
    return n.toFixed(2);
};

// Normalize server field names — the enriched transaction payload mixes
// camelCase (e.g. `totalTaxAmt`) with the raw DB-style lowercase fields
// (e.g. `totalafterdiscount`, `totalcashbackamt`). We pick whichever the
// payload actually has so a missing key never crashes the render.
const pick = (obj, ...keys) => {
    for (const k of keys) {
        const v = obj && obj[k];
        if (v !== undefined && v !== null && v !== '') return v;
    }
    return 0;
};

const InvoicePrintA4 = ({ trxKey: trxKeyProp, onClose }) => {
    const params = useParams();
    const trxKey = trxKeyProp || params.trxKey;

    const [trx, setTrx] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!trxKey) return undefined;
        let mounted = true;
        setTrx(null);
        setError(null);
        axios.get('/bo/trxDetails', { params: { trxKey } })
            .then((r) => { if (mounted) setTrx(r.data); })
            .catch((e) => {
                if (mounted) setError(
                    (e.response && e.response.data) || e.message || 'Failed to load'
                );
            });
        return () => { mounted = false; };
    }, [trxKey]);

    const handleClose = () => {
        if (onClose) onClose();
        else window.close();
    };

    // Driving the print from the renderer via `window.print()` is unsafe in
    // Electron with `nodeIntegration: true`: cancelling the native dialog tears
    // the BrowserWindow down and the admin app quits. Route the request to the
    // main process via IPC so the renderer is never involved in the lifecycle.
    // We fall back to `window.print()` in plain browser (dev) runs.
    const handlePrint = () => {
        try {
            const req = typeof window !== 'undefined' && window.require ? window.require : null;
            if (req) {
                const { ipcRenderer } = req('electron');
                ipcRenderer.send('print-active-window');
                return;
            }
        } catch (_) { /* fall through to browser print */ }
        try { window.print(); } catch (_) { /* noop */ }
    };

    const isOverlay = Boolean(trxKeyProp);
    const rootClassName = isOverlay
        ? `${classes.PrintInvoiceOverlay} ${classes.PrintActive}`
        : classes.PrintActive;

    const body = (() => {
        if (error) {
            return (
                <div style={{ padding: 40, textAlign: 'center' }}>
                    <h3>Unable to load invoice</h3>
                    <p style={{ color: '#6B7280' }}>{String(error)}</p>
                </div>
            );
        }
        if (!trx) {
            return (
                <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>
                    Preparing invoice…
                </div>
            );
        }

        const isRefund = trx.type === 'Refund';
        const customer = {
            name: trx.loyalCustomerName || trx.customCustomerName || null,
            mobile: trx.customCustomerMobile || null,
            ref: trx.referenceNumber || null,
        };

        const grandTotal = Number(pick(trx, 'totalafterdiscount', 'totalAfterDiscount'));
        const discount = Number(pick(trx, 'totaldiscount', 'totalDiscount'));
        const subtotal = grandTotal + discount;
        const tax = Number(pick(trx, 'totalTaxAmt', 'totaltaxamt', 'total_tax_amt'));
        const cashback = Number(pick(trx, 'totalcashbackamt', 'totalCashbackAmt'));

        const lines = Array.isArray(trx.printableLines) ? trx.printableLines : [];
        const payments = Array.isArray(trx.paymentSummaryList) ? trx.paymentSummaryList : [];
        const taxRows = Array.isArray(trx.taxList) ? trx.taxList : [];

        return (
            <>
                <div className={classes.PrintScreenActions}>
                    <button
                        className={classes.PrintOnlyButton}
                        onClick={handleClose}
                        style={{ background: '#F1F5F9', color: '#374151' }}
                    >
                        <FontAwesomeIcon icon={faXmark} /> Close
                    </button>
                    <button className={classes.PrintOnlyButton} onClick={handlePrint}>
                        <FontAwesomeIcon icon={faPrint} /> Print
                    </button>
                </div>

                <div className={classes.PrintShell}>
                    <div className={classes.PrintHeader}>
                        <div className={classes.PrintBrand}>
                            <img src={Logo} alt="Shini" style={{ height: 44 }} />
                            <small>{trx.branch || 'Store'}</small>
                        </div>
                        <div className={classes.PrintMeta}>
                            <div><b>Invoice #</b><br />{trx.serialNumber || '—'}</div>
                            <div><b>Date</b><br />{trx.dateAsString || '—'}</div>
                            {trx.nanoId && <div><b>Nano Id</b><br />{trx.nanoId}</div>}
                        </div>
                    </div>

                    <div className={classes.PrintTitle}>
                        <h2>{isRefund ? 'Refund Receipt' : 'Tax Invoice'}</h2>
                        {isRefund && <span className={classes.PrintBadgeRefund}>Refund</span>}
                    </div>

                    {(customer.name || customer.mobile || customer.ref) && (
                        <div className={classes.PrintCustomer}>
                            {customer.name && (
                                <dl><dt>Customer</dt><dd>{customer.name}</dd></dl>
                            )}
                            {customer.mobile && (
                                <dl><dt>Mobile</dt><dd>{customer.mobile}</dd></dl>
                            )}
                            {customer.ref && (
                                <dl><dt>Reference</dt><dd>{customer.ref}</dd></dl>
                            )}
                            <dl><dt>Cashier</dt><dd>{trx.username || '—'}</dd></dl>
                        </div>
                    )}

                    <table className={classes.PrintLineTable}>
                        <thead>
                            <tr>
                                <th style={{ width: '55%' }}>Description</th>
                                <th className="num">Qty</th>
                                <th className="num">Total</th>
                                <th className="num">Final</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lines.length === 0 && (
                                <tr><td colSpan={4} style={{ color: '#9CA3AF', textAlign: 'center' }}>No items</td></tr>
                            )}
                            {lines.map((l, i) => (
                                <tr key={i}>
                                    <td>{l.description}</td>
                                    <td className="num">{fmt(l.quantity ?? l.qty)}</td>
                                    <td className="num">{fmt(l.totalPrice)}</td>
                                    <td className="num">{fmt(l.finalPrice)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className={classes.PrintTotals}>
                        <div className={classes.PrintTotalRow}>
                            <b>Subtotal</b>
                            <span>{fmt(subtotal)}</span>
                        </div>
                        {discount !== 0 && (
                            <div className={classes.PrintTotalRow}>
                                <b>Discount</b>
                                <span>-{fmt(discount)}</span>
                            </div>
                        )}
                        {tax !== 0 && (
                            <div className={classes.PrintTotalRow}>
                                <b>Tax Included</b>
                                <span>{fmt(tax)}</span>
                            </div>
                        )}
                        <div className={classes.PrintGrandTotal}>
                            <span>{isRefund ? 'Refund Total' : 'Grand Total'}</span>
                            <span>{fmt(grandTotal)}</span>
                        </div>
                        {cashback !== 0 && (
                            <div className={classes.PrintTotalRow} style={{ color: '#047857' }}>
                                <b>{isRefund ? 'Cashback Used' : 'Cashback Earned'}</b>
                                <span>{fmt(cashback)}</span>
                            </div>
                        )}
                    </div>

                    {payments.length > 0 && (
                        <div className={classes.PrintPayments}>
                            <h3>Payments</h3>
                            {payments.map((p, i) => (
                                <div key={i} className={classes.PrintPaymentRow}>
                                    <span>{p.paymentMethodName} ({p.currency})</span>
                                    <span>{fmt(p.amount)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {taxRows.length > 0 && (
                        <div className={classes.PrintPayments} style={{ marginTop: 8 }}>
                            <h3>Tax Breakdown</h3>
                            {taxRows.map((t, i) => (
                                <div key={i} className={classes.PrintPaymentRow}>
                                    <span>{t.taxSlice}</span>
                                    <span>{fmt(t.taxAmount)} on {fmt(t.taxSales)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className={classes.PrintFooter}>
                        Thank you for shopping with <b>Shini</b>.
                        <br />
                        <small>Keep this receipt for returns and warranty claims.</small>
                    </div>
                </div>
            </>
        );
    })();

    return <div className={rootClassName}>{body}</div>;
};

export default InvoicePrintA4;
