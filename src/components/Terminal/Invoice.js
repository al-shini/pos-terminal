import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FixedSizeList as List } from 'react-window';
import classes from './Terminal.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGift, faTag, faExclamationTriangle, faBan, faMobileScreenButton, faHashtag, faUser } from '@fortawesome/free-solid-svg-icons';
import BarcodeReader from 'react-barcode-reader';
import config from '../../config';

import { scanBarcode, scanNewTransaction, resetScrollAction, selectLine } from '../../store/trxSlice';

const InvoiceItem = React.memo(({ index, style, data }) => {
    const { items, handleItemClick, selectedLine, terminal } = data;
    const obj = items[index];
    const isEven = (number) => number % 2 === 0;
    const isSelected = obj.key === selectedLine.key;
    const isVoided = obj.voided;

    const currency = config.systemCurrency === 'NIS' ? 'JD' : 'JD';
    const decimals = config.systemCurrency === 'NIS' ? 2 : 3;
    const fmt = (n) => (((n) * 100) / 100).toFixed(decimals);

    const hasDiscount = obj.finalprice < obj.totalprice;
    const hasNegativeDiscount = obj.finalprice > obj.totalprice;
    const hasPriceChange = (obj.finalprice !== obj.totalprice) && obj.priceOverride;
    const hasCashback = obj.cashBackAmt > 0 && terminal.customer && terminal.customer.club;
    const hasAnyBadge = isVoided || hasDiscount || hasNegativeDiscount || hasPriceChange || hasCashback;

    const hasPriceAdjustment = hasDiscount || hasNegativeDiscount;
    const displayPrice = hasPriceAdjustment ? obj.finalprice : obj.totalprice;
    const priceDelta = hasPriceAdjustment ? Math.abs(obj.totalprice - obj.finalprice) : 0;

    const baseRowClass = isSelected
        ? classes.SelectedRowBG
        : (isEven(index + 1) ? classes.EvenRow : classes.OddRow);
    const rowClassName = isVoided
        ? `${baseRowClass} ${classes.VoidedRow}`
        : baseRowClass;

    return (
        <div
            onClick={() => handleItemClick(obj)}
            className={rowClassName}
            style={{
                ...style,
                padding: '10px 14px 12px 12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 8,
                boxSizing: 'border-box'
            }}
        >
            {/* Top line: qty chip | description | price */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span
                    className={`${classes.InvoiceQtyChip} ${isVoided ? classes.VoidedQtyChip : ''}`}
                    style={{ flexShrink: 0 }}
                >
                    <span className={classes.InvoiceQtyChipMult}>×</span>
                    {obj.qty}
                </span>

                <span
                    className={`${isSelected ? classes.SelectedRow : ''} ${isVoided ? classes.VoidedText : ''}`}
                    style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: isVoided ? undefined : '#111827',
                        fontSize: 16,
                        fontFamily: 'Janna',
                        textAlign: 'left'
                    }}>
                    {obj.description}
                </span>

                <span style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    lineHeight: 1,
                    flexShrink: 0
                }}>
                    {hasPriceAdjustment && !isVoided && (
                        <span style={{
                            fontSize: 13,
                            color: '#9CA3AF',
                            textDecoration: 'line-through',
                            fontFamily: 'DSDIGI, monospace',
                            marginBottom: 3,
                            letterSpacing: 0.3
                        }}>
                            {currency} {fmt(obj.totalprice)}
                        </span>
                    )}
                    <b
                        className={isVoided ? classes.VoidedPrice : ''}
                        style={{
                            fontSize: 20,
                            fontFamily: 'DSDIGI, monospace',
                            color: isVoided
                                ? undefined
                                : hasDiscount
                                    ? '#15803D'
                                    : hasNegativeDiscount
                                        ? '#E11E26'
                                        : '#111827',
                            letterSpacing: 0.3
                        }}>
                        {currency} {fmt(displayPrice)}
                    </b>
                </span>
            </div>

            {/* Badges line */}
            {hasAnyBadge && (
                <div style={{
                    display: 'flex',
                    gap: 6,
                    alignItems: 'center',
                    marginLeft: 0,
                    overflow: 'hidden',
                    flexWrap: 'nowrap'
                }}>
                    {isVoided && (
                        <span className={`${classes.InvoicePill} ${classes.InvoicePillVoided}`}>
                            <FontAwesomeIcon icon={faBan} />
                            Voided
                        </span>
                    )}
                    {!isVoided && hasDiscount && (
                        <span className={`${classes.InvoicePill} ${classes.InvoicePillDiscount}`}>
                            <FontAwesomeIcon icon={faTag} />
                            Discount
                            <span className={classes.InvoicePillAmount}>−{currency} {fmt(priceDelta)}</span>
                        </span>
                    )}
                    {!isVoided && hasNegativeDiscount && (
                        <span className={`${classes.InvoicePill} ${classes.InvoicePillExtra}`}>
                            <FontAwesomeIcon icon={faTag} />
                            Extra
                            <span className={classes.InvoicePillAmount}>+{currency} {fmt(priceDelta)}</span>
                        </span>
                    )}
                    {!isVoided && hasPriceChange && (
                        <span className={`${classes.InvoicePill} ${classes.InvoicePillPriceChange}`}>
                            <FontAwesomeIcon icon={faExclamationTriangle} />
                            Price Change
                        </span>
                    )}
                    {!isVoided && hasCashback && (
                        <span className={`${classes.InvoicePill} ${classes.InvoicePillCashback}`}>
                            <FontAwesomeIcon icon={faGift} />
                            Cashback
                            <span className={classes.InvoicePillAmount}>{currency} {fmt(obj.cashBackAmt)}</span>
                        </span>
                    )}
                </div>
            )}
        </div>
    );
});

