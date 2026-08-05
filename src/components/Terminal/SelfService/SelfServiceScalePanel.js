import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faAppleWhole, faArrowRight, faBoxOpen, faFire, faLeaf, faList,
    faSearch, faTimes, faTriangleExclamation, faWeightScale
} from '@fortawesome/free-solid-svg-icons';
import classes from './SelfServiceView.module.css';
import config from '../../../config';
import AR from './i18n';

const ARABIC_LETTERS = [
    'ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ر', 'ذ', 'ز', 'س', 'ش',
    'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي'
];

const matchCategory = (category, itemCategory) => {
    if (!itemCategory) return false;
    const c = itemCategory.toLowerCase();
    if (category === 'all') return /fruit/i.test(c) || /vegetable/i.test(c);
    if (category === 'fruit') return /fruit/i.test(c);
    if (category === 'vegetable') return /vegetable/i.test(c);
    return false;
};

const itemName = (item) =>
    item.descriptionAr || item.description || item.name || item.barcode || '';

/**
 * Full-screen fruit / vegetable / scale picker for self-checkout.
 * Browse by category, popular items, or Arabic first letter — then tap to weigh.
 */
const SelfServiceScalePanel = ({
    produceItems = [],
    otherScaleItems = [],
    topScaleBarcodes = [],
    images = {},
    scaleConnected,
    onPickItem,
    onClose,
}) => {
    const [category, setCategory] = useState('all');
    // 'popular' | 'all' | 'alpha'
    const [browseMode, setBrowseMode] = useState(
        topScaleBarcodes && topScaleBarcodes.length > 0 ? 'popular' : 'all'
    );
    const [letter, setLetter] = useState('ا');
    const [query, setQuery] = useState('');

    const hasPopular = topScaleBarcodes && topScaleBarcodes.length > 0;

    const items = useMemo(() => {
        let source;
        if (category === 'others') {
            source = otherScaleItems || [];
        } else {
            source = (produceItems || []).filter((item) =>
                matchCategory(category, item.category)
            );
        }

        // Deduplicate by barcode
        const seen = new Set();
        source = source.filter((item) => {
            const key = String(item.barcode || item.key || '');
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        const q = (query || '').trim();
        if (q) {
            const lower = q.toLowerCase();
            source = source.filter((item) => {
                const name = itemName(item).toLowerCase();
                const barcode = String(item.barcode || '').toLowerCase();
                return name.includes(lower) || barcode.includes(lower);
            });
        } else if (browseMode === 'popular' && hasPopular) {
            const barcodeSet = new Set(topScaleBarcodes.map(String));
            source = source.filter((item) => barcodeSet.has(String(item.barcode)));
        } else if (browseMode === 'alpha' && letter) {
            source = source.filter((item) =>
                itemName(item).trim().startsWith(letter)
            );
        }

        source.sort((a, b) =>
            itemName(a).localeCompare(itemName(b), 'ar')
        );
        return source;
    }, [
        produceItems, otherScaleItems, category, browseMode, letter,
        query, topScaleBarcodes, hasPopular
    ]);

    const resolveImg = (item) => {
        const barcode = item.barcode || '';
        return images[`${barcode}.png`]
            || images[`PLU_${barcode}.jpg`]
            || images['nophoto.jpg']
            || null;
    };

    const setMode = (mode) => {
        setBrowseMode(mode);
        setQuery('');
    };

    const emptyHint = () => {
        if (query.trim()) return AR.scaleNoSearchResults;
        if (browseMode === 'popular') return AR.scaleNoPopular;
        if (browseMode === 'alpha') return AR.scaleNoLetterResults;
        return AR.noItems;
    };

    return (
        <div className={classes.Overlay} dir="rtl">
            <div className={`${classes.OverlayFull} ${classes.ScaleModal}`}>
                <header className={classes.ScaleModalHeader}>
                    <div className={classes.ScaleModalHeaderText}>
                        <h2 className={classes.ScaleModalTitle}>
                            <FontAwesomeIcon icon={faWeightScale} />
                            {AR.fruitsVegTitle}
                        </h2>
                        <p className={classes.ScaleModalHint}>{AR.scaleWeighHint}</p>
                    </div>
                    <button
                        type="button"
                        className={classes.ScaleModalClose}
                        onClick={onClose}
                    >
                        <FontAwesomeIcon icon={faArrowRight} />
                        {AR.backToCart}
                    </button>
                </header>

                {!scaleConnected && (
                    <div className={classes.ScaleOffline}>
                        <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginLeft: 8 }} />
                        {AR.scaleOffline}
                    </div>
                )}

                <div className={classes.ScaleSearchRow}>
                    <FontAwesomeIcon icon={faSearch} className={classes.ScaleSearchIcon} />
                    <input
                        type="search"
                        className={classes.ScaleSearchInput}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={AR.scaleSearchPlaceholder}
                        autoComplete="off"
                        enterKeyHint="search"
                    />
                    {query ? (
                        <button
                            type="button"
                            className={classes.ScaleSearchClear}
                            onClick={() => setQuery('')}
                            aria-label={AR.close}
                        >
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    ) : null}
                </div>

                <div className={classes.ScaleCats}>
                    <button
                        type="button"
                        className={`${classes.ScaleCatBtn} ${category === 'all' ? classes.ScaleCatBtnActive : ''}`}
                        onClick={() => setCategory('all')}
                    >
                        <FontAwesomeIcon icon={faList} />
                        {AR.all}
                    </button>
                    <button
                        type="button"
                        className={`${classes.ScaleCatBtn} ${category === 'fruit' ? classes.ScaleCatBtnActive : ''}`}
                        onClick={() => setCategory('fruit')}
                    >
                        <FontAwesomeIcon icon={faAppleWhole} />
                        {AR.fruits}
                    </button>
                    <button
                        type="button"
                        className={`${classes.ScaleCatBtn} ${category === 'vegetable' ? classes.ScaleCatBtnActive : ''}`}
                        onClick={() => setCategory('vegetable')}
                    >
                        <FontAwesomeIcon icon={faLeaf} />
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

                {!query.trim() && (
                    <div className={classes.ScaleBrowseStrip}>
                        {hasPopular && (
                            <button
                                type="button"
                                className={`${classes.ScaleBrowseBtn} ${browseMode === 'popular' ? classes.ScaleBrowseBtnActive : ''}`}
                                onClick={() => setMode('popular')}
                            >
                                <FontAwesomeIcon icon={faFire} />
                                {AR.scalePopular}
                            </button>
                        )}
                        <button
                            type="button"
                            className={`${classes.ScaleBrowseBtn} ${browseMode === 'all' ? classes.ScaleBrowseBtnActive : ''}`}
                            onClick={() => setMode('all')}
                        >
                            {AR.scaleShowAll}
                        </button>
                        {ARABIC_LETTERS.map((c) => (
                            <button
                                key={c}
                                type="button"
                                className={`${classes.ScaleBrowseBtn} ${classes.ScaleLetterBtn} ${browseMode === 'alpha' && letter === c ? classes.ScaleBrowseBtnActive : ''}`}
                                onClick={() => {
                                    setLetter(c);
                                    setMode('alpha');
                                }}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                )}

                <div className={classes.ScaleModalMeta}>
                    {items.length > 0
                        ? AR.scaleItemCount(items.length)
                        : null}
                </div>

                <div className={classes.ScaleGrid}>
                    {items.map((item) => {
                        const src = resolveImg(item);
                        const name = itemName(item);
                        return (
                            <button
                                type="button"
                                key={item.barcode || item.key || name}
                                className={classes.ScaleCard}
                                disabled={!scaleConnected}
                                onClick={() => onPickItem && onPickItem(item)}
                            >
                                <div className={classes.ScaleCardImgWrap}>
                                    {src ? (
                                        <img
                                            src={src}
                                            alt=""
                                            className={classes.ScaleCardImg}
                                            onError={(e) => {
                                                if (images['nophoto.jpg']) e.target.src = images['nophoto.jpg'];
                                            }}
                                        />
                                    ) : (
                                        <FontAwesomeIcon icon={faLeaf} className={classes.ScaleCardFallback} />
                                    )}
                                </div>
                                <span className={classes.ScaleCardName}>{name}</span>
                            </button>
                        );
                    })}
                    {items.length === 0 && (
                        <div className={classes.ScaleEmpty}>
                            <FontAwesomeIcon icon={faBoxOpen} />
                            <span>{emptyHint()}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SelfServiceScalePanel;
