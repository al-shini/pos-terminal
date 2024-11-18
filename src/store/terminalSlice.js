import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { showLoading, hideLoading, notify } from './uiSlice'
import axios from '../axios';
import config from '../config';

const initialState = {
    authenticated: false,
    loggedInUser: null,
    isAdmin: false,
    store: null,
    terminal: null,
    storeCustomer: null,
    customer: null,
    token: null,
    till: {},
    suspendedForTill: [],
    fastItemGroups: [],
    selectedFastItemGroup: [],
    fastItems: [],
    display: 'ready',
    trxMode: 'Sale',
    paymentMode: false,
    paymentType: 'none', //none, cash,foreign,visa,eWallet..etc
    paymentInput: 'numpad', //fixed, numpad
    paymentMethods: {},
    cashButtons: [],
    foreignButtons: [],
    currencies: [],
    exchangeRates: {},
    blockActions: false,
    errorSound: false,
    managerMode: false,
    managerUser: '',
    _managerUser: '',
    actionState: 'free',
    
}

/**
 * async actions
 */

export const checkLoginQrAuth = createAsyncThunk(
    'checkLoginQrAuth',
    async (payload, thunkAPI) => {
        return axios({
            method: 'post',
            url: '/utilities/checkQRState',
            headers: { 
                authKey: payload
            }
        }).then((response) => {
            if (response && response.data) {
                if (response.data.status === 'Scanned') {
                    thunkAPI.dispatch(login({
                        terminalHardwareId: config.deviceId,
                        mobileHardwareId: response.data.signedBy,
                        authKey: response.data.key
                    }));
                } else {
                    if (!thunkAPI.getState().terminal.authenticated) {
                        window.setTimeout(() => {
                            thunkAPI.dispatch(checkLoginQrAuth(payload));
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

export const login = createAsyncThunk(
    'login',
    async (payload, thunkAPI) => {

        return axios({
            method: 'post',
            url: '/auth/login',
            data: {
                ...payload
            }
        }).then((response) => {
            if (response && response.data) {
                axios({
                    method: 'post',
                    url: '/posAcc/fetchCustomer',
                    headers: {
                        customerKey: response.data.store.sapCustomerCode
                    }
                }).then((response) => {
                    if (response && response.data) {
                        thunkAPI.dispatch(setStoreCustomer(response.data))
                        if (!thunkAPI.getState().terminal.customer) {
                            thunkAPI.dispatch(setCustomer(response.data))
                        }
                    }
                })

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

export const fetchSuspendedForTill = createAsyncThunk(
    'fetchSuspendedForTill',
    async (payload, thunkAPI) => {

        return axios({
            method: 'post',
            url: '/trx/fetchSuspendedForTill',
            headers: {
                tillKey: thunkAPI.getState().terminal.till.key
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



export const lockTill = createAsyncThunk(
    'lockTill',
    async (payload, thunkAPI) => {

        return axios({
            method: 'post',
            url: '/trx/lockTill',
            headers: {
                tillKey: thunkAPI.getState().terminal.till.key
            }
        }).then((response) => {
            if (response && response.data) {

                thunkAPI.dispatch(blockActions());
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

export const unlockTill = createAsyncThunk(
    'unlockTill',
    async (payload, thunkAPI) => {

        return axios({
            method: 'post',
            url: '/trx/unlockTill',
            headers: {
                tillKey: thunkAPI.getState().terminal.till.key
            }
        }).then((response) => {
            if (response && response.data) {

                thunkAPI.dispatch(unblockActions());
                return thunkAPI.fulfillWithValue(response.data);
            } else {
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            if (error.response) {
                if (error.response.status === 401) {

                    thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                } else if (error.response.status === 444) {

                    thunkAPI.dispatch(notify({ msg: 'Till is closed, restarting session...', sev: 'error' }));
                    window.setTimeout(() => {
                        thunkAPI.dispatch(logout());
                    }, 1500)
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

export const submitOpeningBalance = createAsyncThunk(
    'submitOpeningBalance',
    async (payload, thunkAPI) => {

        return axios({
            method: 'post',
            url: '/actions/initializeTill',
            headers: {
                tillKey: thunkAPI.getState().terminal.till.key
            },
            data: {
                balance: payload
            }
        }).then((response) => {
            if (response && response.data) {

                thunkAPI.dispatch(notify('Openinig Balance Variance Updated!'));
                return thunkAPI.fulfillWithValue(response.data);
            } else {
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            if (error.response) {
                if (error.response.status === 401) {

                    thunkAPI.dispatch(notify({ msg: 'Un-authorized', sev: 'error' }));
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
export const terminalSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        triggerErrorSound: (state) => {
            state.errorSound = !state.errorSound;
        },
        logout: (state) => {
            state.authenticated = false;
            state.loggedInUser = null;
            state.token = null;
            state.till = null;
            state.isAdmin = false;
            state.display = 'none';
            localStorage.removeItem('jwt');
            localStorage.removeItem('refresh');
        },
        seemlessLogin: (state, action) => {
            state.authenticated = true;
            state.loggedInUser = action.payload.user;
            state.token = action.payload.token;
            state.till = action.payload.till;
            state.store = action.payload.store;
            state.isAdmin = action.payload.admin;
            state.terminal = action.payload.terminal;
            if (action.payload.till && !action.payload.till.isInitialized) {
                state.display = 'balance-setup';
            } else {
                state.display = 'ready';
            }
            localStorage.setItem('jwt', action.payload.token);
        },
        setCustomer: (state, action) => {
            state.customer = action.payload;
        },
        setStoreCustomer: (state, action) => {
            state.storeCustomer = action.payload;
        },
        resetCustomer: (state, action) => {
            state.customer = state.storeCustomer;
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
                state.paymentInput = 'numpad';
            } else {
                state.paymentType = 'none';
            }
        },
        reset: (state) => {
            state.paymentMode = false;
            state.display = 'ready';
            state.paymentType = 'none';
            state.trxMode = 'Sale';
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
        },
        setTerminal: (state, action) => {
            state.terminal = action.payload;
        },
        blockActions: (state) => {
            state.blockActions = true
        },
        unblockActions: (state) => {
            state.blockActions = false
        },
        setManagerMode: (state, action) => {
            state.managerMode = action.payload
        },
        setManagerUser: (state, action) => {
            state.managerUser = action.payload
        },
        lockState: (state) => {
            state.actionState = 'busy'
        },
        freeState: (state) => {
            state.actionState = 'free'
        },
        verifyManagerMode: (state, action) => {
            if (state.managerUser) {
                if (state.managerUser === 'LC-2615789638091900') {
                    // abu al sadeq
                    state.managerMode = true;
                } else if (state.managerUser === 'LC-2055567876404300') {
                    // abu al dali
                    state.managerMode = true;
                }
                else if (state.managerUser === 'LC-2512523084781551') {
                    // baraa
                    state.managerMode = true;
                } else if (state.managerUser === 'LC-599798731255400') {
                    // al-atrash
                    state.managerMode = true;
                } else if (state.managerUser === 'Noteasy1@all') {
                    // manual admin
                    state.managerMode = true;
                }
                state._managerUser = '' + state.managerUser;
                state.managerUser = '';
            }
        }
    },
    extraReducers: (builder) => {

        /* login thunk */
        builder.addCase(login.fulfilled, (state, action) => {
            state.authenticated = true;
            state.loggedInUser = action.payload.user;
            state.token = action.payload.token;
            state.till = action.payload.till;
            state.store = action.payload.store;
            state.terminal = action.payload.terminal;
            state.isAdmin = action.payload.admin;
            if (action.payload.till && !action.payload.till.isInitialized) {
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
            state.till = null;
            state.store = null;
            state.isAdmin = false;
            state.display = 'none';
            localStorage.removeItem('jwt');
            localStorage.removeItem('refresh');
        })

        /* fetchSuspendedForTill thunk */
        builder.addCase(fetchSuspendedForTill.fulfilled, (state, action) => {
            state.suspendedForTill = action.payload
        })

        builder.addCase(fetchSuspendedForTill.rejected, (state, action) => {

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

        /* lockTill thunk */
        builder.addCase(lockTill.fulfilled, (state, action) => {
            state.till = action.payload
            if (action.payload.isInitialized) {
                state.display = 'ready';
            }
        })

        builder.addCase(lockTill.rejected, (state, action) => {

        })


        /* unlockTill thunk */
        builder.addCase(unlockTill.fulfilled, (state, action) => {
            state.till = action.payload
            if (action.payload.isInitialized) {
                state.display = 'ready';
            }
        })

        builder.addCase(unlockTill.rejected, (state, action) => {

        })

        /* checkLoginQrAuth thunk */
        builder.addCase(checkLoginQrAuth.fulfilled, (state, action) => {

        })

        builder.addCase(checkLoginQrAuth.rejected, (state, action) => {

        })



    },
})


export const { logout, seemlessLogin, updateBalance, exitNumpadEntry, setTrxMode, blockActions, unblockActions, setCustomer, setStoreCustomer, resetCustomer,
    uploadCurrencies, beginPayment, endPaymentMode, uploadForeignButtons, uploadPaymentMethods, abort, reset, uploadFastItems, verifyManagerMode,
    uploadExchangeRates, uploadCashButtons, setPaymentType, triggerErrorSound, setManagerMode, setManagerUser, lockState, freeState, setTerminal } = terminalSlice.actions
export default terminalSlice.reducer
