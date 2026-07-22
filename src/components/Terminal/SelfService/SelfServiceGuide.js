import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBarcode, faMoneyBillWave, faReceipt, faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import classes from './SelfServiceView.module.css';
import AR from './i18n';

const STEPS = [
    { num: 1, icon: faBarcode, text: AR.step1 },
    { num: 2, icon: faMoneyBillWave, text: AR.step2and3 },
    { num: 3, icon: faReceipt, text: AR.step4 },
];

/**
 * How-to guide for self-checkout, pure HTML/CSS (no bitmap assets).
 * The highlight cycles through the steps automatically (CSS animation
 * with staggered delays) to draw the customer's eye through the flow.
 *
 * @param {'footer'|'side'} variant - strip under the idle screen, card beside the cart
 */
const SelfServiceGuide = ({ variant = 'side' }) => {
    if (variant === 'footer') {
        return (
            <footer className={classes.IdleStepsBar}>
                <div className={classes.IdleJourney}>
                    {STEPS.map((s, idx) => (
                        <React.Fragment key={s.num}>
                            <div className={classes.JourneyStep}>
                                <span
                                    className={classes.JourneyIconWrap}
                                    style={{ animationDelay: `${idx * 3}s` }}
                                >
                                    <FontAwesomeIcon icon={s.icon} />
                                    <span className={classes.JourneyNum}>{s.num}</span>
                                </span>
                                <span className={classes.JourneyLabel}>{s.text}</span>
                            </div>
                            {idx < STEPS.length - 1 && (
                                <FontAwesomeIcon icon={faChevronLeft} className={classes.JourneyChevron} />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </footer>
        );
    }

    return (
        <div className={classes.GuideStrip}>
            <h3 className={classes.GuideTitle}>{AR.howItWorks}</h3>
            <div className={classes.GuideSteps}>
                {STEPS.map((s) => (
                    <div key={s.num} className={`${classes.JourneyStep} ${classes.JourneyStepRow}`}>
                        <span className={classes.JourneyIconWrap}>
                            <FontAwesomeIcon icon={s.icon} />
                            <span className={classes.JourneyNum}>{s.num}</span>
                        </span>
                        <span className={classes.JourneyLabel}>{s.text}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SelfServiceGuide;
