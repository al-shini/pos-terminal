import { createSlice, createAsyncThunk, createReducer } from '@reduxjs/toolkit'

const initialState = {
    loading: false,
    toastMsg: '',
    toastType: 'info',
    toastOpen: false
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
        }, 2000);
    }
)


/**
 * reducer
 */
export const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        showLoading: (state) => {
            state.loading = true;
        },
        hideLoading: (state) => {
            state.loading = false;
        },
        showToast: (state, action) => {
            state.toastMsg = action.payload.msg ? action.payload.msg : action.payload;
            state.toastType = action.payload.sev ? action.payload.sev : 'info';
            state.toastOpen = true;
        },
        hideToast: (state) => {
            state.toastOpen = false;
        }
    }
})

export const { showLoading, hideLoading } = uiSlice.actions
export default uiSlice.reducer
