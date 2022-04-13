import { configureStore } from '@reduxjs/toolkit';

import authReducer from './authSlice';
import uiReducer from './uiSlice';

export default configureStore({
    reducer: {
        auth: authReducer,
        ui: uiReducer,
    }
});
