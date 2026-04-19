import React, { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBullhorn } from '@fortawesome/free-solid-svg-icons';

import classes from './CustomerDisplay.module.css';

/**
 * Breaking-news style ticker that scrolls customer-facing messages across
 * the bottom of the second display.
 *
 * Messages come from the `POS_CUSTOMER_MESSAGES` system param, resolved by
 * the parent. We duplicate the list inside the track so the CSS translate
 * loop can reset at -50% and play seamlessly.
 */
const CustomerNewsTicker = ({ messages }) => {
    const safeMessages = useMemo(
        () => (Array.isArray(messages) ? messages.filter(Boolean) : []),
        [messages]
    );

    // A single pass of the messages can be much shorter than the ticker's
    // viewport (especially with just 1-3 short messages). For the CSS
    // `translateX(-50%)` seamless loop to work, EACH group must be wider
    // than the viewport. We repeat the messages enough times inside each
    // group so the group width comfortably exceeds typical screen widths.
    const repeatCount = useMemo(() => {
        const n = Math.max(1, safeMessages.length);
        return Math.max(6, Math.ceil(12 / n));
    }, [safeMessages]);

    const groupMessages = useMemo(() => {
        const out = [];
        for (let r = 0; r < repeatCount; r += 1) {
            for (let i = 0; i < safeMessages.length; i += 1) {
                out.push({ msg: safeMessages[i], rep: r, idx: i });
            }
        }
        return out;
    }, [safeMessages, repeatCount]);

    // Keep the perceived scroll speed constant: the animation duration
    // scales with the total amount of content per group. Roughly 6s per
    // rendered item feels like a natural breaking-news pace.
    const animationDuration = useMemo(() => {
        const itemsPerGroup = repeatCount * Math.max(1, safeMessages.length);
        return `${Math.max(30, Math.round(itemsPerGroup * 6))}s`;
    }, [repeatCount, safeMessages]);

    const handleReload = () => {
        // Hard reload the customer screen — re-fetches customer display
        // config (images + messages) from HO and rehydrates Redux from
        // the other window via redux-state-sync.
        window.location.reload();
    };

    return (
        <div className={classes.NewsTicker}>
            <div
                className={classes.NewsBadge}
                onClick={handleReload}
                role="button"
                title="Click to reload the customer screen"
                style={{ cursor: 'pointer', userSelect: 'none' }}
            >
                <span className={classes.NewsBadgeDot} />
                <FontAwesomeIcon icon={faBullhorn} />
                <span>Extra!</span>
            </div>

            {safeMessages.length === 0 ? (
                <div className={classes.NewsEmpty}>
                    Shini Extra — thank you for shopping with us
                </div>
            ) : (
                <div className={classes.NewsScroller}>
                    <div
                        className={classes.NewsTrack}
                        style={{ animationDuration }}
                    >
                        {/* Two identical groups side-by-side — the track
                            animates from 0 to -50%, which is exactly one
                            group width, so the loop is seamless and keeps
                            feeding content from the right behind Extra!.
                            Each group repeats the messages enough times to
                            guarantee its width exceeds the viewport, which
                            is the condition for a gap-free loop. */}
                        {[0, 1].map((groupIdx) => (
                            <div
                                className={classes.NewsGroup}
                                key={`group-${groupIdx}`}
                                aria-hidden={groupIdx === 1}
                            >
                                {groupMessages.map(({ msg, rep, idx }) => (
                                    <span
                                        className={classes.NewsItem}
                                        key={`${groupIdx}-${rep}-${idx}`}
                                    >
                                        <span className={classes.NewsSeparator} />
                                        {msg}
                                    </span>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerNewsTicker;
