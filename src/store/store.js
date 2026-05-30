import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { PERSIST, PURGE, REHYDRATE } from 'redux-persist/es/constants';
import terminalReducer from './terminalSlice';
import trxReducer from './trxSlice';
import uiReducer from './uiSlice';
import backofficeReducer from './backofficeSlice';
import thunk from 'redux-thunk';

/**
 * Cross-window state replication.
 * ------------------------------------------------------------------
 * The POS runs two Electron BrowserWindows that must share the SAME
 * redux state: the cashier window (primary) and the customer-facing
 * display. The customer display is purely presentational — every
 * scanned line, total and payment it shows comes from the cashier
 * window's store.
 *
 * Historically this used `redux-state-sync` (BroadcastChannel /
 * broadcast-channel). That transport is UNRELIABLE in packaged
 * Electron builds: the renderer is served from a `file://` origin,
 * where Chromium can't use a real same-origin BroadcastChannel, so
 * broadcast-channel silently falls back to a localStorage/IndexedDB
 * path that is size- and quota-limited. The net effect on real POS
 * machines was that SMALL actions (e.g. payment totals) replicated
 * fine while LARGE actions — specifically the scan responses that
 * carry the full `trx` + `trxLines` array — were dropped. Result:
 * the customer screen showed payment totals but never the scanned
 * items, and only "after a set of transactions" (accumulation). It
 * always worked in `npm start` dev because that runs over
 * `http://localhost`, where native BroadcastChannel works.
 *
 * We replace that transport with Electron main-process IPC, which is
 * origin-independent and has no practical size/quota limit. Every
 * window relays its plain actions to the others via the main process,
 * and a freshly (re)loaded window hydrates its whole state from a
 * sibling that already has a live session (so a watchdog reload of the
 * customer display recovers instantly instead of waiting for the next
 * scan).
 */

let ipcRenderer = null;
try {
    if (typeof window !== 'undefined' && window.require) {
        ipcRenderer = window.require('electron').ipcRenderer;
        // Allow many windows/listeners without Node's default warning.
        if (ipcRenderer && typeof ipcRenderer.setMaxListeners === 'function') {
            ipcRenderer.setMaxListeners(50);
        }
    }
} catch (e) {
    // Not running inside Electron (e.g. plain browser dev / tests).
    ipcRenderer = null;
}

// Actions that must never be replicated across windows.
const SYNC_BLACKLIST = [PERSIST, PURGE, REHYDRATE, 'GLOBAL_HYDRATE'];

const isSyncableAction = (action) => (
    action
    && typeof action !== 'function'
    && typeof action.type === 'string'
    && SYNC_BLACKLIST.indexOf(action.type) < 0
);

// Relay every locally-originated, syncable action to the other window(s)
// through the Electron main process. Actions that arrived FROM another
// window carry `__fromSync` and are never re-broadcast (loop guard).
const ipcSyncMiddleware = () => (next) => (action) => {
    const result = next(action);
    if (ipcRenderer && isSyncableAction(action) && !action.__fromSync) {
        try {
            ipcRenderer.send('redux-action', action);
        } catch (e) {
            // A failed relay must never break the local dispatch.
        }
    }
    return result;
};

const appReducer = combineReducers({
    terminal: terminalReducer,
    trx: trxReducer,
    ui: uiReducer,
    backoffice: backofficeReducer
});

// Root reducer with a global hydrate hook used by the cross-window
// handshake: a blank (freshly loaded) window can adopt a sibling's
// entire state in one shot.
const rootReducer = (state, action) => {
    if (action.type === 'GLOBAL_HYDRATE' && action.payload) {
        return appReducer(action.payload, { type: '@@INIT_HYDRATE' });
    }
    return appReducer(state, action);
};

export const store = configureStore({
    reducer: rootReducer,
    // NOTE: explicit middleware array intentionally omits RTK's default
    // serializable/immutable dev checks (kept as it was historically) and
    // wires our IPC relay before thunk.
    middleware: [ipcSyncMiddleware, thunk]
});

// True once this window has a real, usable session. Used to decide
// whether we're allowed to (a) answer a sibling's hydrate request and
// (b) refuse being clobbered by a sibling's (possibly blank) state.
const hasLiveSession = () => {
    try {
        const s = store.getState();
        return Boolean(s && s.terminal && s.terminal.loggedInUser);
    } catch (e) {
        return false;
    }
};

if (ipcRenderer) {
    // Apply actions broadcast from the other window.
    ipcRenderer.on('redux-action', (event, action) => {
        if (isSyncableAction(action)) {
            store.dispatch({ ...action, __fromSync: true });
        }
    });

    // A sibling (re)loaded and asked for the current state. Only answer
    // if we actually have a live session — otherwise we'd hand back a
    // blank state and wipe an active window.
    ipcRenderer.on('redux-provide-state', () => {
        if (hasLiveSession()) {
            try {
                ipcRenderer.send('redux-state-snapshot', store.getState());
            } catch (e) {
                // ignore — the requester will fall back to live actions.
            }
        }
    });

    // We're a freshly loaded window receiving a sibling's full state.
    // Adopt it ONLY if we don't already have our own live session, so a
    // mid-shift reload of one window can never clobber the other.
    ipcRenderer.on('redux-hydrate', (event, snapshot) => {
        if (snapshot && !hasLiveSession()) {
            store.dispatch({ type: 'GLOBAL_HYDRATE', payload: snapshot, __fromSync: true });
        }
    });

    // On load, ask any sibling window for the current state so we can
    // catch up immediately instead of waiting for the next action.
    try {
        ipcRenderer.send('redux-request-state');
    } catch (e) {
        // ignore
    }
}
