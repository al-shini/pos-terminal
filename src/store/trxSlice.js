import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { showLoading, hideLoading, notify } from './uiSlice'
import { fetchSuspendedForTill, resetCustomer, setCustomer, setManagerMode, setManagerUser, setTrxMode, triggerErrorSound } from './terminalSlice';
import { reset } from './terminalSlice'
import config from '../config';
import axios from '../axios';

const initialState = {
    trx: null,
    scannedItems: [],
    selectedLine: {},
    multiplier: 1,
    numberInputValue: '',
    selectedCurrency: '',
    selectedPaymentMethod: {},
    payments: [],
    selectedPayment: {},
    trxPaid: 0,
    trxChange: 0,
    priceChangeMode: false,
    scrollToggle: false,
    // qr auth operations
    qrAuthState: 'idle', //idle, pending
    lastTrxPayment: null,
    cashBackCoupons: [],
    usedCoupons: {},
    priceChangeReason: '' 

}

/**
 * async actions
 */

export const scanNewTransaction = createAsyncThunk(
    'scanNewTransaction',
    async (payload, thunkAPI) => {
        // 
        if (payload.barcode.includes('SUS-')) {
            return axios({
                method: 'post',
                url: '/trx/resumeSuspended',
                headers: {
                    nanoId: payload.barcode,
                    tillKey: thunkAPI.getState().terminal.till ? thunkAPI.getState().terminal.till.key : null
                }
            }).then((response) => {
                if (response && response.data) {

                    return thunkAPI.fulfillWithValue(response.data);
                } else {
                    return thunkAPI.rejectWithValue('Incorrect server response');
                }
            }).catch((error) => {
                console.log(error);
                if (error.response) {
                    if (error.response.status === 401) {

                        thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                        return thunkAPI.rejectWithValue('Un-authorized');
                    } else {
                        thunkAPI.dispatch(triggerErrorSound());

                        thunkAPI.dispatch(notify({ msg: 'error: ' + error.response.data, sev: 'error' }));
                        return thunkAPI.rejectWithValue(error.response.data);
                    }
                } else {

                    thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
                }
            });
        } else {
            return axios({
                method: 'post',
                url: '/trx/scanNew',
                data: payload
            }).then((response) => {
                if (response && response.data) {

                    if (!payload.barcode.includes('C-')) {
                        thunkAPI.dispatch(scanBarcode(
                            {
                                customerKey: thunkAPI.getState().terminal.customer ? thunkAPI.getState().terminal.customer.key : null,
                                barcode: payload.barcode,
                                trxKey: response.data.trx.key,
                                trxMode: thunkAPI.getState().terminal.trxMode,
                                tillKey: thunkAPI.getState().terminal.till ? thunkAPI.getState().terminal.till.key : null,
                                multiplier: thunkAPI.getState().trx.multiplier ? thunkAPI.getState().trx.multiplier : '1'
                            }
                        ));
                    } else {
                        thunkAPI.dispatch(setCustomer(response.data.customer))
                    }
                    return thunkAPI.fulfillWithValue(response.data);
                } else {
                    return thunkAPI.rejectWithValue('Incorrect server response');
                }
            }).catch((error) => {
                console.log(error);
                if (error.response) {
                    if (error.response.status === 401) {

                        thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                        return thunkAPI.rejectWithValue('Un-authorized');
                    } else {
                        thunkAPI.dispatch(triggerErrorSound());

                        thunkAPI.dispatch(notify({ msg: 'error: ' + error.response.data, sev: 'error' }));
                        return thunkAPI.rejectWithValue(error.response.data);
                    }
                } else {

                    thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
                }
            });
        }
    }
)

