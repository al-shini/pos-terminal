import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import BarcodeReader from 'react-barcode-reader';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faBasketShopping, faKeyboard } from '@fortawesome/free-solid-svg-icons';
import classes from './SelfServiceView.module.css';
import config from '../../../config';
import { scanBarcode, scanNewTransaction, selectLine } from '../../../store/trxSlice';
import { notify } from '../../../store/uiSlice';

const fmt = (n) => (((Number(n) || 0) * 100) / 100).toFixed(config.decimals);

/**
 * Large-font cart for self-checkout. Scanning is always active (same
 * barcode path as Invoice.js). Delete button voids a line with no manager QR.
 */
const SelfServiceCart = ({ onDeleteLine, onOpenKeypad }) => {
    const terminal = useSelector((state) => state.terminal);
    const trxSlice = useSelector((state) => state.trx);
    const dispatch = useDispatch();

    const items = (trxSlice.scannedItems || []).filter((i) => !i.voided);
    const allItems = trxSlice.scannedItems || [];

    const handleScan = (scannedValue) => {
        if (terminal.paymentMode) {
            dispatch(notify({
                msg: 'Finish or cancel payment before scanning more items',
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

    useEffect(() => {
        // keep list scrolled conceptually via re-render; no virtual list needed
        // for typical self-checkout basket sizes
    }, [allItems.length]);

    return (
        <div className={classes.CartShell}>
            <BarcodeReader onError={handleScanError} onScan={handleScan} />
            <div className={classes.CartHeader}>
                <h4 className={classes.CartHeaderTitle}>
                    <FontAwesomeIcon icon={faBasketShopping} />
                    Your items
                </h4>
                <span className={classes.CartHeaderCount}>{items.length}</span>
                {onOpenKeypad && (
                    <button
                        type="button"
                        className={classes.CartKeypadBtn}
                        onClick={onOpenKeypad}
                        title="Type barcode manually"
                    >
                        <FontAwesomeIcon icon={faKeyboard} />
                    </button>
                )}
            </div>

            {items.length === 0 ? (
                <div className={classes.CartEmpty}>
                    <FontAwesomeIcon icon={faBasketShopping} className={classes.CartEmptyIcon} />
                    <div style={{ fontSize: 20, fontWeight: 700 }}>Scan an item to start</div>
                    <div style={{ fontSize: 15 }}>Hold the barcode to the scanner</div>
                </div>
            ) : (
                <div className={classes.CartList}>
                    {[...allItems].reverse().map((obj) => {
                        if (obj.voided) return null;
                        const price = obj.finalprice != null ? obj.finalprice : obj.totalprice;
                        return (
                            <div key={obj.key} className={classes.CartRow}>
                                <span className={classes.CartQty}>×{obj.qty}</span>
                                <span className={classes.CartName}>{obj.description}</span>
                                <span className={classes.CartPrice}>
                                    {config.currencySymbol} {fmt(price)}
                                </span>
                                <button
                                    type="button"
                                    className={classes.CartDelete}
                                    title="Remove item"
                                    aria-label="Remove item"
                                    onClick={() => {
                                        dispatch(selectLine(obj));
                                        if (onDeleteLine) onDeleteLine(obj);
                                    }}
                                >
                                    <FontAwesomeIcon icon={faTrash} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SelfServiceCart;
