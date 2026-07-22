import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import BarcodeReader from 'react-barcode-reader';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faBasketShopping, faTag } from '@fortawesome/free-solid-svg-icons';
import classes from './SelfServiceView.module.css';
import config from '../../../config';
import { scanBarcode, scanNewTransaction, selectLine } from '../../../store/trxSlice';
import { notify } from '../../../store/uiSlice';
import AR from './i18n';

const fmt = (n) => (((Number(n) || 0) * 100) / 100).toFixed(config.decimals);

/**
 * Large-font cart for self-checkout. Scanning is always active (same
 * barcode path as Invoice.js). Delete button voids a line with no manager QR.
 */
const SelfServiceCart = ({ onDeleteLine }) => {
    const terminal = useSelector((state) => state.terminal);
    const trxSlice = useSelector((state) => state.trx);
    const dispatch = useDispatch();

    const items = (trxSlice.scannedItems || []).filter((i) => !i.voided);
    const allItems = trxSlice.scannedItems || [];

    const handleScan = (scannedValue) => {
        if (terminal.paymentMode) {
            dispatch(notify({
                msg: AR.finishOrCancelPayment,
                sev: 'warning'
            }));
            return;
        }
        if (trxSlice.trx && trxSlice.trx.key) {
            dispatch(scanBarcode({
                customerKey: terminal.customer ? terminal.customer.key : null,
                barcode: scannedValue,
                trxKey: trxSlice.trx.key,
                trxMode: terminal.trxMode || 'Sale',
                tillKey: terminal.till ? terminal.till.key : null,
                multiplier: trxSlice.multiplier ? trxSlice.multiplier : '1'
            }));
        } else {
            dispatch(scanNewTransaction({
                customerKey: terminal.customer ? terminal.customer.key : null,
                barcode: scannedValue,
                trxKey: null,
                trxMode: terminal.trxMode || 'Sale',
                tillKey: terminal.till ? terminal.till.key : null,
                multiplier: trxSlice.multiplier ? trxSlice.multiplier : '1'
            }));
        }
    };

    const handleScanError = (err) => {
        if (err && ('' + err).startsWith('C-')) {
            handleScan(err);
        }
    };

    const listRef = useRef(null);

    // Newest item is at the bottom (receipt order) — follow it as it lands.
    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [allItems.length]);

    return (
        <div className={classes.CartShell}>
            <BarcodeReader onError={handleScanError} onScan={handleScan} />
            {items.length === 0 ? (
                <div className={classes.CartEmpty}>
                    <FontAwesomeIcon icon={faBasketShopping} className={classes.CartEmptyIcon} />
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{AR.scanToStart}</div>
                    <div style={{ fontSize: 15 }}>{AR.holdBarcode}</div>
                </div>
            ) : (
                <div className={classes.CartList} ref={listRef}>
                    {allItems.map((obj) => {
                        if (obj.voided) return null;
                        const price = obj.finalprice != null ? obj.finalprice : obj.totalprice;
                        const hasDiscount = obj.finalprice != null && obj.finalprice < obj.totalprice;
                        const unitPrice = obj.qty ? obj.totalprice / obj.qty : obj.totalprice;
                        const saved = hasDiscount ? obj.totalprice - obj.finalprice : 0;
                        return (
                            <div
                                key={obj.key}
                                className={`${classes.CartRow} ${hasDiscount ? classes.CartRowPromo : ''}`}
                            >
                                <div className={classes.CartRowMain}>
                                    <span className={classes.CartName}>{obj.description}</span>
                                    <span
                                        className={`${classes.CartPrice} ${hasDiscount ? classes.CartPriceDiscount : ''}`}
                                        dir="ltr"
                                    >
                                        {config.currencySymbol} {fmt(price)}
                                    </span>
                                </div>
                                <div className={classes.CartRowSub}>
                                    <span className={classes.CartSubQty} dir="ltr">
                                        {obj.qty} × {fmt(unitPrice)}
                                    </span>
                                    {hasDiscount && (
                                        <span className={classes.CartPromoPill} dir="rtl">
                                            <FontAwesomeIcon icon={faTag} />
                                            {AR.youSaved}
                                            <span dir="ltr">{fmt(saved)}</span>
                                        </span>
                                    )}
                                    {hasDiscount && (
                                        <span className={classes.CartSubOld} dir="ltr">
                                            {config.currencySymbol} {fmt(obj.totalprice)}
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        className={classes.CartDelete}
                                        title={AR.removeItem}
                                        aria-label={AR.removeItem}
                                        onClick={() => {
                                            dispatch(selectLine(obj));
                                            if (onDeleteLine) onDeleteLine(obj);
                                        }}
                                    >
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SelfServiceCart;
