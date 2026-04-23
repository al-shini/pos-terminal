import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { showLoading, hideLoading, notify } from './uiSlice'
import axios from '../axios';

const initialState = {
    workDay: null,
    tills: [],
    selectedTill: null,

    activeTab: 'day',

    globalSearch: {
        query: '',
    },

    trxSearch: {
        filters: {
            serial: '',
            nanoId: '',
            dateFrom: null,
            dateTo: null,
            customerKey: null,
            cashierKey: null,
            type: 'All',
            status: 'All',
            limit: 50,
            offset: 0,
        },
        rows: [],
        totalCount: 0,
        loading: false,
        lastRunAt: null,
    },
    trxSelected: {
        loading: false,
        trx: null,
    },

    // When set, the admin shell renders the A4 print overlay for this trx.
    // We keep it in Redux (not window.open) because Electron blocks popups
    // by default and the overlay approach also keeps the admin context.
    printInvoiceKey: null,

    customerSearch: {
        query: '',
        field: 'any',
        rows: [],
        loading: false,
    },
    customerSelected: {
        customer: null,
        history: [],
        historyLoading: false,
        historyTotal: 0,
        historyFilters: {
            dateFrom: null,
            dateTo: null,
        },
    },

    auditLog: {
        filters: {
            dateFrom: null,
            dateTo: null,
            cashierKey: null,
            types: ['VoidLine', 'VoidTrx', 'PriceChange'],
        },
        rows: [],
        loading: false,
    },

    topItems: {
        filters: {
            dateFrom: null,
            dateTo: null,
            sortBy: 'revenue',
            limit: 50,
            offset: 0,
        },
        rows: [],
        loading: false,
    },

    hourlySales: {
        filters: {
            dateFrom: null,
            dateTo: null,
        },
        buckets: [],
        loading: false,
    },

    customerParams: {
        loading: false,
        saving: false,
        values: {
            POS_CUSTOMER_IMAGES: { local: null, source: 'ho' },
            POS_CUSTOMER_MESSAGES: { local: null, source: 'ho' },
        },
    },

    cashiers: [],
}

/* --------------------------------------------------------------------- */
/* helpers                                                               */
/* --------------------------------------------------------------------- */

const rejectWithAxios = (thunkAPI, error, { silent = false } = {}) => {
    thunkAPI.dispatch(hideLoading());
    if (error.response) {
        if (error.response.status === 401) {
            if (!silent) thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
            return thunkAPI.rejectWithValue('Un-authorized');
        }
        const msg = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
        if (!silent) thunkAPI.dispatch(notify({ msg: 'error: ' + msg, sev: 'error' }));
        return thunkAPI.rejectWithValue(error.response.data);
    }
    if (!silent) thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
    return thunkAPI.rejectWithValue(error.message);
}

/* --------------------------------------------------------------------- */
/* async actions — original                                              */
/* --------------------------------------------------------------------- */

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
        }).catch((error) => rejectWithAxios(thunkAPI, error));
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
                thunkAPI.dispatch(hideLoading());
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => rejectWithAxios(thunkAPI, error));
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
                thunkAPI.dispatch(hideLoading());
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => rejectWithAxios(thunkAPI, error));
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
                thunkAPI.dispatch(hideLoading());
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => rejectWithAxios(thunkAPI, error));
    }
)

/* --------------------------------------------------------------------- */
/* async actions — admin expansion                                       */
/* --------------------------------------------------------------------- */

export const searchTrx = createAsyncThunk(
    'bo/searchTrx',
    async (payload, thunkAPI) => {
        const filters = {
            ...thunkAPI.getState().backoffice.trxSearch.filters,
            ...(payload || {}),
        };
        return axios({ method: 'post', url: '/bo/searchTrx', data: filters })
            .then((response) => thunkAPI.fulfillWithValue({ filters, data: response.data }))
            .catch((error) => rejectWithAxios(thunkAPI, error));
    }
)

export const fetchTrxDetails = createAsyncThunk(
    'bo/fetchTrxDetails',
    async (trxKey, thunkAPI) => {
        thunkAPI.dispatch(showLoading());
        return axios({ method: 'get', url: '/bo/trxDetails', params: { trxKey } })
            .then((response) => {
                thunkAPI.dispatch(hideLoading());
                return thunkAPI.fulfillWithValue(response.data);
            })
            .catch((error) => rejectWithAxios(thunkAPI, error));
    }
)

