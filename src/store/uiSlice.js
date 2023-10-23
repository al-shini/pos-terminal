import { createSlice, createAsyncThunk, createReducer } from '@reduxjs/toolkit'
 
const initialState = {
    loading: false,
    toastMsg: 'Smile to the customer ☺',
    toastType: 'info',
    toastOpen: false,
    loadingMessage: 'Loading, please wait'
}

/**
 * async actions
 */
export const notify = createAsyncThunk(
    'notify',
    async (payload, thunkAPI) => {
        thunkAPI.dispatch(uiSlice.actions.showToast(payload));

        window.setTimeout(() => {
            thunkAPI.dispatch(uiSlice.actions.hideToast());
        }, 6500);
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
            if (action.payload)
                state.loadingMessage = action.payload;

        },
        hideLoading: (state) => {
            state.loading = false;
            state.loadingMessage = 'Loading, please wait';
        },
        showToast: (state, action) => {
            state.toastMsg = action.payload.msg ? action.payload.msg : action.payload;
            state.toastType = action.payload.sev ? action.payload.sev : 'info';
            state.toastOpen = true;
        },
        hideToast: (state) => {
            state.toastOpen = false;
            state.toastMsg = 'Smile to the customer ☺';
            state.toastType = 'info';
        }
    }
})

export const { showLoading, hideLoading } = uiSlice.actions
export default uiSlice.reducer
