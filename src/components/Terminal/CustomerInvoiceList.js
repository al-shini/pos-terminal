import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faTag, faReceipt } from '@fortawesome/free-solid-svg-icons';

import classes from './CustomerDisplay.module.css';
import config from '../../config';

const CURRENCY = config.systemCurrency === 'NIS' ? 'JD' : 'JD';
const DECIMALS = config.systemCurrency === 'NIS' ? 2 : 3;
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
const LineRow = ({ item }) => {
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
};

/**
 * The latest-scanned item gets a large, animated "hero" card pinned above
 * the scrollable list. We deliberately don't repeat it inside the list.
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
            <div className={classes.LatestScanLabel}>
                <span className={classes.LatestScanLabelDot} />
                Latest Scan
            </div>

            <div className={classes.LatestScanBody}>
                <span className={classes.LatestScanQty}>
                    <span className={classes.LatestScanQtyMult}>×</span>
                    {item.qty}
                </span>
                <span className={classes.LatestScanName}>{item.description}</span>
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
 * the remaining items in NEWEST-FIRST order. Intentionally does NOT reuse
 * the cashier's Invoice component (no barcode reader, no selection, no
 * click handlers, no virtualization overhead).
 */
const CustomerInvoiceList = () => {
    const scannedItems = useSelector((state) => state.trx.scannedItems);

    const { latestItem, olderItems } = useMemo(() => {
        if (!scannedItems || scannedItems.length === 0) {
            return { latestItem: null, olderItems: [] };
        }
        const last = scannedItems[scannedItems.length - 1];
        // Everything except the latest, newest-first.
        const rest = scannedItems.slice(0, -1).slice().reverse();
        return { latestItem: last, olderItems: rest };
    }, [scannedItems]);

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
            <div className={classes.ListWrap}>
                {olderItems.map((item) => (
                    <LineRow key={item.key} item={item} />
                ))}
            </div>
        </>
    );
};

export default CustomerInvoiceList;
