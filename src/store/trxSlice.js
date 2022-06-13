import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { showLoading, hideLoading, notify } from './uiSlice'
import axios from '../axios';

const initialState = {
    trx: null,
    lastScannedBarcode: '',
    scannedItems: [],
    selectedLine: {}
}

/**
 * async actions
 */
export const scanBarcode = createAsyncThunk(
    'scanBarcode',
    async (payload, thunkAPI) => {
        thunkAPI.dispatch(showLoading());
        return axios({
            method: 'post',
            url: '/trx/scan',
            data: payload
        }).then((response) => {
            if (response && response.data) {
                thunkAPI.dispatch(hideLoading());
                // thunkAPI.dispatch(notify('Logged In!'));
                console.log('response.data', response.data)
                return thunkAPI.fulfillWithValue(response.data);
            } else {
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            if (error.response) {
                if (error.response.status === 401) {
                    thunkAPI.dispatch(hideLoading());
                    thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                }
            } else {
                thunkAPI.dispatch(hideLoading());
                thunkAPI.dispatch(notify({ msg: error.message, sev: 'error' }));
            }

        });
    }
)



/**
 * reducer
 */
export const trxSlice = createSlice({
    name: 'trxSlice',
    initialState,
    reducers: {
        resumeTrx: (state, action) => {
            state.trx = action.payload.trx;
            state.selectedLine = {};
            if (action.payload.lines) {
                state.scannedItems = action.payload.lines;
            } else {
                state.scannedItems = [];
            }
        },
        selectLine: (state, action) => {
            if (action.payload && action.payload.key) {
                state.selectedLine = action.payload;
            }else{
                state.selectedLine = {};
            }
        }
    },
    extraReducers: (builder) => {

        /* scan thunk */
        builder.addCase(scanBarcode.fulfilled, (state, action) => {
            state.lastScannedBarcode = action.payload.line.barcode;
            state.trx = action.payload.trx;
            state.scannedItems.push(action.payload.line);
            state.selectedLine = action.payload.line;
        })

        builder.addCase(scanBarcode.rejected, (state, action) => {

        })
    },
})



export const { resumeTrx, selectLine } = trxSlice.actions
export default trxSlice.reducer
