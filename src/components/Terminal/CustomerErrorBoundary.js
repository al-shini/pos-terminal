import React from 'react';

/**
 * Error boundary for the customer-facing display window.
 *
 * Why this exists:
 *   The customer display lives in a SECOND BrowserWindow that the cashier
 *   does not see and cannot easily inspect. Before this boundary, any
 *   uncaught render error in any sub-component (carousel, ticker, invoice
 *   list) would leave the whole window stuck on a blank screen until the
 *   cashier walked over and physically restarted the app — exactly the
 *   "freezes after a few scans" symptom the field has been reporting.
 *
 * Behaviour on error:
 *   1. Log the error so it shows up in the renderer console / electron log.
 *   2. Render a minimal branded fallback (NOT a stack trace — customers
 *      see this screen).
 *   3. Schedule a soft reload (window.location.reload) after a short delay
 *      so the display self-recovers without manual intervention. Reload
 *      rehydrates Redux from the cashier window via redux-state-sync.
 *   4. Cap auto-reloads to avoid a tight reload-loop on a deterministic
 *      bug — after a few attempts we just sit on the fallback.
 */
class CustomerErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, attempt: 0 };
        this._reloadTimer = null;
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        try {
            // eslint-disable-next-line no-console
            console.error('[CustomerDisplay] uncaught render error:', error, info);
        } catch (_) { /* swallow logging failures */ }

        // Read the previous attempt count from sessionStorage so it persists
        // across the reload itself. Cleared on full window close.
        let attempt = 0;
        try {
            attempt = parseInt(window.sessionStorage.getItem('cd_reload_attempt') || '0', 10) || 0;
        } catch (_) { /* ignore */ }

        if (attempt < 3) {
            try { window.sessionStorage.setItem('cd_reload_attempt', String(attempt + 1)); } catch (_) { /* ignore */ }
            this._reloadTimer = window.setTimeout(() => {
                try { window.location.reload(); } catch (_) { /* ignore */ }
            }, 4000);
        }

        this.setState({ attempt });
    }

    componentDidMount() {
        // First clean mount after a successful recovery — reset counter so
        // a future, unrelated error gets its own 3 retries.
        try {
            const flag = window.sessionStorage.getItem('cd_reload_attempt');
            if (flag && !this.state.hasError) {
                window.sessionStorage.removeItem('cd_reload_attempt');
            }
        } catch (_) { /* ignore */ }
    }

    componentWillUnmount() {
        if (this._reloadTimer) {
            window.clearTimeout(this._reloadTimer);
            this._reloadTimer = null;
        }
    }

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }
        return (
            <div
                style={{
                    position: 'fixed', inset: 0,
                    background: 'linear-gradient(135deg, #0e1420 0%, #1c2740 100%)',
                    color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', gap: 12,
                    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
                }}
            >
                <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: 1 }}>
                    Refreshing display…
                </div>
                <div style={{ fontSize: 16, opacity: 0.7 }}>
                    Thank you for shopping with us.
                </div>
            </div>
        );
    }
}

export default CustomerErrorBoundary;
