import { configureStore } from '@reduxjs/toolkit';

import terminalReducer from './terminalSlice';
import trxReducer from './trxSlice';
import uiReducer from './uiSlice';

export default configureStore({
    reducer: {
        terminal: terminalReducer,
        trx: trxReducer,
        ui: uiReducer,
    }
});
