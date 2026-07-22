import React, { useEffect, useState } from 'react';
import classes from './SelfServiceView.module.css';
import adSelfCheckout from '../../../assets/self-service/ads/ad-shini-selfcheckout.png';

const ADS = [adSelfCheckout];
const INTERVAL_MS = 7000;

/**
 * Ad banner area for the self-checkout side column (fills the space Lidl
 * uses for picklist buttons). Cross-fades and shows dots only when more
 * than one banner is configured via the ADS array.
 */
const SelfServiceAdsCarousel = () => {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (ADS.length < 2) return undefined;
        const t = window.setInterval(
            () => setIndex((i) => (i + 1) % ADS.length),
            INTERVAL_MS
        );
        return () => window.clearInterval(t);
    }, []);

    return (
        <div className={classes.AdsCarousel}>
            {ADS.map((src, i) => (
                <img
                    key={src}
                    src={src}
                    alt=""
                    className={`${classes.AdSlide} ${i === index ? classes.AdSlideActive : ''}`}
                    draggable={false}
                />
            ))}
            {ADS.length > 1 && (
                <div className={classes.AdDots}>
                    {ADS.map((src, i) => (
                        <span
                            key={src}
                            className={`${classes.AdDot} ${i === index ? classes.AdDotActive : ''}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default SelfServiceAdsCarousel;