const Invoice = (props) => {
    const terminal = useSelector((state) => state.terminal);
    const trxSlice = useSelector((state) => state.trx);
    const dispatch = useDispatch();
    const listRef = useRef();
    const listContainerRef = useRef(null);
    const [listHeight, setListHeight] = useState(400);

    useEffect(() => {
        const el = listContainerRef.current;
        if (!el) return;
        const measure = () => {
            setListHeight(Math.max(0, Math.floor(el.clientHeight)));
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        window.addEventListener('resize', measure);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, []);

    useEffect(() => {
        console.log(trxSlice.scrollAction);
        if (trxSlice.scrollAction === 'up' && listRef.current) {
            const currentScrollOffset = listRef.current.state.scrollOffset;
            listRef.current.scrollTo(currentScrollOffset - 100);
            dispatch(resetScrollAction());
        } else if (trxSlice.scrollAction === 'down' && listRef.current) {
            const currentScrollOffset = listRef.current.state.scrollOffset;
            listRef.current.scrollTo(currentScrollOffset + 100);
            dispatch(resetScrollAction());
        } else if (trxSlice.scrollAction === 'bottom' && listRef.current) {
            listRef.current.scrollToItem(trxSlice.scannedItems ? trxSlice.scannedItems.length - 1 : 0, 'end');
            dispatch(resetScrollAction());
        }
    }, [trxSlice.scrollAction]);

    const handleScan = (scannedValue) => {
        console.log(scannedValue);
        if (!terminal.paymentMode) {
            if (trxSlice.trx && trxSlice.trx.key) {
                dispatch(scanBarcode({
                    customerKey: terminal.customer ? terminal.customer.key : null,
                    barcode: scannedValue,
                    trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                    trxMode: terminal.trxMode,
                    tillKey: terminal.till ? terminal.till.key : null,
                    multiplier: trxSlice.multiplier ? trxSlice.multiplier : '1'
                }));
            } else {
                dispatch(scanNewTransaction({
                    customerKey: terminal.customer ? terminal.customer.key : null,
                    barcode: scannedValue,
                    trxKey: null,
                    trxMode: terminal.trxMode,
                    tillKey: terminal.till ? terminal.till.key : null,
                    multiplier: trxSlice.multiplier ? trxSlice.multiplier : '1'
                }));
            }
        }
    };

    useEffect(() => {
        // dispatch(scrollBottom())
        listRef.current.scrollToItem(trxSlice.scannedItems ? trxSlice.scannedItems.length - 1 : 0, 'end');
        dispatch(resetScrollAction());
    }, [trxSlice.scannedItems]);

    const handleScanError = (err) => {
        console.error(err)
        if (err && err.startsWith('C-')) {
            // custoemr barcode
            handleScan(err);
        }
    };

    const handleItemClick = (obj) => {
        dispatch(selectLine(obj));
    };

    const data = {
        items: trxSlice.scannedItems ? trxSlice.scannedItems : [],
        handleItemClick,
        selectedLine: trxSlice.selectedLine,
        terminal,
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0
        }}>
            {!terminal.paymentMode && <BarcodeReader onError={handleScanError} onScan={handleScan} />}
            <div style={{
                background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
                color: 'white',
                height: '5vh',
                flexShrink: 0,
                width: '110%',
                right: '10px',
                position: 'relative',
                borderLeft: terminal.trxMode === 'Refund' ? '4px solid #EF4444' : '4px solid #E11E26',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '16px',
                boxShadow: '0 2px 6px rgba(17, 24, 39, 0.12)'
            }}>
                <h4 id='trxModeHeader' style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: 700,
                    letterSpacing: '1.2px',
                    textTransform: 'uppercase',
                    fontFamily: '"Inter", "Segoe UI", sans-serif',
                    display: 'flex',
                    alignItems: 'stretch',
                    height: '100%',
                    gap: '0'
                }}>
                    {terminal.trxMode === 'Sale' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', paddingRight: '14px' }}>
                            <span style={{
                                display: 'inline-block',
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: '#22C55E',
                                boxShadow: '0 0 10px rgba(34, 197, 94, 0.6)'
                            }} />
                            {terminal.trxMode}
                        </span>
                    )}
                    {terminal.trxMode === 'Refund' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', paddingRight: '14px', color: '#FCA5A5' }}>
                            <span style={{
                                display: 'inline-block',
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: '#EF4444',
                                boxShadow: '0 0 10px rgba(239, 68, 68, 0.6)'
                            }} />
                            {terminal.trxMode}
                        </span>
                    )}
                    {trxSlice.trx && trxSlice.trx.customCustomerName && (
                        <span style={{
                            color: '#BBF7D0',
                            fontSize: '12px',
                            fontWeight: 600,
                            letterSpacing: '0.4px',
                            textTransform: 'none',
                            backgroundColor: 'rgba(34, 197, 94, 0.12)',
                            padding: '0 14px',
                            borderRadius: 0,
                            borderLeft: '1px solid rgba(34, 197, 94, 0.35)',
                            borderRight: '1px solid rgba(34, 197, 94, 0.35)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            alignSelf: 'stretch',
                            gap: '8px'
                        }}>
                            <FontAwesomeIcon icon={faUser} style={{ fontSize: '11px', opacity: 0.85 }} />
                            {trxSlice.trx.customCustomerName}
                        </span>
                    )}
                    {trxSlice.trx && trxSlice.trx.customCustomerMobile && (
                        <span style={{
                            color: '#BFDBFE',
                            fontSize: '12px',
                            fontWeight: 600,
                            letterSpacing: '0.4px',
                            textTransform: 'none',
                            backgroundColor: 'rgba(59, 130, 246, 0.14)',
                            padding: '0 14px',
                            borderRadius: 0,
                            borderLeft: '1px solid rgba(59, 130, 246, 0.38)',
                            borderRight: '1px solid rgba(59, 130, 246, 0.38)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            alignSelf: 'stretch',
                            gap: '8px',
                            fontFamily: '"DSDIGI", "Inter", monospace'
                        }}>
                            <FontAwesomeIcon icon={faMobileScreenButton} style={{ fontSize: '11px', opacity: 0.85, fontFamily: 'inherit' }} />
                            {trxSlice.trx.customCustomerMobile}
                        </span>
                    )}
                    {trxSlice.trx && trxSlice.trx.referenceNumber && (
                        <span style={{
                            color: '#FDE68A',
                            fontSize: '12px',
                            fontWeight: 600,
                            letterSpacing: '0.4px',
                            textTransform: 'none',
                            backgroundColor: 'rgba(245, 158, 11, 0.14)',
                            padding: '0 14px',
                            borderRadius: 0,
                            borderLeft: '1px solid rgba(245, 158, 11, 0.38)',
                            borderRight: '1px solid rgba(245, 158, 11, 0.38)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            alignSelf: 'stretch',
                            gap: '8px',
                            fontFamily: '"DSDIGI", "Inter", monospace'
                        }}>
                            <FontAwesomeIcon icon={faHashtag} style={{ fontSize: '11px', opacity: 0.85, fontFamily: 'inherit' }} />
                            {trxSlice.trx.referenceNumber}
                        </span>
                    )}
                </h4>
            </div>

            {trxSlice.scannedItems && trxSlice.scannedItems.length > 0 && (() => {
                const latestItem = trxSlice.scannedItems[trxSlice.scannedItems.length - 1];
                const isVoidedLatest = latestItem.voided;
                const hasDiscountLatest = latestItem.finalprice < latestItem.totalprice;
                const hasNegativeDiscountLatest = latestItem.finalprice > latestItem.totalprice;
                const hasPriceAdjustmentLatest = hasDiscountLatest || hasNegativeDiscountLatest;
                const displayPriceLatest = hasPriceAdjustmentLatest ? latestItem.finalprice : latestItem.totalprice;
                const priceDeltaLatest = hasPriceAdjustmentLatest ? Math.abs(latestItem.totalprice - latestItem.finalprice) : 0;

                const currencyLatest = config.systemCurrency === 'NIS' ? 'JD' : 'JD';
                const decimalsLatest = config.systemCurrency === 'NIS' ? 2 : 3;
                const fmtLatest = (n) => (((n) * 100) / 100).toFixed(decimalsLatest);

                const cardExtraClass = isVoidedLatest
                    ? classes.LatestScanCardVoided
                    : hasDiscountLatest
                        ? classes.LatestScanCardDiscount
                        : '';

                return (
                    <div
                        className={`${classes.LatestScanCard} ${cardExtraClass}`}
                        onClick={() => handleItemClick(latestItem)}
                    >
                        <div key={latestItem.key} className={classes.LatestScanInner}>
                            <span className={classes.LatestScanLabel}>
                                <span className={classes.LatestScanLabelDot} />
                                Latest Scan
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                <span className={classes.InvoiceQtyChip} style={{ flexShrink: 0 }}>
                                    <span className={classes.InvoiceQtyChipMult}>×</span>
                                    {latestItem.qty}
                                </span>
                                <span style={{
                                    flex: 1,
                                    minWidth: 0,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    color: isVoidedLatest ? '#94A3B8' : '#111827',
                                    fontStyle: isVoidedLatest ? 'italic' : 'normal',
                                    fontSize: 19,
                                    fontWeight: 600,
                                    fontFamily: 'Janna',
                                    textAlign: 'left'
                                }}>
                                    {latestItem.description}
                                </span>
                                <span style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-end',
                                    lineHeight: 1,
                                    flexShrink: 0
                                }}>
                                    {hasPriceAdjustmentLatest && !isVoidedLatest && (
                                        <span style={{
                                            fontSize: 15,
                                            color: '#9CA3AF',
                                            textDecoration: 'line-through',
                                            fontFamily: 'DSDIGI, monospace',
                                            marginBottom: 4,
                                            letterSpacing: 0.3
                                        }}>
                                            {currencyLatest} {fmtLatest(latestItem.totalprice)}
                                        </span>
                                    )}
                                    <b style={{
                                        fontSize: 28,
                                        fontFamily: 'DSDIGI, monospace',
                                        color: isVoidedLatest
                                            ? '#94A3B8'
                                            : hasDiscountLatest
                                                ? '#15803D'
                                                : hasNegativeDiscountLatest
                                                    ? '#E11E26'
                                                    : '#111827',
                                        textDecoration: isVoidedLatest ? 'line-through' : 'none',
                                        letterSpacing: 0.3
                                    }}>
                                        {currencyLatest} {fmtLatest(displayPriceLatest)}
                                    </b>
                                </span>
                            </div>
                            {(isVoidedLatest || hasDiscountLatest || hasNegativeDiscountLatest) && (
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    {isVoidedLatest && (
                                        <span className={`${classes.InvoicePill} ${classes.InvoicePillVoided}`}>
                                            <FontAwesomeIcon icon={faBan} />
                                            Voided
                                        </span>
                                    )}
                                    {!isVoidedLatest && hasDiscountLatest && (
                                        <span className={`${classes.InvoicePill} ${classes.InvoicePillDiscount}`}>
                                            <FontAwesomeIcon icon={faTag} />
                                            Discount
                                            <span className={classes.InvoicePillAmount}>−{currencyLatest} {fmtLatest(priceDeltaLatest)}</span>
                                        </span>
                                    )}
                                    {!isVoidedLatest && hasNegativeDiscountLatest && (
                                        <span className={`${classes.InvoicePill} ${classes.InvoicePillExtra}`}>
                                            <FontAwesomeIcon icon={faTag} />
                                            Extra
                                            <span className={classes.InvoicePillAmount}>+{currencyLatest} {fmtLatest(priceDeltaLatest)}</span>
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

            <div
                ref={listContainerRef}
                style={{
                    flex: 1,
                    minHeight: 0,
                    position: 'relative'
                }}
            >
                <List
                    height={listHeight}
                    itemCount={trxSlice.scannedItems ? trxSlice.scannedItems.length : 0}
                    itemSize={86}
                    width={'100%'}
                    itemData={data}
                    ref={listRef}
                    className="hide-scrollbar"
                >
                    {InvoiceItem}
                </List>
            </div>

        </div>
    );
}

export default Invoice;
