import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage } from '@fortawesome/free-solid-svg-icons';

import classes from './CustomerDisplay.module.css';
import Logo from '../../assets/full-logo.png';

const SLIDE_DURATION_MS = 7000;

// [STABILITY 2026-05-13] Stable-reference join key for the images array so
// `safeImages` only changes identity when the actual contents change. The
// previous implementation memoized on the `images` prop directly — but the
// parent re-derives that prop from a fresh API response on every refresh,
// so even when the URLs were unchanged we tore down and rebuilt the slide
// + progress intervals every cycle. Over an 8-hour shift that's hundreds
// of thousands of orphaned interval handles being GC'd, and is one of the
// strongest leak suspects behind the customer-display freezes.
const joinUrls = (arr) => (Array.isArray(arr) ? arr.filter(Boolean).join('\u0001') : '');

/**
 * Auto-playing customer-facing image carousel.
 *
 * - Receives the list of image URLs from the parent (already resolved from
 *   the `POS_CUSTOMER_IMAGES` system param).
 * - Cross-fades between slides every SLIDE_DURATION_MS.
 * - Falls back to a branded placeholder if the list is empty or every image
 *   fails to load.
 * - Displays a slim progress bar at the top (CSS-driven, no JS interval)
 *   and pagination dots at the bottom so the customer has a sense of pacing.
 */
const CustomerImageCarousel = ({ images }) => {
    // Memoize on a stable string key so we don't rebuild the slideshow when
    // the parent hands us a fresh-but-identical array reference.
    const imagesKey = useMemo(() => joinUrls(images), [images]);
    const safeImages = useMemo(
        () => (Array.isArray(images) ? images.filter(Boolean) : []),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [imagesKey]
    );

    const [activeIndex, setActiveIndex] = useState(0);
    const [failedUrls, setFailedUrls] = useState(() => new Set());

    const intervalRef = useRef(null);

    // Reset on actual image-set change to avoid pointing at a stale index.
    useEffect(() => {
        setActiveIndex(0);
        setFailedUrls(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imagesKey]);

    useEffect(() => {
        if (safeImages.length < 2) {
            return undefined;
        }

        intervalRef.current = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % safeImages.length);
        }, SLIDE_DURATION_MS);

        return () => {
            clearInterval(intervalRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imagesKey, safeImages.length]);

    // NOTE (2026-05-13): The previous implementation drove the progress
    // bar with a 100ms setInterval + setState — i.e. ~10 React renders /
    // second forever. On a long-running secondary display this kept GC
    // and React reconciliation hot enough to occasionally starve other
    // work and stall the window. The progress bar is now driven entirely
    // by a CSS transform animation tied to `activeIndex` (see
    // .CarouselProgressBar in CustomerDisplay.module.css), so it costs
    // zero JS work and zero state updates between slide changes.

    const handleImageError = (url) => {
        setFailedUrls((prev) => {
            const next = new Set(prev);
            next.add(url);
            return next;
        });
    };

    const visibleImages = safeImages.filter((url) => !failedUrls.has(url));
    const showFallback = visibleImages.length === 0;

    return (
        <div className={classes.Carousel}>
            {safeImages.length > 1 && (
                <div className={classes.CarouselProgress}>
                    {/*
                       The `key` forces React to remount the bar on every
                       slide change so the CSS animation restarts from 0.
                       `animationDuration` matches SLIDE_DURATION_MS.
                    */}
                    <div
                        key={`bar-${activeIndex}`}
                        className={classes.CarouselProgressBar}
                        style={{ animationDuration: `${SLIDE_DURATION_MS}ms` }}
                    />
                </div>
            )}

            {showFallback ? (
                <div className={classes.CarouselFallback}>
                    <img src={Logo} alt="Shini Extra" />
                    <div className={classes.CarouselFallbackText}>Welcome to Shini Extra</div>
                    <div className={classes.CarouselFallbackSub}>
                        <FontAwesomeIcon icon={faImage} style={{ marginRight: 6 }} />
                        No promotional content configured
                    </div>
                </div>
            ) : (
                <>
                    {safeImages.map((url, idx) => {
                        if (failedUrls.has(url)) return null;
                        const isActive = idx === activeIndex;
                        return (
                            <div
                                key={`${url}-${idx}`}
                                className={`${classes.CarouselSlide} ${isActive ? classes.CarouselSlideActive : ''}`}
                            >
                                <img
                                    className={classes.CarouselImage}
                                    src={url}
                                    alt={`Promotion ${idx + 1}`}
                                    onError={() => handleImageError(url)}
                                    draggable={false}
                                />
                            </div>
                        );
                    })}
                    <div className={classes.CarouselOverlay} />
                </>
            )}

            {safeImages.length > 1 && !showFallback && (
                <div className={classes.CarouselDots}>
                    {safeImages.map((url, idx) => (
                        <span
                            key={`dot-${idx}`}
                            className={`${classes.CarouselDot} ${idx === activeIndex ? classes.CarouselDotActive : ''}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default CustomerImageCarousel;