export const searchCustomers = createAsyncThunk(
    'bo/searchCustomers',
    async (payload, thunkAPI) => {
        const body = payload || {
            query: thunkAPI.getState().backoffice.customerSearch.query,
            field: thunkAPI.getState().backoffice.customerSearch.field,
        };
        return axios({ method: 'post', url: '/bo/searchCustomers', data: body })
            .then((response) => thunkAPI.fulfillWithValue({ query: body.query, field: body.field, data: response.data }))
            .catch((error) => rejectWithAxios(thunkAPI, error));
    }
)

export const fetchCustomerHistory = createAsyncThunk(
    'bo/fetchCustomerHistory',
    async ({ customerKey, dateFrom, dateTo } = {}, thunkAPI) => {
        const body = {
            customerKey,
            dateFrom,
            dateTo,
            limit: 200,
            offset: 0,
        };
        return axios({ method: 'post', url: '/bo/searchTrx', data: body })
            .then((response) => thunkAPI.fulfillWithValue({ dateFrom, dateTo, data: response.data }))
            .catch((error) => rejectWithAxios(thunkAPI, error));
    }
)

export const forceCloseTill = createAsyncThunk(
    'bo/forceCloseTill',
    async ({ tillKey, password }, thunkAPI) => {
        thunkAPI.dispatch(showLoading());
        return axios({ method: 'post', url: '/bo/forceCloseTill', data: { tillKey, password } })
            .then((response) => {
                thunkAPI.dispatch(hideLoading());
                thunkAPI.dispatch(notify({ msg: 'Till force-closed', sev: 'success' }));
                return thunkAPI.fulfillWithValue(response.data);
            })
            .catch((error) => rejectWithAxios(thunkAPI, error));
    }
)

export const fetchAuditEvents = createAsyncThunk(
    'bo/auditEvents',
    async (payload, thunkAPI) => {
        const filters = {
            ...thunkAPI.getState().backoffice.auditLog.filters,
            ...(payload || {}),
        };
        return axios({ method: 'post', url: '/bo/auditEvents', data: filters })
            .then((response) => thunkAPI.fulfillWithValue({ filters, data: response.data }))
            .catch((error) => rejectWithAxios(thunkAPI, error));
    }
)

export const fetchTopItems = createAsyncThunk(
    'bo/topItems',
    async (payload, thunkAPI) => {
        const filters = {
            ...thunkAPI.getState().backoffice.topItems.filters,
            ...(payload || {}),
        };
        return axios({ method: 'post', url: '/bo/topItems', data: filters })
            .then((response) => thunkAPI.fulfillWithValue({ filters, data: response.data }))
            .catch((error) => rejectWithAxios(thunkAPI, error));
    }
)

export const fetchHourlySales = createAsyncThunk(
    'bo/hourlySales',
    async (payload, thunkAPI) => {
        const filters = {
            ...thunkAPI.getState().backoffice.hourlySales.filters,
            ...(payload || {}),
        };
        return axios({ method: 'post', url: '/bo/hourlySales', data: filters })
            .then((response) => thunkAPI.fulfillWithValue({ filters, data: response.data }))
            .catch((error) => rejectWithAxios(thunkAPI, error));
    }
)

export const fetchCustomerParams = createAsyncThunk(
    'bo/getCustomerParams',
    async (_, thunkAPI) => {
        return axios({ method: 'get', url: '/bo/getCustomerParams' })
            .then((response) => thunkAPI.fulfillWithValue(response.data))
            .catch((error) => rejectWithAxios(thunkAPI, error));
    }
)

export const setCustomerParam = createAsyncThunk(
    'bo/setCustomerParam',
    async ({ name, value }, thunkAPI) => {
        thunkAPI.dispatch(showLoading());
        return axios({ method: 'post', url: '/bo/setCustomerParam', data: { name, value } })
            .then((response) => {
                thunkAPI.dispatch(hideLoading());
                thunkAPI.dispatch(notify({ msg: 'Saved. Customer screens will refresh.', sev: 'success' }));
                return thunkAPI.fulfillWithValue(response.data);
            })
            .catch((error) => rejectWithAxios(thunkAPI, error));
    }
)

