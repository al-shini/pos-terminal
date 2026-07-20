import React from 'react';
import classes from './SelfServiceView.module.css';
import scanImg from '../../../assets/self-service/scan-item.png';
import payImg from '../../../assets/self-service/tap-pay.png';
import chooseImg from '../../../assets/self-service/choose-payment.png';
import receiptImg from '../../../assets/self-service/take-receipt.png';

const STEPS = [
    { num: 1, img: scanImg, text: 'Scan items' },
    { num: 2, img: payImg, text: 'Tap Pay' },
    { num: 3, img: chooseImg, text: 'Cash or Card' },
    { num: 4, img: receiptImg, text: 'Take receipt' },
];

/**
 * How-to guide for self-checkout.
 * @param {'footer'|'side'} variant - compact bottom bar on idle, vertical strip when shopping
 */
const SelfServiceGuide = ({ variant = 'side' }) => {
    if (variant === 'footer') {
        return (
            <footer className={classes.IdleStepsBar}>
                <div className={classes.IdleStepsInner}>
                    {STEPS.map((s, idx) => (
                        <React.Fragment key={s.num}>
                            <div className={classes.IdleStep}>
                                <span className={classes.IdleStepNum}>{s.num}</span>
                                <img src={s.img} alt="" className={classes.IdleStepImg} />
                                <span className={classes.IdleStepText}>{s.text}</span>
                            </div>
                            {idx < STEPS.length - 1 && (
                                <div className={classes.IdleStepDivider} aria-hidden />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </footer>
        );
    }

    return (
        <div className={classes.GuideStrip}>
            <h3 className={classes.GuideTitle}>How it works</h3>
            {STEPS.map((s) => (
                <div key={s.num} className={classes.GuideStep}>
                    <span className={classes.GuideStepNum}>{s.num}</span>
                    <img src={s.img} alt="" className={classes.GuideStepImg} />
                    <span className={classes.GuideStepText}>{s.text}</span>
                </div>
            ))}
        </div>
    );
};

export default SelfServiceGuide;
