import React from 'react';
import classes from './SelfServiceView.module.css';

/**
 * Pure SVG/CSS animated barcode for the idle screen: EAN-style bars with a
 * red laser line sweeping up and down (no bitmap assets).
 *
 * PATTERN alternates bar / gap widths (in abstract units).
 */
const PATTERN = [3, 2, 1, 1, 2, 2, 4, 1, 1, 3, 2, 1, 1, 1, 3, 1, 2, 4, 1, 1,
    1, 2, 3, 1, 2, 1, 1, 2, 4, 1, 3, 1, 1, 2, 2, 1, 1, 4, 2, 3];

const UNIT = 4;
const HEIGHT = 100;

const buildBars = () => {
    const bars = [];
    let x = 0;
    PATTERN.forEach((w, i) => {
        const width = w * UNIT;
        if (i % 2 === 0) {
            // First and last bars are guard bars — slightly taller, like real EAN codes
            const guard = i === 0 || i === PATTERN.length - 2;
            bars.push(
                <rect
                    key={i}
                    x={x}
                    y={guard ? 4 : 10}
                    width={width}
                    height={guard ? HEIGHT - 8 : HEIGHT - 20}
                    rx={1.5}
                    fill="#111827"
                />
            );
        }
        x += width;
    });
    return { bars, total: x };
};

const AnimatedBarcode = () => {
    const { bars, total } = buildBars();
    return (
        <div className={classes.Barcode} aria-hidden="true">
            <svg
                className={classes.BarcodeSvg}
                viewBox={`0 0 ${total} ${HEIGHT}`}
                preserveAspectRatio="none"
            >
                {bars}
            </svg>
            <span className={classes.BarcodeLaser} />
        </div>
    );
};

export default AnimatedBarcode;
