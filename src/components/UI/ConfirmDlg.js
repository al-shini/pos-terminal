import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
import { Button } from 'rsuite';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation, faXmark, faCheck } from '@fortawesome/free-solid-svg-icons';

/**
 * Branded, touch-friendly confirm dialog.
 *
 * Signature (backwards compatible):
 *   confirm(title, message, handler)
 * Optional 4th arg allows fine-tuning variant: 'warning' | 'danger' | 'info' | 'success'
 * Optional 5th arg opts: { confirmText, cancelText, subtitle, dir } — used by
 * self-service mode for Arabic / RTL dialogs.
 */
/**
 * Shared opts for Arabic/RTL confirm dialogs used outside self-service
 * (which already builds its own via SelfService/i18n.js). Pass as the
 * 5th arg: confirm('عنوان', 'رسالة', handler, 'danger', AR_CONFIRM_OPTS()).
 */
export const AR_CONFIRM_OPTS = (subtitle) => ({
    confirmText: 'تأكيد',
    cancelText: 'إلغاء',
    subtitle: subtitle || 'يرجى التأكيد للمتابعة',
    dir: 'rtl',
});

const confirm = (title, message, handler, variant = 'warning', opts = {}) => {
    const {
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        subtitle = 'Please confirm to continue',
        dir = 'ltr',
    } = opts;
    confirmAlert({
        customUI: ({ onClose }) => {
            const accent =
                variant === 'danger' ? '#DC2626' :
                    variant === 'success' ? '#16A34A' :
                        variant === 'info' ? '#2563EB' :
                            '#E11E26'; // warning (brand red)

            const accentSoft =
                variant === 'danger' ? 'rgba(220, 38, 38, 0.12)' :
                    variant === 'success' ? 'rgba(22, 163, 74, 0.12)' :
                        variant === 'info' ? 'rgba(37, 99, 235, 0.12)' :
                            'rgba(225, 30, 38, 0.12)';

            const accentSoftBorder =
                variant === 'danger' ? 'rgba(220, 38, 38, 0.30)' :
                    variant === 'success' ? 'rgba(22, 163, 74, 0.30)' :
                        variant === 'info' ? 'rgba(37, 99, 235, 0.30)' :
                            'rgba(225, 30, 38, 0.30)';

            return (
                <div
                    dir={dir}
                    style={{
                        background: '#FFFFFF',
                        width: 440,
                        maxWidth: '92vw',
                        borderRadius: 18,
                        boxShadow:
                            '0 24px 48px rgba(17, 24, 39, 0.28), 0 8px 16px rgba(17, 24, 39, 0.12)',
                        overflow: 'hidden',
                        fontFamily: dir === 'rtl'
                            ? 'Janna, "Segoe UI", Tahoma, sans-serif'
                            : '"Inter", "Segoe UI", sans-serif',
                        border: '1px solid #E5E7EB'
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            background:
                                'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
                            color: 'white',
                            padding: '16px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            borderBottom: `4px solid ${accent}`
                        }}
                    >
                        <div
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 12,
                                background: accentSoft,
                                border: `1px solid ${accentSoftBorder}`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: accent,
                                fontSize: 18,
                                flexShrink: 0
                            }}
                        >
                            <FontAwesomeIcon icon={faTriangleExclamation} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                                style={{
                                    fontSize: 17,
                                    fontWeight: 700,
                                    letterSpacing: 0.2,
                                    lineHeight: 1.2,
                                    textTransform: 'uppercase'
                                }}
                            >
                                {title}
                            </div>
                            <div
                                style={{
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: 'rgba(255, 255, 255, 0.65)',
                                    marginTop: 2,
                                    letterSpacing: 0.4,
                                    textTransform: 'uppercase'
                                }}
                            >
                                {subtitle}
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div style={{ padding: '22px 22px 18px 22px' }}>
                        {message ? (
                            <div
                                style={{
                                    background: '#F8FAFC',
                                    border: '1px solid #E5E7EB',
                                    ...(dir === 'rtl'
                                        ? { borderRight: `3px solid ${accent}` }
                                        : { borderLeft: `3px solid ${accent}` }),
                                    borderRadius: 10,
                                    padding: '12px 14px',
                                    color: '#111827',
                                    fontSize: 15,
                                    fontWeight: 500,
                                    lineHeight: 1.5,
                                    wordBreak: 'break-word'
                                }}
                            >
                                {message}
                            </div>
                        ) : (
                            <div
                                style={{
                                    color: '#6B7280',
                                    fontSize: 14,
                                    fontWeight: 500,
                                    padding: '4px 0'
                                }}
                            >
                                {dir === 'rtl' ? 'قد لا يمكن التراجع عن هذا الإجراء.' : 'This action may not be reversible.'}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div
                        style={{
                            display: 'flex',
                            gap: 10,
                            padding: '0 22px 22px 22px'
                        }}
                    >
                        <Button
                            appearance="ghost"
                            onClick={onClose}
                            style={{
                                flex: 1,
                                height: 48,
                                borderRadius: 12,
                                fontWeight: 700,
                                fontSize: 14,
                                letterSpacing: 0.3,
                                textTransform: 'uppercase',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                border: '1px solid #E5E7EB',
                                color: '#6B7280',
                                background: '#FFFFFF'
                            }}
                        >
                            <FontAwesomeIcon icon={faXmark} />
                            {cancelText}
                        </Button>
                        <Button
                            appearance="primary"
                            onClick={() => {
                                handler();
                                onClose();
                            }}
                            style={{
                                flex: 1.6,
                                height: 48,
                                borderRadius: 12,
                                fontWeight: 800,
                                fontSize: 14,
                                letterSpacing: 0.4,
                                textTransform: 'uppercase',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                background: `linear-gradient(135deg, ${accent} 0%, #111827 180%)`,
                                border: 'none',
                                boxShadow: `0 10px 24px ${accentSoft}`,
                                color: '#FFFFFF'
                            }}
                        >
                            <FontAwesomeIcon icon={faCheck} />
                            {confirmText}
                        </Button>
                    </div>
                </div>
            );
        }
    });
};

export default confirm;
