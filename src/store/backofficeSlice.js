import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { showLoading, hideLoading, notify } from './uiSlice'
import axios from '../axios';

const initialState = {
    workDay: null,
    tills: [],
    selectedTill: null,
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
            url: '/auth/storeLogin',
            data: {
                ...payload
            }
        }).then((response) => {
            if (response && response.data) {
                thunkAPI.dispatch(hideLoading());
                return thunkAPI.fulfillWithValue(response.data);
            } else {
                thunkAPI.dispatch(hideLoading());
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

export const submitTillCounts = createAsyncThunk(
    'submitTillCounts',
    async (payload, thunkAPI) => {
        thunkAPI.dispatch(showLoading());
        return axios({
            method: 'post',
            url: '/bo/submitTilLCounts',
            headers: {
                tillKey: thunkAPI.getState().backoffice.selectedTill.key
            },
            data: payload
        }).then((response) => {
            if (response && response.data) {
                thunkAPI.dispatch(hideLoading());
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

export const closeTill = createAsyncThunk(
    'closeTill',
    async (payload, thunkAPI) => {
        thunkAPI.dispatch(showLoading());
        return axios({
            method: 'post',
            url: '/bo/closeTill',
            headers: {
                tillKey: thunkAPI.getState().backoffice.selectedTill.key
            }
        }).then((response) => {
            if (response && response.data) {
                thunkAPI.dispatch(hideLoading());
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

export const endDay = createAsyncThunk(
    'endDay',
    async (payload, thunkAPI) => {
        thunkAPI.dispatch(showLoading());
        return axios({
            method: 'post',
            url: '/bo/endDay',
            headers: {
                Workdaykey: thunkAPI.getState().backoffice.workDay.key
            }
        }).then((response) => {
            if (response && response.data) {
                thunkAPI.dispatch(hideLoading());
                thunkAPI.dispatch(notify({ msg: 'Day Ended, New work day started for ' + response.data.businessDate, sev: 'info' }));
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


/**
 * reducer
 */
export const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setWorkDay: (state, action) => {
            state.workDay = action.payload;
        },
        setTills: (state, action) => {
            state.tills = action.payload;
        },
        setSelectedTill: (state, action) => {
            state.selectedTill = action.payload;
        },
        updateBalance: (state, action) => {
            state.selectedTill.balances[action.payload.i].closingBalance = action.payload.balance;
        },
    },
    extraReducers: (builder) => {

        /* submitTillCounts thunk */
        builder.addCase(submitTillCounts.fulfilled, (state, action) => {
            state.tills = action.payload.list;
            state.selectedTill = action.payload.till;
        })

        builder.addCase(submitTillCounts.rejected, (state, action) => {
        })

        /* closeTill thunk */
        builder.addCase(closeTill.fulfilled, (state, action) => {
            state.tills = action.payload;
            state.selectedTill = null;
        })

        builder.addCase(closeTill.rejected, (state, action) => {
        })

        /* endDay thunk */
        builder.addCase(endDay.fulfilled, (state, action) => {
            state.workDay = action.payload;
        })

        builder.addCase(endDay.rejected, (state, action) => {
        })

    },
})


export const { setWorkDay, setTills, setSelectedTill, updateBalance } = authSlice.actions
export default authSlice.reducer
