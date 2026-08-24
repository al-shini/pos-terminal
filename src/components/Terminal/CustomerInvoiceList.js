import React, { useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faTag, faReceipt } from '@fortawesome/free-solid-svg-icons';

import classes from './CustomerDisplay.module.css';
import config from '../../config';

const CURRENCY = config.currencySymbol;
const DECIMALS = config.decimals;
const fmt = (n) => (((Number(n) || 0) * 100) / 100).toFixed(DECIMALS);

const deriveItemState = (item) => {
    const isVoided = Boolean(item && item.voided);
    const hasDiscount = !isVoided && item && item.finalprice < item.totalprice;
    const hasExtra = !isVoided && item && item.finalprice > item.totalprice;
    const hasAdjustment = hasDiscount || hasExtra;
    const displayPrice = hasAdjustment ? item.finalprice : item.totalprice;
    const delta = hasAdjustment ? Math.abs(item.totalprice - item.finalprice) : 0;
    return { isVoided, hasDiscount, hasExtra, hasAdjustment, displayPrice, delta };
};

/**
 * Customer-facing invoice line row. Stripped of cashier affordances
 * (selection highlight, click handlers, hover states) — purely informative.
 */
const LineRow = React.memo(function LineRow({ item }) {
    const { isVoided, hasDiscount, hasExtra, hasAdjustment, displayPrice, delta } = deriveItemState(item);

    const priceClass = isVoided
        ? ''
        : hasDiscount
            ? classes.LinePriceDiscounted
            : hasExtra
                ? classes.LinePriceExtra
                : '';

    return (
        <div className={`${classes.LineRow} ${isVoided ? classes.LineRowVoided : ''}`}>
            <span className={classes.LineQty}>
                <span className={classes.LineQtyMult}>×</span>
                {item.qty}
            </span>

            <div className={classes.LineCenter}>
                <span className={classes.LineName}>{item.description}</span>
                {(isVoided || hasDiscount || hasExtra) && (
                    <div className={classes.LineSubRow}>
                        {isVoided && (
                            <span className={`${classes.LinePill} ${classes.LinePillVoided}`}>
                                <FontAwesomeIcon icon={faBan} style={{ fontSize: 9 }} />
                                Voided
                            </span>
                        )}
                        {hasDiscount && (
                            <span className={`${classes.LinePill} ${classes.LinePillDiscount}`}>
                                <FontAwesomeIcon icon={faTag} style={{ fontSize: 9 }} />
                                −{CURRENCY} {fmt(delta)}
                            </span>
                        )}
                        {hasExtra && (
                            <span className={`${classes.LinePill} ${classes.LinePillExtra}`}>
                                <FontAwesomeIcon icon={faTag} style={{ fontSize: 9 }} />
                                +{CURRENCY} {fmt(delta)}
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div style={{ textAlign: 'right' }}>
                {hasAdjustment && !isVoided && (
                    <span className={classes.LinePriceOld}>
                        {CURRENCY} {fmt(item.totalprice)}
                    </span>
                )}
                <span className={`${classes.LinePrice} ${priceClass}`}>
                    {CURRENCY} {fmt(displayPrice)}
                </span>
            </div>
        </div>
    );
});

/**
 * The latest-scanned item gets a large, animated "hero" card pinned above
 * the scrollable list. We deliberately don't repeat it inside the list.
 *
 * The name owns the whole top row: product descriptions here are long enough
 * that sharing a line with the quantity chip and the price cropped most of
 * them, and the name is the one thing the customer is checking.
 */
const LatestScanCard = ({ item }) => {
    const { isVoided, hasDiscount, hasExtra, hasAdjustment, displayPrice, delta } = deriveItemState(item);

    const priceClass = isVoided
        ? classes.LatestScanPriceVoided
        : hasDiscount
            ? classes.LatestScanPriceDiscounted
            : hasExtra
                ? classes.LatestScanPriceExtra
                : '';

    const cardExtraClass = isVoided ? classes.LatestScanCardVoided : '';

    return (
        <div
            className={`${classes.LatestScanCard} ${cardExtraClass}`}
            key={item.key}
        >
            <div className={classes.LatestScanName}>{item.description}</div>

            <div className={classes.LatestScanBody}>
                <span className={classes.LatestScanQty}>
                    <span className={classes.LatestScanQtyMult}>×</span>
                    {item.qty}
                </span>
                <span className={classes.LatestScanPriceWrap}>
                    {hasAdjustment && !isVoided && (
                        <span className={classes.LatestScanPriceOld}>
                            {CURRENCY} {fmt(item.totalprice)}
                        </span>
                    )}
                    <span className={`${classes.LatestScanPrice} ${priceClass}`}>
                        {CURRENCY} {fmt(displayPrice)}
                    </span>
                </span>
            </div>

            {(isVoided || hasDiscount || hasExtra) && (
                <div className={classes.LatestScanPills}>
                    {isVoided && (
                        <span className={`${classes.LatestScanPill} ${classes.LatestScanPillVoided}`}>
                            <FontAwesomeIcon icon={faBan} />
                            Voided
                        </span>
                    )}
                    {hasDiscount && (
                        <span className={`${classes.LatestScanPill} ${classes.LatestScanPillDiscount}`}>
                            <FontAwesomeIcon icon={faTag} />
                            Discount
                            <span className={classes.LatestScanPillAmount}>
                                −{CURRENCY} {fmt(delta)}
                            </span>
                        </span>
                    )}
                    {hasExtra && (
                        <span className={`${classes.LatestScanPill} ${classes.LatestScanPillExtra}`}>
                            <FontAwesomeIcon icon={faTag} />
                            Extra
                            <span className={classes.LatestScanPillAmount}>
                                +{CURRENCY} {fmt(delta)}
                            </span>
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * Customer-facing invoice — renders the highlighted latest scan card plus
 * the remaining items in receipt order, oldest at the top, so each new scan
 * lands at the bottom of the list the way the self-service cart behaves.
 * Intentionally does NOT reuse the cashier's Invoice component (no barcode
 * reader, no selection, no click handlers, no virtualization overhead).
 */
const CustomerInvoiceList = () => {
    const scannedItems = useSelector((state) => state.trx.scannedItems);
    const listRef = useRef(null);

    const { latestItem, olderItems } = useMemo(() => {
        if (!scannedItems || scannedItems.length === 0) {
            return { latestItem: null, olderItems: [] };
        }
        const last = scannedItems[scannedItems.length - 1];
        // Everything except the latest, in receipt order.
        const rest = scannedItems.slice(0, -1);
        return { latestItem: last, olderItems: rest };
    }, [scannedItems]);

    // The newest line sits at the bottom, so stay pinned there as it grows.
    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [olderItems.length]);

    if (!latestItem) {
        return (
            <div className={classes.ListEmpty}>
                <div className={classes.ListEmptyIcon}>
                    <FontAwesomeIcon icon={faReceipt} />
                </div>
                <div className={classes.ListEmptyTitle}>Ready to scan</div>
                <div className={classes.ListEmptySub}>
                    Your items will appear here as they are scanned.
                </div>
            </div>
        );
    }

    return (
        <>
            <LatestScanCard item={latestItem} />
            <div className={classes.ListWrap} ref={listRef}>
                {olderItems.map((item) => (
                    <LineRow key={item.key} item={item} />
                ))}
            </div>
        </>
    );
};

export default CustomerInvoiceList;
