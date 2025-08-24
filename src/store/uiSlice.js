import { createSlice, createAsyncThunk, createReducer } from '@reduxjs/toolkit'
 

const initialState = {
    loading: false,
    toastMsg: '',
    toastType: 'info',
    toastOpen: false,
    loadingMessage: 'Loading, please wait',
    loadingTimeout: 90000, // defaults to 90 seconds
    loadingTimestamp: 0,
    itemScanError: false,
    itemScanErrorMessage: '',
    hardNotification: false,
    hardNotificationMessage: ''
}

/**
 * async actions
 */
export const notify = createAsyncThunk(
    'notify',
    async (payload, thunkAPI) => {
        thunkAPI.dispatch(uiSlice.actions.showToast(payload));
    }
)


/**
 * reducer
 */
export const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        showLoading: (state, action) => {
            state.loading = true;
            state.loadingTimestamp = new Date().getTime();
            if (action.payload && (action.payload.timeout || action.payload.msg)) {
                if (action.payload.timeout) {
                    state.loadingTimeout = action.payload.timeout;
                }
                if (action.payload.msg) {
                    state.loadingMessage = action.payload.msg;
                }
            } else if (action.payload) {
                state.loadingMessage = action.payload;
            }
        },
        hideLoading: (state) => {
            state.loading = false;
            state.loadingMessage = 'Loading, please wait';
            state.loadingTimeout = 90000;
        },
        showToast: (state, action) => {
            state.toastMsg = action.payload.msg ? action.payload.msg : action.payload;
            state.toastType = action.payload.sev ? action.payload.sev : 'info';
            state.toastOpen = true;
        },
        hideToast: (state) => {
            state.toastOpen = false; 
        },
        showItemScanError: (state, action) => {
            state.itemScanError = true; 
            state.itemScanErrorMessage = action.payload;
        },
        hideItemScanError: (state) => {
            state.itemScanError = false; 
            state.itemScanErrorMessage = '';
        },
        showHardNotification: (state, action) => {
            state.hardNotification = true; 
            state.hardNotificationMessage = action.payload;
        },
        hideHardNotification: (state) => {
            state.hardNotification = false; 
            state.hardNotificationMessage = '';
        }
    }
})

export const { showLoading, hideLoading, hideToast, showItemScanError, hideItemScanError, showHardNotification, hideHardNotification } = uiSlice.actions
export default uiSlice.reducer