export const fetchCashiers = createAsyncThunk(
    'bo/cashiers',
    async (_, thunkAPI) => {
        return axios({ method: 'get', url: '/bo/cashiers' })
            .then((response) => thunkAPI.fulfillWithValue(response.data))
            .catch((error) => rejectWithAxios(thunkAPI, error, { silent: true }));
    }
)

/* --------------------------------------------------------------------- */
/* reducer                                                               */
/* --------------------------------------------------------------------- */

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

        setActiveTab: (state, action) => {
            state.activeTab = action.payload;
        },

        setGlobalSearchQuery: (state, action) => {
            state.globalSearch.query = action.payload || '';
        },

        setTrxFilters: (state, action) => {
            state.trxSearch.filters = { ...state.trxSearch.filters, ...(action.payload || {}) };
        },
        resetTrxSearch: (state) => {
            state.trxSearch = initialState.trxSearch;
        },
        clearTrxSelected: (state) => {
            state.trxSelected = initialState.trxSelected;
        },
        setPrintInvoiceKey: (state, action) => {
            state.printInvoiceKey = action.payload || null;
        },
        clearPrintInvoiceKey: (state) => {
            state.printInvoiceKey = null;
        },

        setCustomerQuery: (state, action) => {
            const { query, field } = action.payload || {};
            if (typeof query === 'string') state.customerSearch.query = query;
            if (typeof field === 'string') state.customerSearch.field = field;
        },
        setCustomerSelected: (state, action) => {
            state.customerSelected.customer = action.payload || null;
            state.customerSelected.history = [];
            state.customerSelected.historyLoading = false;
            state.customerSelected.historyTotal = 0;
        },
        clearCustomerSelected: (state) => {
            state.customerSelected = initialState.customerSelected;
        },
        setCustomerHistoryDates: (state, action) => {
            state.customerSelected.historyFilters = {
                ...state.customerSelected.historyFilters,
                ...(action.payload || {}),
            };
        },

        setAuditFilters: (state, action) => {
            state.auditLog.filters = { ...state.auditLog.filters, ...(action.payload || {}) };
        },
        setTopItemsFilters: (state, action) => {
            state.topItems.filters = { ...state.topItems.filters, ...(action.payload || {}) };
        },
        setHourlySalesFilters: (state, action) => {
            state.hourlySales.filters = { ...state.hourlySales.filters, ...(action.payload || {}) };
        },
    },
    extraReducers: (builder) => {

        /* submitTillCounts thunk */
        builder.addCase(submitTillCounts.fulfilled, (state, action) => {
            state.tills = action.payload.list;
            state.selectedTill = action.payload.till;
        })
        builder.addCase(submitTillCounts.rejected, () => { })

        /* closeTill thunk */
        builder.addCase(closeTill.fulfilled, (state, action) => {
            state.tills = action.payload;
            state.selectedTill = null;
        })
        builder.addCase(closeTill.rejected, () => { })

        /* endDay thunk */
        builder.addCase(endDay.fulfilled, (state, action) => {
            state.workDay = action.payload;
        })
        builder.addCase(endDay.rejected, () => { })

        /* searchTrx */
        builder.addCase(searchTrx.pending, (state) => {
            state.trxSearch.loading = true;
        })
        builder.addCase(searchTrx.fulfilled, (state, action) => {
            state.trxSearch.loading = false;
            state.trxSearch.filters = action.payload.filters;
            state.trxSearch.rows = action.payload.data.rows || [];
            state.trxSearch.totalCount = action.payload.data.totalCount || 0;
            state.trxSearch.lastRunAt = Date.now();
        })
        builder.addCase(searchTrx.rejected, (state) => {
            state.trxSearch.loading = false;
        })

        /* fetchTrxDetails */
        builder.addCase(fetchTrxDetails.pending, (state) => {
            state.trxSelected.loading = true;
        })
        builder.addCase(fetchTrxDetails.fulfilled, (state, action) => {
            state.trxSelected.loading = false;
            state.trxSelected.trx = action.payload;
        })
        builder.addCase(fetchTrxDetails.rejected, (state) => {
            state.trxSelected.loading = false;
        })

        /* searchCustomers */
        builder.addCase(searchCustomers.pending, (state) => {
            state.customerSearch.loading = true;
        })
        builder.addCase(searchCustomers.fulfilled, (state, action) => {
            state.customerSearch.loading = false;
            state.customerSearch.query = action.payload.query;
            state.customerSearch.field = action.payload.field;
            state.customerSearch.rows = action.payload.data.rows || [];
        })
        builder.addCase(searchCustomers.rejected, (state) => {
            state.customerSearch.loading = false;
        })

        /* customer history */
        builder.addCase(fetchCustomerHistory.pending, (state) => {
            state.customerSelected.historyLoading = true;
        })
        builder.addCase(fetchCustomerHistory.fulfilled, (state, action) => {
            state.customerSelected.historyLoading = false;
            state.customerSelected.history = action.payload.data.rows || [];
            state.customerSelected.historyTotal = action.payload.data.totalCount || 0;
            state.customerSelected.historyFilters = {
                dateFrom: action.payload.dateFrom || null,
                dateTo: action.payload.dateTo || null,
            };
        })
        builder.addCase(fetchCustomerHistory.rejected, (state) => {
            state.customerSelected.historyLoading = false;
        })

        /* forceCloseTill */
        builder.addCase(forceCloseTill.fulfilled, (state, action) => {
            state.tills = action.payload;
            state.selectedTill = null;
        })

        /* audit */
        builder.addCase(fetchAuditEvents.pending, (state) => {
            state.auditLog.loading = true;
        })
        builder.addCase(fetchAuditEvents.fulfilled, (state, action) => {
            state.auditLog.loading = false;
            state.auditLog.filters = action.payload.filters;
            state.auditLog.rows = action.payload.data.rows || [];
        })
        builder.addCase(fetchAuditEvents.rejected, (state) => {
            state.auditLog.loading = false;
        })

        /* topItems */
        builder.addCase(fetchTopItems.pending, (state) => {
            state.topItems.loading = true;
        })
        builder.addCase(fetchTopItems.fulfilled, (state, action) => {
            state.topItems.loading = false;
            state.topItems.filters = action.payload.filters;
            state.topItems.rows = action.payload.data.rows || [];
        })
        builder.addCase(fetchTopItems.rejected, (state) => {
            state.topItems.loading = false;
        })

        /* hourly sales */
        builder.addCase(fetchHourlySales.pending, (state) => {
            state.hourlySales.loading = true;
        })
        builder.addCase(fetchHourlySales.fulfilled, (state, action) => {
            state.hourlySales.loading = false;
            state.hourlySales.filters = action.payload.filters;
            state.hourlySales.buckets = action.payload.data.buckets || [];
        })
        builder.addCase(fetchHourlySales.rejected, (state) => {
            state.hourlySales.loading = false;
        })

        /* customer params */
        builder.addCase(fetchCustomerParams.pending, (state) => {
            state.customerParams.loading = true;
        })
        builder.addCase(fetchCustomerParams.fulfilled, (state, action) => {
            state.customerParams.loading = false;
            state.customerParams.values = {
                ...state.customerParams.values,
                ...(action.payload || {}),
            };
        })
        builder.addCase(fetchCustomerParams.rejected, (state) => {
            state.customerParams.loading = false;
        })

        builder.addCase(setCustomerParam.pending, (state) => {
            state.customerParams.saving = true;
        })
        builder.addCase(setCustomerParam.fulfilled, (state, action) => {
            state.customerParams.saving = false;
            const { name, value } = action.payload || {};
            if (name) {
                state.customerParams.values[name] = {
                    local: value,
                    source: value && value.trim().length > 0 ? 'local' : 'ho',
                };
            }
        })
        builder.addCase(setCustomerParam.rejected, (state) => {
            state.customerParams.saving = false;
        })

        /* cashiers */
        builder.addCase(fetchCashiers.fulfilled, (state, action) => {
            state.cashiers = action.payload || [];
        })
    },
})


export const {
    setWorkDay, setTills, setSelectedTill, updateBalance,
    setActiveTab,
    setGlobalSearchQuery,
    setTrxFilters, resetTrxSearch, clearTrxSelected,
    setPrintInvoiceKey, clearPrintInvoiceKey,
    setCustomerQuery, setCustomerSelected, clearCustomerSelected, setCustomerHistoryDates,
    setAuditFilters, setTopItemsFilters, setHourlySalesFilters,
} = authSlice.actions
export default authSlice.reducer
