import React from 'react';
import { useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTag } from '@fortawesome/free-solid-svg-icons';
import classes from './SelfServiceView.module.css';
import config from '../../../config';
import AR from './i18n';

const fmt = (n) => (((Number(n) || 0) * 100) / 100).toFixed(config.decimals);

/**
 * FastLane-style "last scanned item" spotlight card for the self-checkout
 * side column. Shows the most recent non-voided line with a clear discount
 * treatment.
 */
const SelfServiceLastScan = () => {
    const trxSlice = useSelector((state) => state.trx);

    const items = (trxSlice.scannedItems || []).filter((i) => !i.voided);
    if (items.length === 0) return null;

    const item = items[items.length - 1];
    const hasDiscount = item.finalprice < item.totalprice;
    const displayPrice = hasDiscount ? item.finalprice : item.totalprice;
    const saved = hasDiscount ? item.totalprice - item.finalprice : 0;

    return (
        <div className={`${classes.LastScanCard} ${hasDiscount ? classes.LastScanCardDiscount : ''}`}>
            <div className={classes.LastScanRibbon}>
                <span className={classes.LastScanDot} />
                {AR.lastScan}
            </div>

            <div className={classes.LastScanName}>{item.description}</div>

            <div className={classes.LastScanMeta}>
                <span className={classes.LastScanQty} dir="ltr">×{item.qty}</span>
                {hasDiscount && (
                    <span className={classes.LastScanSavePill} dir="rtl">
                        <FontAwesomeIcon icon={faTag} />
                        {AR.youSaved} {config.currencySymbol} {fmt(saved)}
                    </span>
                )}
            </div>

            <div className={classes.LastScanPriceRow}>
                {hasDiscount && (
                    <span className={classes.LastScanOldPrice} dir="ltr">
                        {config.currencySymbol} {fmt(item.totalprice)}
                    </span>
                )}
                <span className={classes.LastScanPrice} dir="ltr">
                    {config.currencySymbol} {fmt(displayPrice)}
                </span>
            </div>
        </div>
    );
};

export default SelfServiceLastScan;