export const scanBarcode = createAsyncThunk(
    'scanBarcode',
    async (payload, thunkAPI) => {
        // 

        if (!payload.trxKey) {
            thunkAPI.dispatch(notify({ msg: 'No valid transaction ', sev: 'error' }));
            return thunkAPI.rejectWithValue('No valid transaction ');
        }

        return axios({
            method: 'post',
            url: '/trx/new-scan',
            data: payload
        }).then((response) => {
            if (response && response.data) {

                console.log('response.data', response.data)
                thunkAPI.dispatch(scroll());
                if (response.data.customer) {
                    thunkAPI.dispatch(setCustomer(response.data.customer));
                }
                return thunkAPI.fulfillWithValue(response.data);
            } else {
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            console.log(error);
            if (error.response) {
                if (error.response.status === 401) {

                    thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                } else {
                    thunkAPI.dispatch(triggerErrorSound());

                    thunkAPI.dispatch(notify({ msg: 'error: ' + error.response.data, sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {

                thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
            }

        });
    }
)

export const rescanTrx = createAsyncThunk(
    'rescanTrx',
    async (payload, thunkAPI) => {
        // 

        if (!payload.trxKey) {
            thunkAPI.dispatch(notify({ msg: 'No valid transaction ', sev: 'error' }));
            return thunkAPI.rejectWithValue('No valid transaction ');
        }

        thunkAPI.dispatch(showLoading());

        return axios({
            method: 'post',
            url: '/trx/rescanTrx',
            headers: {
                trxKey: payload.trxKey
            }
        }).then((response) => {
            if (response && response.data) {

                console.log('response.data', response.data)
                thunkAPI.dispatch(scroll());
                if (response.data.customer) {
                    thunkAPI.dispatch(setCustomer(response.data.customer));
                }
                thunkAPI.dispatch(hideLoading());
                return thunkAPI.fulfillWithValue(response.data);
            } else {
                thunkAPI.dispatch(hideLoading());
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            console.log(error);
            if (error.response) {
                if (error.response.status === 401) {

                    thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                } else {
                    thunkAPI.dispatch(triggerErrorSound());

                    thunkAPI.dispatch(notify({ msg: 'error: ' + error.response.data, sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {

                thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
            }

        });
    }
)

export const submitPayment = createAsyncThunk(
    'submitPayment',
    async (payload, thunkAPI) => {
        let data = {
            ...payload
        };
        let multi = thunkAPI.getState().trx.multiplier;
        if (!multi || multi === 0)
            multi = 1;

        data.amount = data.amount * multi;

        return axios({
            method: 'post',
            url: '/trx/submitPayment',
            data
        }).then((response) => {
            if (response && response.data) {
                console.log('response.data', response.data)
                thunkAPI.dispatch(clearNumberInput());
                // if (response.data.closeTrx) {
                    //thunkAPI.dispatch(closeTrxPayment({
                    //    key: response.data.trx.key
                    //}));
                    // window.setTimeout(() => {
                        // thunkAPI.dispatch(clearLastPaymentHistory());
                    // }, 6000)
                // }
                return thunkAPI.fulfillWithValue(response.data);
            } else {
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            console.log(error);
            if (error.response) {
                if (error.response.status === 401) {

                    thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                } else if (error.response.status === 499) {

                    thunkAPI.dispatch(notify({ msg: error.response.data, sev: 'warning' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                } else {

                    thunkAPI.dispatch(notify({ msg: 'error: ' + error.response.data, sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {

                thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
            }

        });
    }
)

export const closeTrxPayment = createAsyncThunk(
    'closeTrxPayment',
    async (payload, thunkAPI) => {

        return axios({
            method: 'post',
            url: '/trx/closeTrxPayment',
            headers: {
                trxKey: payload.key
            }
        }).then((response) => {
            if (response && response.data) {

                thunkAPI.dispatch(notify({ msg: 'Transaction paid, print invoice ☺', sev: 'info' }));

                if (payload.sendToNumber) {
                    axios({
                        method: 'post',
                        url: 'https://api.ultramsg.com/instance18549/messages/chat',
                        data: {
                            token: 'qkyt6m0d1g4it3c8',
                            to: '+970' + payload.sendToNumber + ',+972' + payload.sendToNumber,
                            body: 'فاتورتك: ' + 'http://invoice.shini.ps?sptr=' + response.data.key + '_' + response.data.nanoId,
                            priority: '1',
                            referenceId: ''
                        }
                    }).catch((error) => {
                        console.log(error.response, error.message);
                        thunkAPI.dispatch(notify({ msg: 'could not print receipt - ' + (error.response ? error.response : error.message), sev: 'error' }));
                    });
                } else {
                    axios({
                        method: 'get',
                        url: `http://localhost:${config.printServicePort ? config.printServicePort : config.expressPort ? config.expressPort : '3001'}/printTrx?trxKey=` + response.data.key,
                    }).catch((error) => {
                        console.log(error.response, error.message);
                        thunkAPI.dispatch(notify({ msg: 'could not print receipt - ' + (error.response ? error.response : error.message), sev: 'error' }));
                    });
                }

                thunkAPI.dispatch(setManagerMode(false));
                thunkAPI.dispatch(setManagerUser(null));
                thunkAPI.dispatch(resetCustomer());
                thunkAPI.dispatch(reset());
                return thunkAPI.fulfillWithValue(response.data);
            } else {
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            console.log(error);
            if (error.response) {
                if (error.response.status === 401) {

                    thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                } else if (error.response.status === 499) {

                    thunkAPI.dispatch(notify({ msg: error.response.data, sev: 'warning' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                } else {

                    thunkAPI.dispatch(notify({ msg: 'error: ' + error.response.data, sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {

                thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
            }

        });
    }
)

export const voidTrx = createAsyncThunk(
    'voidTrx',
    async (payload, thunkAPI) => {

        return axios({
            method: 'post',
            url: '/trx/voidTrx',
            headers: {
                trxKey: payload
            }
        }).then((response) => {
            if (response && response.data) {

                thunkAPI.dispatch(notify({ msg: 'TRX ' + response.data.nanoId + ' voided', sev: 'info' }));
                thunkAPI.dispatch(resetCustomer());
                thunkAPI.dispatch(reset());
                thunkAPI.dispatch(setManagerMode(false));
                thunkAPI.dispatch(setManagerUser(null));
                return thunkAPI.fulfillWithValue(response.data);
            } else {
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            console.log(error);
            if (error.response) {
                if (error.response.status === 401) {

                    thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                } else if (error.response.status === 499) {

                    thunkAPI.dispatch(notify({ msg: error.response.data, sev: 'warning' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                } else {

                    thunkAPI.dispatch(notify({ msg: 'error: ' + error.response.data, sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {

                thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
            }

        });
    }
)

export const suspendTrx = createAsyncThunk(
    'suspendTrx',
    async (payload, thunkAPI) => {

        return axios({
            method: 'post',
            url: '/trx/suspendTrx',
            headers: {
                trxKey: payload
            }
        }).then((response) => {
            if (response && response.data) {

                thunkAPI.dispatch(notify({ msg: 'TRX ' + response.data.nanoId + ' suspended', sev: 'info' }));
                thunkAPI.dispatch(resetCustomer());
                thunkAPI.dispatch(reset());
                thunkAPI.dispatch(setManagerMode(false));
                thunkAPI.dispatch(setManagerUser(null));

                thunkAPI.dispatch(setManagerUser(null));
                thunkAPI.dispatch(fetchSuspendedForTill());


                return thunkAPI.fulfillWithValue(response.data);
            } else {
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            console.log(error);
            if (error.response) {
                if (error.response.status === 401) {

                    thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                } else if (error.response.status === 499) {

                    thunkAPI.dispatch(notify({ msg: error.response.data, sev: 'warning' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                } else {

                    thunkAPI.dispatch(notify({ msg: 'error: ' + error.response.data, sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {

                thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
            }

        });
    }
)

export const voidPayment = createAsyncThunk(
    'voidPayment',
    async (payload, thunkAPI) => {

        const data = {
            trxKey: thunkAPI.getState().trx.trx.key,
            lineKey: payload
        };
        return axios({
            method: 'post',
            url: '/trx/voidPayment',
            data
        }).then((response) => {
            if (response && response.data) {

                return thunkAPI.fulfillWithValue(response.data);
            } else {
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            console.log(error);
            if (error.response) {
                if (error.response.status === 401) {

                    thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                } else if (error.response.status === 499) {

                    thunkAPI.dispatch(notify({ msg: error.response.data, sev: 'warning' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                } else {

                    thunkAPI.dispatch(notify({ msg: 'error: ' + error.response.data, sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {

                thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
            }

        });
    }
)

export const voidLine = createAsyncThunk(
    'voidLine',
    async (payload, thunkAPI) => {

        const data = {
            trxKey: thunkAPI.getState().trx.trx.key,
            lineKey: payload
        };
        return axios({
            method: 'post',
            url: '/trx/voidLine',
            data
        }).then((response) => {
            if (response && response.data) {

                return thunkAPI.fulfillWithValue(response.data);
            } else {
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            console.log(error);
            if (error.response) {
                if (error.response.status === 401) {

                    thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                } else if (error.response.status === 499) {

                    thunkAPI.dispatch(notify({ msg: error.response.data, sev: 'warning' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                } else {

                    thunkAPI.dispatch(notify({ msg: 'error: ' + error.response.data, sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {

                thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
            }

        });
    }
)

export const changePrice = createAsyncThunk(
    'changePrice',
    async (payload, thunkAPI) => {
        return axios({
            method: 'post',
            url: '/trx/linePriceChange',
            headers: {
                lineKey: thunkAPI.getState().trx.selectedLine ? thunkAPI.getState().trx.selectedLine.key : null,
                newPrice: thunkAPI.getState().trx.numberInputValue ? parseFloat(thunkAPI.getState().trx.numberInputValue) : 0.0,
                reason: thunkAPI.getState().trx.priceChangeReason ? thunkAPI.getState().trx.priceChangeReason : '',
            }
        }).then((response) => {
            if (response && response.data) {
                thunkAPI.dispatch(notify({ msg: 'Line Price Changed', sev: 'info' }));
                // thunkAPI.dispatch(reset());
                thunkAPI.dispatch(clearNumberInput());
                thunkAPI.dispatch(clearPriceChangeReason());
                return thunkAPI.fulfillWithValue(response.data);
            } else {
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            console.log(error);
            if (error.response) {
                if (error.response.status === 401) {
                    thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                } else if (error.response.status === 499) {
                    thunkAPI.dispatch(notify({ msg: error.response.data, sev: 'warning' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                } else {
                    thunkAPI.dispatch(notify({ msg: 'error: ' + error.response.data, sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {
                thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
            }

        });
    }
)

export const checkOperationQrAuth = createAsyncThunk(
    'checkOperationQrAuth',
    async (payload, thunkAPI) => {
        return axios({
            method: 'post',
            url: '/utilities/checkQRState',
            headers: {
                authKey: payload.qrAuthKey
            }
        }).then((response) => {
            if (response && response.data) {
                if (response.data.status === 'Scanned') {
                    switch (payload.source) {
                        case 'VoidTRX': {
                            thunkAPI.dispatch(voidTrx(response.data.sourceKey));
                            thunkAPI.dispatch(holdQrAuthCheck());
                            break;
                        }
                        case 'VoidLine': {
                            thunkAPI.dispatch(voidLine(response.data.sourceKey));
                            thunkAPI.dispatch(holdQrAuthCheck());
                            break;
                        }
                        case 'VoidPayment': {
                            thunkAPI.dispatch(voidPayment(response.data.sourceKey));
                            thunkAPI.dispatch(holdQrAuthCheck());
                            break;
                        }
                        case 'SuspendTRX': {
                            thunkAPI.dispatch(suspendTrx(response.data.sourceKey));
                            thunkAPI.dispatch(holdQrAuthCheck());
                            break;
                        }
                        case 'PriceChange': {
                            thunkAPI.dispatch(enablePriceChange());
                            thunkAPI.dispatch(holdQrAuthCheck());
                            break;
                        }
                        case 'ManagerMode': {
                            thunkAPI.dispatch(setManagerMode(true));
                            thunkAPI.dispatch(setManagerUser(response.data));
                            thunkAPI.dispatch(holdQrAuthCheck());
                            break;
                        }
                        case 'Refund': {
                            thunkAPI.dispatch(setTrxMode('Refund'));
                            thunkAPI.dispatch(holdQrAuthCheck());
                            break;
                        }
                    }
                } else {
                    if (thunkAPI.getState().trx.qrAuthState === 'pending') {
                        window.setTimeout(() => {
                            thunkAPI.dispatch(checkOperationQrAuth(payload));
                        }, 1500);
                    }
                }
                return thunkAPI.fulfillWithValue(response.data);
            } else {
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            if (error.response) {
                if (error.response.status === 401) {
                    thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                }
                else {
                    thunkAPI.dispatch(notify({ msg: 'error: ' + error.response.data, sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {

                thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
                return thunkAPI.rejectWithValue(error.message);
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
        startQrAuthCheck: (state, action) => {
            state.qrAuthState = 'pending';
        },
        holdQrAuthCheck: (state, action) => {
            state.qrAuthState = 'idle';
        },
        resumeTrx: (state, action) => {
            state.trx = action.payload.trx;
            state.selectedLine = {};
            if (action.payload.lines) {
                state.scannedItems = action.payload.lines;
            } else {
                state.scannedItems = [];
            }
        },
        setTrx: (state, action) => {
            state.trx = action.payload;
        },
        selectLine: (state, action) => {
            if (action.payload && action.payload.key) {
                state.selectedLine = action.payload;
            } else {
                state.selectedLine = {};
            }
        },
        clearNumberInput: (state) => {
            state.numberInputValue = '';
            state.multiplier = '1';
        },
        clearPriceChangeReason: (state) => {
            state.priceChangeReason= ''
        },
        prepareScanMultiplier: (state) => {
            if (!state.numberInputValue || state.numberInputValue === '')
                state.multiplier = '1';
            else {
                state.multiplier = state.numberInputValue;
                state.numberInputValue = '';
            }
        },

        handleNumberInputEntry: (state, action) => {
            const input = action.payload.value;
            const lastChar = input[input.length - 1];
            if (lastChar === '.') {
                if (state.numberInputValue.includes(lastChar)) {
                    return;
                }
            }

            console.log(action.payload.paymentMode);

            if (action.payload.paymentMode) {
                if (state.selectedPaymentMethod === 'Voucher') {
                    // allow up to 14 digits
                    if (state.numberInputValue.length < 14) { state.numberInputValue = state.numberInputValue + input; }
                } else {
                    if (state.numberInputValue.length < 7) { state.numberInputValue = state.numberInputValue + input; }
                }
            }
            else
                state.numberInputValue = state.numberInputValue + input;

        },
        handleNumberInputChange: (state, action) => {
            const input = action.payload.value;
            const lastChar = input[input.length - 1];
            if (lastChar === '.') {
                if (state.numberInputValue.includes(lastChar)) {
                    return;
                }
            }


            if (action.payload.paymentMode) {
                if (state.selectedPaymentMethod === 'Voucher') {
                    // allow up to 14 digits
                    state.numberInputValue = (input + '').slice(0, 14);
                } else {
                    state.numberInputValue = (input + '').slice(0, 7);
                }
            }
            else
                state.numberInputValue = input;

        },
        reverseNumberInputEntry: (state) => {
            if (state.numberInputValue.length > 0) {
                let subStr = state.numberInputValue;
                subStr = subStr.slice(0, -1);
                state.numberInputValue = subStr;
            } else {
                state.multiplier = '1'
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
        },
        enablePriceChange: (state, action) => {
            state.priceChangeMode = true;
        }
        ,
        disablePriceChange: (state, action) => {
            state.priceChangeMode = false;
        },
        scroll: (state, action) => {
            state.scrollToggle = !state.scrollToggle
        },
        clearLastPaymentHistory: (state) => {
            state.lastTrxPayment = null
        },
        uploadCashBackCoupons: (state, action) => {
            state.cashBackCoupons = action.payload
        },
        setUsedCoupons: (state, action) => {
            state.usedCoupons = action.payload
        },
        setPriceChangeReason: (state, action) => {
            state.priceChangeReason = action.payload
        },
    },
    extraReducers: (builder) => {


        /* checkOperationQrAuth thunk */
        builder.addCase(checkOperationQrAuth.fulfilled, (state, action) => {

        })

        builder.addCase(checkOperationQrAuth.rejected, (state, action) => {

        })


        /* scanNewTransaction thunk */
        builder.addCase(scanNewTransaction.fulfilled, (state, action) => {
            state.trx = action.payload.trx;
            state.scannedItems = action.payload.trxLines;
            state.numberInputValue = '';
            state.multiplier = '1'
        })

        builder.addCase(scanNewTransaction.rejected, (state, action) => {

        })


        /* scan thunk */
        builder.addCase(scanBarcode.fulfilled, (state, action) => {
            if (action.payload.line) {
                state.trx = action.payload.trx;
                state.scannedItems = action.payload.trxLines;
                state.selectedLine = action.payload.line;
                state.numberInputValue = '';
                state.multiplier = '1'
            }
        })

        builder.addCase(scanBarcode.rejected, (state, action) => {

        })


        /* rescanTrx thunk */
        builder.addCase(rescanTrx.fulfilled, (state, action) => {
            if (action.payload.line) {
                state.trx = action.payload.trx;
                state.scannedItems = action.payload.trxLines;
                state.selectedLine = action.payload.line;
                state.numberInputValue = '';
                state.multiplier = '1'
            }
        })

        builder.addCase(rescanTrx.rejected, (state, action) => {

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
            state.lastTrxPayment = {
                paid: state.trxPaid,
                change: state.trxChange
            }
            state.trx = null;
            state.scannedItems = [];
            state.selectedLine = {};
            state.numberInputValue = '';
            state.multiplier = '1'
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
            if (action.payload.line) {
                state.trx = action.payload.trx;
                state.scannedItems = action.payload.trxLines;
                state.selectedLine = action.payload.line;
                state.numberInputValue = '';
                state.multiplier = '1'
            }
        })

        builder.addCase(voidLine.rejected, (state, action) => {

        })

        /* voidTrx thunk */
        builder.addCase(voidTrx.fulfilled, (state, action) => {
            // reset trx state (prepare to start new one)
            state.trx = null;
            state.scannedItems = [];
            state.selectedLine = {};
            state.numberInputValue = '';
            state.multiplier = '1'
            state.selectedCurrency = '';
            state.selectedPaymentMethod = {};
            state.payments = [];
            state.selectedPayment = {};
            state.trxPaid = 0;
            state.trxChange = 0;
        })

        builder.addCase(voidTrx.rejected, (state, action) => {

        })

        /* suspendTrx thunk */
        builder.addCase(suspendTrx.fulfilled, (state, action) => {
            // reset trx state (prepare to start new one)
            state.trx = null;
            state.scannedItems = [];
            state.selectedLine = {};
            state.numberInputValue = '';
            state.multiplier = '1'
            state.selectedCurrency = '';
            state.selectedPaymentMethod = {};
            state.payments = [];
            state.selectedPayment = {};
            state.trxPaid = 0;
            state.trxChange = 0;
        })

        builder.addCase(suspendTrx.rejected, (state, action) => {

        })

        /* changePrice thunk */
        builder.addCase(changePrice.fulfilled, (state, action) => {
            if (action.payload.line) {
                state.trx = action.payload.trx;
                state.scannedItems = action.payload.trxLines;
                state.selectedLine = action.payload.line;
                state.numberInputValue = '';
                state.multiplier = '1';
                state.priceChangeMode = false;
            }

        })

        builder.addCase(changePrice.rejected, (state, action) => {

        })

    },
})



export const { resumeTrx, selectLine, clearNumberInput, handleNumberInputChange, selectPayment, uploadPayments, setTrx, enablePriceChange, disablePriceChange, scroll,
    prepareScanMultiplier, handleNumberInputEntry, reverseNumberInputEntry, selectPaymentMethod, selectCurrency, holdQrAuthCheck, startQrAuthCheck, clearLastPaymentHistory,
    uploadCashBackCoupons, setUsedCoupons, setPriceChangeReason, clearPriceChangeReason
} = trxSlice.actions
export default trxSlice.reducer
