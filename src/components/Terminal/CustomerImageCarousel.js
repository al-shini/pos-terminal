import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage } from '@fortawesome/free-solid-svg-icons';

import classes from './CustomerDisplay.module.css';
import Logo from '../../assets/full-logo.png';

const SLIDE_DURATION_MS = 7000;
const PROGRESS_TICK_MS = 100;

/**
 * Auto-playing customer-facing image carousel.
 *
 * - Receives the list of image URLs from the parent (already resolved from
 *   the `POS_CUSTOMER_IMAGES` system param).
 * - Cross-fades between slides every SLIDE_DURATION_MS.
 * - Falls back to a branded placeholder if the list is empty or every image
 *   fails to load.
 * - Displays a slim progress bar at the top and pagination dots at the
 *   bottom so the customer has a sense of pacing.
 */
const CustomerImageCarousel = ({ images }) => {
    const safeImages = useMemo(
        () => (Array.isArray(images) ? images.filter(Boolean) : []),
        [images]
    );

    const [activeIndex, setActiveIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [failedUrls, setFailedUrls] = useState(() => new Set());

    const intervalRef = useRef(null);
    const progressRef = useRef(null);

    // Reset on images change to avoid pointing at a stale index.
    useEffect(() => {
        setActiveIndex(0);
        setProgress(0);
        setFailedUrls(new Set());
    }, [safeImages]);

    useEffect(() => {
        if (safeImages.length < 2) {
            return undefined;
        }

        intervalRef.current = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % safeImages.length);
            setProgress(0);
        }, SLIDE_DURATION_MS);

        return () => {
            clearInterval(intervalRef.current);
        };
    }, [safeImages]);

    useEffect(() => {
        if (safeImages.length < 2) {
            setProgress(0);
            return undefined;
        }

        progressRef.current = setInterval(() => {
            setProgress((prev) => {
                const next = prev + (PROGRESS_TICK_MS / SLIDE_DURATION_MS) * 100;
                return next >= 100 ? 100 : next;
            });
        }, PROGRESS_TICK_MS);

        return () => {
            clearInterval(progressRef.current);
        };
    }, [safeImages, activeIndex]);

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
                    <div
                        className={classes.CarouselProgressBar}
                        style={{ transform: `scaleX(${progress / 100})` }}
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
