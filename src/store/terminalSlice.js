import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { showLoading, hideLoading, notify } from './uiSlice'
import axios from '../axios';

const initialState = {
    authenticated: false,
    loggedInUser: null,
    token: null,
    till: {},
    balanceVariance: [],
    display: 'ready',
    trxMode: 'Sale',
    paymentMode: false,
    paymentMethods: [],
    currencies: [],
    exchangeRates: {}
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
                thunkAPI.dispatch(hideLoading());
                thunkAPI.dispatch(notify('Logged In!'));
                console.log(response.data);
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
                    thunkAPI.dispatch(notify({ msg: error.response.data, sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {
                thunkAPI.dispatch(hideLoading());
                thunkAPI.dispatch(notify({ msg: error.message, sev: 'error' }));
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
                    thunkAPI.dispatch(notify({ msg: error.response.data, sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {
                thunkAPI.dispatch(hideLoading());
                thunkAPI.dispatch(notify({ msg: error.message, sev: 'error' }));
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
        uploadPaymentMethods: (state, action) => {
            state.paymentMethods = action.payload;
        }
        ,
        uploadCurrencies: (state, action) => {
            state.currencies = action.payload;
        }
        ,
        uploadExchangeRates: (state, action) => {
            state.exchangeRates = action.payload;
        }
        ,
        beginPayment: (state) => {
            state.paymentMode = true;
        }
        ,
        endPaymentMode: (state) => {
            state.paymentMode = false;
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


export const { logout, seemlessLogin, updateBalance,
    uploadPaymentMethods, uploadCurrencies, beginPayment,endPaymentMode,
    uploadExchangeRates } = terminalSlice.actions
export default terminalSlice.reducer
