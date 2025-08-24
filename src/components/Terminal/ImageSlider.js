import React, { useEffect, useState } from 'react';
import config from '../../config';

const ImageSlider = () => {
    const [timestamp, setTimestamp] = useState(Date.now());
    const [slideImages, setSlideImages] = useState([]);

    // Auto-refresh every 15 minutes
    useEffect(() => {
        const interval = setInterval(() => {
            setTimestamp(Date.now());
        }, 15 * 60 * 1000); // 15 minutes in milliseconds

        return () => clearInterval(interval);
    }, []);

    // Construct URL with cache-busting query parameter
    const imageUrl = `https://image.shini.ps/pos-screen/${
        config.systemCurrency === 'NIS' ? 'pos.png' : 'pos_jod.png'
    }?v=${timestamp}`;

    return (
        <>
            <img 
                key={timestamp} // Using timestamp as key forces React to treat it as new component
                src={imageUrl}
                width='100%' 
                style={{ height: '450px' }} 
                alt='Error loading Ad image' 
            />
        </>
    );
};

export default ImageSlider;