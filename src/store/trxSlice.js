import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { showLoading, hideLoading, notify } from './uiSlice'
import { reset } from './terminalSlice'
import axios from '../axios';

const initialState = {
    trx: null,
    lastScannedBarcode: '',
    scannedItems: [],
    selectedLine: {},
    numberInputMode: '',
    numberInputValue: '',
    selectedCurrency: '',
    selectedPaymentMethod: {},
    payments: [],
    selectedPayment: {},
    trxPaid: 0,
    trxChange: 0
}

/**
 * async actions
 */
export const scanBarcode = createAsyncThunk(
    'scanBarcode',
    async (payload, thunkAPI) => {
        // thunkAPI.dispatch(showLoading());
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
            console.log(error);
            if (error.response) {
                if (error.response.status === 401) {
                    thunkAPI.dispatch(hideLoading());
                    thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                } else {
                    thunkAPI.dispatch(hideLoading());
                    thunkAPI.dispatch(notify({ msg: error.response.data, sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {
                thunkAPI.dispatch(hideLoading());
                thunkAPI.dispatch(notify({ msg: error.message, sev: 'error' }));
            }

        });
    }
)

export const submitPayment = createAsyncThunk(
    'submitPayment',
    async (payload, thunkAPI) => {
        thunkAPI.dispatch(showLoading());
        return axios({
            method: 'post',
            url: '/trx/submitPayment',
            data: payload
        }).then((response) => {
            if (response && response.data) {
                thunkAPI.dispatch(hideLoading());
                console.log('response.data', response.data)
                thunkAPI.dispatch(clearNumberInput());
                return thunkAPI.fulfillWithValue(response.data);
            } else {
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            console.log(error);
            if (error.response) {
                if (error.response.status === 401) {
                    thunkAPI.dispatch(hideLoading());
                    thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                } else if (error.response.status === 499) {
                    thunkAPI.dispatch(hideLoading());
                    thunkAPI.dispatch(notify({ msg: error.response.data, sev: 'warning' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                } else {
                    thunkAPI.dispatch(hideLoading());
                    thunkAPI.dispatch(notify({ msg: error.response.data, sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {
                thunkAPI.dispatch(hideLoading());
                thunkAPI.dispatch(notify({ msg: error.message, sev: 'error' }));
            }

        });
    }
)


export const closeTrxPayment = createAsyncThunk(
    'closeTrxPayment',
    async (payload, thunkAPI) => {
        thunkAPI.dispatch(showLoading());
        return axios({
            method: 'get',
            url: '/trx/closeTrxPayment/' + payload
        }).then((response) => {
            if (response && response.data) {
                thunkAPI.dispatch(hideLoading());
                thunkAPI.dispatch(notify({ msg: 'Transaction paid, prepare for next customer ☺', sev: 'info' }));
                thunkAPI.dispatch(reset());
                return thunkAPI.fulfillWithValue(response.data);
            } else {
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            console.log(error);
            if (error.response) {
                if (error.response.status === 401) {
                    thunkAPI.dispatch(hideLoading());
                    thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                } else if (error.response.status === 499) {
                    thunkAPI.dispatch(hideLoading());
                    thunkAPI.dispatch(notify({ msg: error.response.data, sev: 'warning' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                } else {
                    thunkAPI.dispatch(hideLoading());
                    thunkAPI.dispatch(notify({ msg: error.response.data, sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {
                thunkAPI.dispatch(hideLoading());
                thunkAPI.dispatch(notify({ msg: error.message, sev: 'error' }));
            }

        });
    }
)



export const voidPayment = createAsyncThunk(
    'voidPayment',
    async (payload, thunkAPI) => {
        thunkAPI.dispatch(showLoading());
        return axios({
            method: 'post',
            url: '/trx/voidPayment',
            data: payload
        }).then((response) => {
            if (response && response.data) {
                thunkAPI.dispatch(hideLoading());
                return thunkAPI.fulfillWithValue(response.data);
            } else {
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            console.log(error);
            if (error.response) {
                if (error.response.status === 401) {
                    thunkAPI.dispatch(hideLoading());
                    thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                } else if (error.response.status === 499) {
                    thunkAPI.dispatch(hideLoading());
                    thunkAPI.dispatch(notify({ msg: error.response.data, sev: 'warning' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                } else {
                    thunkAPI.dispatch(hideLoading());
                    thunkAPI.dispatch(notify({ msg: error.response.data, sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {
                thunkAPI.dispatch(hideLoading());
                thunkAPI.dispatch(notify({ msg: error.message, sev: 'error' }));
            }

        });
    }
)

export const voidLine = createAsyncThunk(
    'voidLine',
    async (payload, thunkAPI) => {
        thunkAPI.dispatch(showLoading());
        return axios({
            method: 'post',
            url: '/trx/voidLine',
            data: payload
        }).then((response) => {
            if (response && response.data) {
                thunkAPI.dispatch(hideLoading());
                return thunkAPI.fulfillWithValue(response.data);
            } else {
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            console.log(error);
            if (error.response) {
                if (error.response.status === 401) {
                    thunkAPI.dispatch(hideLoading());
                    thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                } else if (error.response.status === 499) {
                    thunkAPI.dispatch(hideLoading());
                    thunkAPI.dispatch(notify({ msg: error.response.data, sev: 'warning' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                } else {
                    thunkAPI.dispatch(hideLoading());
                    thunkAPI.dispatch(notify({ msg: error.response.data, sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.response.data);
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
            } else {
                state.selectedLine = {};
            }
        },
        clearNumberInput: (state) => {
            state.numberInputMode = '';
            state.numberInputValue = '';
        },
        prepareNumberInputMode: (state, action) => {
            state.numberInputMode = action.payload
        },
        prepareScanMultiplier: (state) => {
            if (!state.numberInputValue || state.numberInputValue === '')
                state.numberInputValue = '1';

            state.numberInputMode = 'multiplier';
            state.numberInputModeState = 'ready';
        },
        handleNumberInputEntry: (state, action) => {
            const input = action.payload;
            if (state.numberInputValue.length < 7)
                state.numberInputValue = state.numberInputValue + input;
        },
        handleNumberInputChange: (state, action) => {
            const input = action.payload;
            state.numberInputValue = (input + '').slice(0, 7);
        },
        reverseNumberInputEntry: (state) => {
            if (state.numberInputValue.length > 0) {
                let subStr = state.numberInputValue;
                subStr = subStr.slice(0, -1);
                state.numberInputValue = subStr;
            }
        }, selectCurrency: (state, action) => {
            state.selectedCurrency = action.payload;
        }, selectPayment: (state, action) => {
            state.selectedPayment = action.payload;
        }
        , uploadPayments: (state, action) => {
            if (action.payload.payments) {
                state.payments = action.payload.payments;
                state.trx = action.payload.trx;
                state.trxPaid = action.payload.totalPaid;
                state.trxChange = action.payload.change;
            }
        }
        , selectPaymentMethod: (state, action) => {
            state.selectedPaymentMethod = action.payload;
        }
    },
    extraReducers: (builder) => {

        /* scan thunk */
        builder.addCase(scanBarcode.fulfilled, (state, action) => {
            if (action.payload.line) {
                state.lastScannedBarcode = action.payload.line.barcode;
                state.trx = action.payload.trx;
                state.scannedItems = action.payload.trxLines;
                state.selectedLine = action.payload.line;
                state.numberInputMode = '';
                state.numberInputValue = '';
            }

        })

        builder.addCase(scanBarcode.rejected, (state, action) => {

        })

        /* submitPayment thunk */
        builder.addCase(submitPayment.fulfilled, (state, action) => {
            if (action.payload.payments) {
                state.payments = action.payload.payments;
                state.trxPaid = action.payload.totalPaid;
                state.trxChange = action.payload.change;
                state.trx = action.payload.trx;
            }

        })

        builder.addCase(submitPayment.rejected, (state, action) => {

        })

        /* closeTrxPayment thunk */
        builder.addCase(closeTrxPayment.fulfilled, (state, action) => {
            // reset trx state (prepare to start new one)
            state.trx = null;
            state.lastScannedBarcode = '';
            state.scannedItems = [];
            state.selectedLine = {};
            state.numberInputMode = '';
            state.numberInputValue = '';
            state.selectedCurrency = '';
            state.selectedPaymentMethod = {};
            state.payments = [];
            state.selectedPayment = {};
            state.trxPaid = 0;
            state.trxChange = 0;
        })

        builder.addCase(closeTrxPayment.rejected, (state, action) => {

        })

        /* voidPayment thunk */
        builder.addCase(voidPayment.fulfilled, (state, action) => {
            if (action.payload.payments) {
                state.payments = action.payload.payments;
                state.trxPaid = action.payload.totalPaid;
                state.trxChange = action.payload.change;
                state.trx = action.payload.trx;
            }

        })

        builder.addCase(voidPayment.rejected, (state, action) => {

        })

        /* voidLine thunk */
        builder.addCase(voidLine.fulfilled, (state, action) => {

        })

        builder.addCase(voidLine.rejected, (state, action) => {

        })
    },
})



export const { resumeTrx, selectLine, clearNumberInput, prepareNumberInputMode, handleNumberInputChange, selectPayment, uploadPayments,
    prepareScanMultiplier, handleNumberInputEntry, reverseNumberInputEntry, selectPaymentMethod, selectCurrency } = trxSlice.actions
export default trxSlice.reducer
