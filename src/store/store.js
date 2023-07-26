import { configureStore } from '@reduxjs/toolkit';
import { createStateSyncMiddleware, initMessageListener } from 'redux-state-sync';
import { PERSIST, PURGE, REHYDRATE } from 'redux-persist/es/constants';
import terminalReducer from './terminalSlice';
import trxReducer from './trxSlice';
import uiReducer from './uiSlice';
import thunk from 'redux-thunk';

export const store = configureStore({
    reducer: {
        terminal: terminalReducer,
        trx: trxReducer,
        ui: uiReducer,
    },
    middleware: [createStateSyncMiddleware({
        predicate: (action) => {
            const blacklist = [PERSIST, PURGE, REHYDRATE];
            if (typeof action !== "function") {
                if (Array.isArray(blacklist)) {
                    return blacklist.indexOf(action.type) < 0;
                }
            }
            return false;
        }
    }), thunk],
});
initMessageListener(store);