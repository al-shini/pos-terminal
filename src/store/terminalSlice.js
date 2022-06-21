import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { showLoading, hideLoading, notify } from './uiSlice'
import axios from '../axios';

const initialState = {
    authenticated: false,
    loggedInUser: null,
    token: null,
    till: {},
    balanceVariance: [],
    fastItems: [],
    display: 'ready',
    trxMode: 'Sale',
    paymentMode: false,
    paymentType: 'none', //none, cash,foreign,visa,eWallet..etc
    paymentInput: 'fixed', //fixed, numpad
    paymentMethods: {},
    cashButtons: [],
    foreignButtons: [],
    currencies: [],
    exchangeRates: {},
}

/**
 * async actions
 */

export const login = createAsyncThunk(
    'login',
    async (payload, thunkAPI) => {
        thunkAPI.dispatch(showLoading());
        return axios({
            method: 'post',
            url: '/auth/login',
            data: {
                ...payload
            }
        }).then((response) => {
            if (response && response.data) {
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
                else {
                    thunkAPI.dispatch(hideLoading());
                    thunkAPI.dispatch(notify({ msg: 'error: ' + error.response.data, sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {
                thunkAPI.dispatch(hideLoading());
                thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
                return thunkAPI.rejectWithValue(error.message);
            }

        });
    }
)

export const submitOpeningBalance = createAsyncThunk(
    'submitOpeningBalance',
    async (payload, thunkAPI) => {
        thunkAPI.dispatch(showLoading());
        return axios({
            method: 'post',
            url: '/actions/initializeBalanceVariance',
            data: {
                balanceVarianceList: thunkAPI.getState().terminal.balanceVariance,
                till: null
            }
        }).then((response) => {
            if (response && response.data) {
                thunkAPI.dispatch(hideLoading());
                thunkAPI.dispatch(notify('Openinig Balance Variance Updated!'));
                return thunkAPI.fulfillWithValue(response.data);
            } else {
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            if (error.response) {
                if (error.response.status === 401) {
                    thunkAPI.dispatch(hideLoading());
                    thunkAPI.dispatch(notify({ msg: 'Un-authorized', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                }
                else {
                    thunkAPI.dispatch(hideLoading());
                    thunkAPI.dispatch(notify({ msg: 'error: ' + error.response.data, sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {
                thunkAPI.dispatch(hideLoading());
                thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
                return thunkAPI.rejectWithValue(error.message);
            }

        });
    }
)


/**
 * reducer
 */
export const terminalSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        logout: (state) => {
            state.authenticated = false;
            state.loggedInUser = null;
            state.token = null;
            state.balanceVariance = [];
            state.till = null;
            state.display = 'none';
            localStorage.removeItem('jwt');
            localStorage.removeItem('refresh');
        },
        seemlessLogin: (state, action) => {
            state.authenticated = true;
            state.loggedInUser = action.payload.user;
            state.token = action.payload.token;
            state.balanceVariance = action.payload.balanceVarianceList;
            state.till = action.payload.till;
            console.log('seemless?');
            if (!action.payload.till.isInitialized) {
                state.display = 'balance-setup';
            } else {
                state.display = 'ready';
            }
            localStorage.setItem('jwt', action.payload.token);
        },
        updateBalance: (state, action) => {
            state.balanceVariance[action.payload.i].openingBalance = action.payload.balance;
        },
        uploadCurrencies: (state, action) => {
            state.currencies = action.payload;
        }
        ,
        uploadExchangeRates: (state, action) => {
            state.exchangeRates = action.payload;
        },
        uploadCashButtons: (state, action) => {
            state.cashButtons = action.payload;
        },
        uploadPaymentMethods: (state, action) => {
            state.paymentMethods = action.payload;
        },

        uploadForeignButtons: (state, action) => {
            state.foreignButtons = action.payload;
        },
        uploadFastItems: (state, action) => {
            state.fastItems = action.payload;
        }
        ,
        beginPayment: (state) => {
            state.paymentMode = true;
            state.display = 'payment';
        },
        setPaymentType: (state, action) => {
            state.paymentType = action.payload.type;
            state.paymentInput = action.payload.inputType;
        },
        exitNumpadEntry: (state) => {
            state.paymentInput = 'fixed';
        },
        endPaymentMode: (state) => {
            state.paymentMode = false;
        }
        ,
        abort: (state) => {
            if (state.paymentType === 'none') {
                state.paymentMode = false;
                state.display = 'ready';
                state.paymentInput = 'fixed';
            } else {
                state.paymentType = 'none';
            }
        },
        reset: (state) => {
            state.paymentMode = false;
            state.display = 'ready';
            state.paymentType = 'none';
            state.trxMode = 'Sale';
            document.querySelectorAll("body")[0].style.setProperty("background-color", "#4b4b4b", "important")
            if (document.querySelectorAll("#trxModeHeader")[0]) {
                document.querySelectorAll("#trxModeHeader")[0].style.setProperty("color", "#ffffff", "important")
            }
            if (document.querySelectorAll("#paymentsHeader")[0]) {
                document.querySelectorAll("#paymentsHeader")[0].style.setProperty("color", "#ffffff", "important")
            }
        }
        ,
        setTrxMode: (state, action) => {
            state.trxMode = action.payload;
            if (action.payload === 'Sale') {
                document.querySelectorAll("body")[0].style.setProperty("background-color", "#4b4b4b", "important")
            } else if (action.payload === 'Refund') {
                document.querySelectorAll("body")[0].style.setProperty("background-color", "#b11717", "important")
            }
        }
    },
    extraReducers: (builder) => {

        /* login thunk */
        builder.addCase(login.fulfilled, (state, action) => {
            state.authenticated = true;
            state.loggedInUser = action.payload.user;
            state.token = action.payload.token;
            state.balanceVariance = action.payload.balanceVarianceList;
            state.till = action.payload.till;
            if (!action.payload.till.isInitialized) {
                state.display = 'balance-setup';
            } else {
                state.display = 'ready';
            }
            localStorage.setItem('jwt', state.token);
            // window.setTimeout(() => {
            //     window.location.reload();
            // }, 750)
        })

        builder.addCase(login.rejected, (state, action) => {
            state.authenticated = false;
            state.loggedInUser = null;
            state.token = null;
            state.balanceVariance = [];
            state.till = null;
            state.display = 'none';
            localStorage.removeItem('jwt');
            localStorage.removeItem('refresh');
        })

        /* submitOpeningBalance thunk */
        builder.addCase(submitOpeningBalance.fulfilled, (state, action) => {
            state.till = action.payload
            if (action.payload.isInitialized) {
                state.display = 'ready';
            }
        })

        builder.addCase(submitOpeningBalance.rejected, (state, action) => {

        })

    },
})


export const { logout, seemlessLogin, updateBalance, exitNumpadEntry, setTrxMode,
    uploadCurrencies, beginPayment, endPaymentMode, uploadForeignButtons, uploadPaymentMethods, abort, reset, uploadFastItems,
    uploadExchangeRates, uploadCashButtons, setPaymentType } = terminalSlice.actions
export default terminalSlice.reducer
