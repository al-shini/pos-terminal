import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { showLoading, hideLoading, notify } from './uiSlice'
import axios from '../axios';

const initialState = {
    authenticated: false,
    loggedInUser: null,
    token: null,
    refreshToken: null
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
                username: payload.username,
                password: payload.password
            }
        }).then((response) => {
            if (response && response.data) {
                thunkAPI.dispatch(hideLoading());
                thunkAPI.dispatch(notify('Logged In!'));
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


export const refreshToken = createAsyncThunk(
    'refreshToken',
    async (payload, thunkAPI) => {
        thunkAPI.dispatch(showLoading());
        return axios({
            method: 'post',
            url: '/auth/refresh-token',
            headers: {
                refreshToken: localStorage.getItem('refresh')
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
                    thunkAPI.dispatch(notify({ msg: 'Refresh token invalid', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                }
            } else {
                thunkAPI.dispatch(notify({ msg: error.message, sev: 'error' }));
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
        logout: (state) => {
            state.authenticated = false;
            state.loggedInUser = null;
            state.token = null;
            state.refreshToken = null;
            localStorage.removeItem('jwt');
            localStorage.removeItem('refresh');
        },
        seemlessLogin: (state, action) => {
            state.authenticated = true;
            state.loggedInUser = action.payload.user;
            state.token = action.payload.token;
            state.refreshToken = action.payload.refreshToken;
            localStorage.setItem('jwt',action.payload.token);
            localStorage.setItem('refresh',action.payload.refreshToken);
        }
    },
    extraReducers: (builder) => {

        /* login thunk */
        builder.addCase(login.fulfilled, (state, action) => {
            state.authenticated = true;
            state.loggedInUser = action.payload.user;
            state.token = action.payload.token;
            state.refreshToken = action.payload.refreshToken;
            localStorage.setItem('jwt',state.token);
            localStorage.setItem('refresh',state.refreshToken);

        })

        builder.addCase(login.rejected, (state, action) => {
            state.authenticated = false;
            state.loggedInUser = null;
            state.token = null;
            state.refreshToken = null;
            localStorage.removeItem('jwt');
            localStorage.removeItem('refresh');
        })

        /* refresh token thunk */
        builder.addCase(refreshToken.fulfilled, (state, action) => {
            state.authenticated = true;
            state.loggedInUser = action.payload.user;
            state.token = action.payload.token;
            state.refreshToken = action.payload.refreshToken;
            localStorage.setItem('jwt',state.token);
            localStorage.setItem('refresh',state.refreshToken);
        })

        builder.addCase(refreshToken.rejected, (state, action) => {
            state.authenticated = false;
            state.loggedInUser = null;
            state.token = null;
            state.refreshToken = null;
            localStorage.removeItem('jwt');
            localStorage.removeItem('refresh');
        })
    },
})



export const { logout, seemlessLogin } = authSlice.actions
export default authSlice.reducer
