import React from 'react';
import { Button } from 'rsuite';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGift, faTrophy } from '@fortawesome/free-solid-svg-icons';

/**
 * Compact campaign strip: milestone bar + next-voucher status.
 * Progress track is always LTR so fill grows from 0 → max (RTL parent
 * was reversing the fill and looking broken).
 */
export default function SpendCampaignWidget({ trx, currency, onRedeem, onCancelRedeem }) {
    const snap = trx && trx.campaignSnapshot;
    if (!snap || !snap.active) {
        return null;
    }

    const cum = Number(snap.cumulativeAmt || 0);
    const eligible = Number(snap.eligibleDiscount || 0);
    const nextDiscount = snap.nextDiscount != null ? Number(snap.nextDiscount) : null;
    const nextThreshold = snap.nextThreshold != null ? Number(snap.nextThreshold) : null;
    const gap = snap.gapToNext != null ? Number(snap.gapToNext) : null;
    const reserved = snap.reserved || ['RESERVED', 'APPLIED', 'ISSUED'].includes(trx.campaignRedemptionState);
    const reservedDisc = Number(snap.reservedDiscount || trx.campaignDiscountApplied || 0);
    const voucherRef = snap.voucherRef || '';

    const tiers = Array.isArray(snap.tiers) ? snap.tiers : [];
    const thresholds = tiers
        .map((t) => Number(t.thresholdAmt || 0))
        .filter((n) => n > 0)
        .sort((a, b) => a - b);
    const maxThreshold = thresholds.length ? thresholds[thresholds.length - 1] : 150;
    const progressPct = Math.min(100, Math.max(0, (cum / maxThreshold) * 100));

    const fmt = (n) => {
        const v = Number(n) || 0;
        return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
    };

    let statusNode = null;
    if (reserved) {
        statusNode = (
            <>
                <span style={{ fontWeight: 700, color: '#166534', fontSize: 12, whiteSpace: 'nowrap' }}>
                    <FontAwesomeIcon icon={faGift} style={{ marginLeft: 4 }} />
                    قسيمة {fmt(reservedDisc)} {currency}
                    {voucherRef ? (
                        <b dir="ltr" style={{ marginInlineStart: 6, fontFamily: '"DSDIGI", monospace', color: '#111827' }}>
                            #{voucherRef}
                        </b>
                    ) : null}
                </span>
                <Button size="xs" appearance="ghost" color="red" onClick={onCancelRedeem}
                    style={{ padding: '0 8px', height: 22, minHeight: 22 }}>
                    إلغاء
                </Button>
            </>
        );
    } else if (eligible > 0) {
        statusNode = (
            <>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#166534', whiteSpace: 'nowrap' }}>
                    جاهز: قسيمة {fmt(eligible)} {currency}
                </span>
                <Button size="xs" appearance="primary" color="green" onClick={onRedeem}
                    style={{ fontWeight: 700, padding: '0 10px', height: 22, minHeight: 22 }}>
                    استبدال
                </Button>
            </>
        );
    } else if (gap != null && nextThreshold != null) {
        statusNode = (
            <span style={{ fontSize: 12, color: '#78350f', fontWeight: 700, whiteSpace: 'nowrap' }} dir="rtl">
                تبقّى <b dir="ltr">{fmt(gap)}</b> {currency} لقسيمة <b dir="ltr">{fmt(nextDiscount)}</b>
            </span>
        );
    } else {
        statusNode = (
            <span style={{ fontSize: 11, color: '#78716c', whiteSpace: 'nowrap' }}>
                ابدأ التسوق لتجميع المكافآت
            </span>
        );
    }

    return (
        <div
            dir="rtl"
            style={{
                marginTop: 4,
                background: reserved
                    ? 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)'
                    : 'linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)',
                border: reserved
                    ? '1px solid rgba(22, 163, 74, 0.35)'
                    : '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: 8,
                padding: '5px 8px 4px',
                fontFamily: 'Janna, "Segoe UI", Tahoma, sans-serif',
            }}
        >
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 4,
            }}>
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontWeight: 700,
                    fontSize: 11,
                    color: '#92400e',
                    whiteSpace: 'nowrap',
                }}>
                    <FontAwesomeIcon icon={faTrophy} />
                    حملة المشتريات
                    <b dir="ltr" style={{
                        marginInlineStart: 6,
                        fontFamily: '"DSDIGI", monospace',
                        fontSize: 12,
                        color: '#111827',
                        background: 'rgba(255,255,255,0.7)',
                        borderRadius: 4,
                        padding: '0 5px',
                    }}>
                        {fmt(cum)} {currency}
                    </b>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    {statusNode}
                </div>
            </div>

            {/* LTR track: fill must grow left → right regardless of parent RTL */}
            <div dir="ltr" style={{ position: 'relative', height: 18, margin: '1px 2px 0' }}>
                <div style={{
                    position: 'absolute',
                    insetInline: 0,
                    top: 5,
                    height: 8,
                    borderRadius: 999,
                    background: '#e7e5e4',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        width: `${progressPct}%`,
                        height: '100%',
                        marginInlineStart: 0,
                        marginInlineEnd: 'auto',
                        borderRadius: 999,
                        background: reserved
                            ? 'linear-gradient(90deg, #16a34a, #4ade80)'
                            : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                        transition: 'width 0.2s ease',
                    }} />
                </div>

                {thresholds.map((th) => {
                    const leftPct = Math.min(100, (th / maxThreshold) * 100);
                    const reached = cum >= th;
                    const tier = tiers.find((t) => Number(t.thresholdAmt) === th);
                    const disc = tier ? Number(tier.discountAmt || 0) : 0;
                    return (
                        <div
                            key={th}
                            title={`${fmt(th)} ${currency} → قسيمة ${fmt(disc)}`}
                            style={{
                                position: 'absolute',
                                left: `${leftPct}%`,
                                top: 3,
                                transform: 'translateX(-50%)',
                                pointerEvents: 'none',
                                zIndex: 1,
                            }}
                        >
                            <div style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                background: reached ? '#16a34a' : '#fff',
                                border: reached ? '2px solid #15803d' : '2px solid #a8a29e',
                                boxShadow: '0 0 0 1px rgba(255,255,255,0.8)',
                            }} />
                        </div>
                    );
                })}
            </div>

            <div dir="ltr" style={{
                position: 'relative',
                height: 12,
                marginTop: 1,
                fontSize: 9,
                fontWeight: 700,
                fontFamily: '"DSDIGI", monospace',
            }}>
                {thresholds.map((th) => {
                    const leftPct = Math.min(100, (th / maxThreshold) * 100);
                    const reached = cum >= th;
                    return (
                        <span
                            key={`lbl-${th}`}
                            style={{
                                position: 'absolute',
                                left: `${leftPct}%`,
                                transform: 'translateX(-50%)',
                                color: reached ? '#16a34a' : '#a8a29e',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {fmt(th)}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}
