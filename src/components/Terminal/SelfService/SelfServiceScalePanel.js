import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAppleWhole, faLeaf, faList, faTimes, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import classes from './SelfServiceView.module.css';
import config from '../../../config';
import AR from './i18n';

/**
 * Simplified produce / scale picker for self-checkout.
 * Reuses produceItems + produce images already loaded by Terminal.js.
 */
const SelfServiceScalePanel = ({
    produceItems = [],
    otherScaleItems = [],
    images = {},
    scaleConnected,
    onPickItem,
    onClose,
}) => {
    const [category, setCategory] = useState('all');

    const items = useMemo(() => {
        if (category === 'others') {
            return otherScaleItems || [];
        }
        const list = produceItems || [];
        if (category === 'all') {
            return list.filter((item) => {
                const c = (item.category || '').toLowerCase();
                return /fruit/i.test(c) || /vegetable/i.test(c);
            });
        }
        if (category === 'fruit') {
            return list.filter((item) => /fruit/i.test((item.category || '').toLowerCase()));
        }
        if (category === 'vegetable') {
            return list.filter((item) => /vegetable/i.test((item.category || '').toLowerCase()));
        }
        return list;
    }, [produceItems, otherScaleItems, category]);

    const resolveImg = (item) => {
        const barcode = item.barcode || '';
        return images[`${barcode}.png`]
            || images[`PLU_${barcode}.jpg`]
            || images['nophoto.jpg']
            || null;
    };

    return (
        <div className={classes.Overlay} dir="rtl">
            <div className={`${classes.OverlayPanel} ${classes.ScalePanel}`}>
                <div className={classes.ScaleHeader}>
                    <h2 className={classes.OverlayTitle} style={{ fontSize: 26, margin: 0 }}>
                        {AR.fruitsVegTitle}
                    </h2>
                    <button type="button" className={classes.OverlayCancel} onClick={onClose} style={{ marginTop: 0 }}>
                        <FontAwesomeIcon icon={faTimes} />
                        {AR.close}
                    </button>
                </div>

                {!scaleConnected && (
                    <div className={classes.ScaleOffline}>
                        <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginLeft: 8 }} />
                        {AR.scaleOffline}
                    </div>
                )}

                <div className={classes.ScaleCats}>
                    <button
                        type="button"
                        className={`${classes.ScaleCatBtn} ${category === 'all' ? classes.ScaleCatBtnActive : ''}`}
                        onClick={() => setCategory('all')}
                    >
                        <FontAwesomeIcon icon={faList} style={{ marginLeft: 6 }} />
                        {AR.all}
                    </button>
                    <button
                        type="button"
                        className={`${classes.ScaleCatBtn} ${category === 'fruit' ? classes.ScaleCatBtnActive : ''}`}
                        onClick={() => setCategory('fruit')}
                    >
                        <FontAwesomeIcon icon={faAppleWhole} style={{ marginLeft: 6 }} />
                        {AR.fruits}
                    </button>
                    <button
                        type="button"
                        className={`${classes.ScaleCatBtn} ${category === 'vegetable' ? classes.ScaleCatBtnActive : ''}`}
                        onClick={() => setCategory('vegetable')}
                    >
                        <FontAwesomeIcon icon={faLeaf} style={{ marginLeft: 6 }} />
                        {AR.vegetables}
                    </button>
                    {config.features.otherScaleItems && (
                        <button
                            type="button"
                            className={`${classes.ScaleCatBtn} ${category === 'others' ? classes.ScaleCatBtnActive : ''}`}
                            onClick={() => setCategory('others')}
                        >
                            {AR.others}
                        </button>
                    )}
                </div>

                <div className={classes.ScaleGrid}>
                    {items.map((item) => {
                        const src = resolveImg(item);
                        return (
                            <button
                                type="button"
                                key={item.barcode || item.key || item.description}
                                className={classes.ScaleCard}
                                disabled={!scaleConnected}
                                onClick={() => onPickItem && onPickItem(item)}
                            >
                                {src && (
                                    <img
                                        src={src}
                                        alt=""
                                        className={classes.ScaleCardImg}
                                        onError={(e) => {
                                            if (images['nophoto.jpg']) e.target.src = images['nophoto.jpg'];
                                        }}
                                    />
                                )}
                                <span className={classes.ScaleCardName}>
                                    {item.description || item.name || item.barcode}
                                </span>
                            </button>
                        );
                    })}
                    {items.length === 0 && (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#9CA3AF', padding: 40 }}>
                            {AR.noItems}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SelfServiceScalePanel;
