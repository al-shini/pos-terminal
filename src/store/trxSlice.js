import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { showLoading, hideLoading, notify, showItemScanError, showHardNotification } from './uiSlice'
import { fetchSuspendedForTill, resetCustomer, setCustomer, setManagerMode, setManagerUser, setTrxMode, triggerErrorSound, unlockTill, beginPayment } from './terminalSlice';
import SS_AR from '../components/Terminal/SelfService/i18n';
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
    priceChangeReason: '',
    scrollAction: 'none',
    // refund reference
    originalTrxReference: null,
    // re-entrancy guard for the cashier tapping OK multiple times during
    // /trx/closeTrxPayment (a fast double-tap could otherwise fire two closes /
    // two point deductions). Backend is also idempotent, this is defence in depth.
    closingTrx: false,
    // re-entrancy guard for the cashier tapping OK multiple times while a
    // /trx/submitPayment is in flight (prevents duplicate payment rows, e.g. a
    // doubled cashback/points payment).
    paymentSubmitting: false,
    // [PS fix] Monotonic sequence number for scan requests. Each scanBarcode /
    // scanNewTransaction dispatch increments this counter and tags itself with
    // the resulting value; the .fulfilled reducer ignores any response whose
    // sequence is older than the latest one already applied. Without this,
    // when two scans are fired within ~50ms (very common at Palestine fresh
    // produce / bakery counters) the slower response could overwrite the
    // newer trx state on screen and silently roll the visible total back.
    scanSeq: 0,
    lastAppliedScanSeq: 0
}

/**
 * async actions
 */

export const scanNewTransaction = createAsyncThunk(
    'scanNewTransaction',
    async (payload, thunkAPI) => {
        // [PS fix] Tag this dispatch with a monotonic sequence number so the
        // .fulfilled reducer can drop out-of-order responses (a slow scan
        // response must never overwrite the state produced by a newer one).
        thunkAPI.dispatch(bumpScanSeq());
        const __scanSeq = thunkAPI.getState().trx.scanSeq;

        if (thunkAPI.getState().terminal.paymentMode) {
            console.log('in payment mode');
            return thunkAPI.rejectWithValue('Cannot scan item when in payment mode');
        } else {
            console.log('seems like I am not in payment mode');
        }

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
                    if (response.data && typeof response.data === 'object') {
                        response.data.__scanSeq = __scanSeq;
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
                        thunkAPI.dispatch(notify({ msg: 'error: ' + error.response.data, sev: 'error' }));
                        return thunkAPI.rejectWithValue(error.response.data);
                    }
                } else {

                    thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.message);
                }
            }).finally(() => {
                thunkAPI.dispatch(hideLoading());
            });;
        } else {
            // Add sellTrxKeyRef for refund transactions
            const payloadData = { ...payload };
            const trxState = thunkAPI.getState().trx;
            if (thunkAPI.getState().terminal.trxMode === 'Refund' && trxState.originalTrxReference) {
                payloadData.sellTrxKeyRef = trxState.originalTrxReference.key;
                console.log('scanNewTransaction: Adding sellTrxKeyRef:', payloadData.sellTrxKeyRef);
            } else if (thunkAPI.getState().terminal.trxMode === 'Refund') {
                console.log('scanNewTransaction: Refund mode but no originalTrxReference found');
            }

            // [multiplier fix] See consumeScanMultiplier — the multiplier for
            // this item is already captured in `payload` and is forwarded to the
            // follow-up scanBarcode below, so disarm the shared one now.
            thunkAPI.dispatch(consumeScanMultiplier());

            return axios({
                method: 'post',
                url: '/trx/scanNew',
                data: payloadData
            }).then((response) => {
                if (response && response.data) {
                    // tag the response with the sequence we captured above
                    if (response.data && typeof response.data === 'object') {
                        response.data.__scanSeq = __scanSeq;
                    }

                    // [auto-suspend-on-conflict] Backend silently put a stale
                    // OPEN+customer transaction from an earlier session on
                    // hold instead of hard-blocking this new sale with
                    // "please click on Restart" — let the operator/customer
                    // know it happened and where to find it again.
                    if (response.data.autoSuspendedCount > 0) {
                        thunkAPI.dispatch(notify({
                            msg: config.selfService
                                ? SS_AR.autoSuspendedNotice
                                : 'A previous unfinished order on this till was automatically put on hold — find it in Suspended Orders.',
                            sev: 'warning'
                        }));
                    }

                    // C-* account customers attach without a sale. LC-* is handled
                    // fully by scanNew (creates trx + attaches customer) — do NOT
                    // treat "LC-…" as C- via includes('C-').
                    if (payload.barcode.startsWith('C-') && !payload.barcode.startsWith('LC-')) {
                        thunkAPI.dispatch(setCustomer(response.data.customer))
                    } else if (payload.barcode.startsWith('LC-')) {
                        // Backend already opened the trx and attached the customer.
                        if (response.data.customer) {
                            thunkAPI.dispatch(setCustomer(response.data.customer));
                        }
                    } else {
                        if (!response.data.trx || !response.data.trx.key) {
                            thunkAPI.dispatch(notify({
                                msg: 'Could not open transaction for loyalty card',
                                sev: 'error'
                            }));
                            return thunkAPI.rejectWithValue('No trx after scanNew');
                        }
                        const scanPayload = {
                            customerKey: thunkAPI.getState().terminal.customer ? thunkAPI.getState().terminal.customer.key : null,
                            barcode: payload.barcode,
                            trxKey: response.data.trx.key,
                            trxMode: thunkAPI.getState().terminal.trxMode,
                            tillKey: thunkAPI.getState().terminal.till ? thunkAPI.getState().terminal.till.key : null,
                            multiplier: payload.multiplier ? payload.multiplier : '1'
                        };
                        
                        const currentTrxState = thunkAPI.getState().trx;
                        if (thunkAPI.getState().terminal.trxMode === 'Refund' && currentTrxState.originalTrxReference) {
                            scanPayload.sellTrxKeyRef = currentTrxState.originalTrxReference.key;
                        }
                        
                        thunkAPI.dispatch(scanBarcode(scanPayload));
                    }
                    return thunkAPI.fulfillWithValue(response.data);
                } else {
                    return thunkAPI.rejectWithValue('Incorrect server response');
                }
            }).catch((error) => {
                console.log(error);
                thunkAPI.dispatch(triggerErrorSound());
                if (error.response) {
                    if (error.response.status === 401) {
                        thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                        return thunkAPI.rejectWithValue('Un-authorized');
                    }
                    const raw = error.response.data;
                    const msg = typeof raw === 'string'
                        ? raw
                        : (raw && raw.message) ? raw.message : (typeof raw === 'object' ? JSON.stringify(raw) : String(raw));
                    thunkAPI.dispatch(notify({ msg, sev: 'error' }));
                    thunkAPI.dispatch(showItemScanError(msg));
                    return thunkAPI.rejectWithValue(raw);
                }
                thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
                return thunkAPI.rejectWithValue(error.message);
            }).finally(() => {
                thunkAPI.dispatch(hideLoading());
            });;
        }
    }
)

export const scanBarcode = createAsyncThunk(
    'scanBarcode',
    async (payload, thunkAPI) => {
        // [PS fix] Tag this dispatch with a monotonic sequence number; see
        // scanNewTransaction above.
        thunkAPI.dispatch(bumpScanSeq());
        const __scanSeq = thunkAPI.getState().trx.scanSeq;

        if (thunkAPI.getState().terminal.paymentMode) {
            console.log('in payment mode');
            thunkAPI.dispatch(notify({ msg: 'Cannot scan item when in payment mode ', sev: 'error' }));
            return thunkAPI.rejectWithValue('Cannot scan item when in payment mode');
        } else {
            console.log('seems like I am not in payment mode');
        }

        // 
        if (!payload.trxKey) {
            thunkAPI.dispatch(notify({ msg: 'No valid transaction ', sev: 'error' }));
            return thunkAPI.rejectWithValue('No valid transaction ');
        }

        if (payload.barcode.includes('LC-')) {
            thunkAPI.dispatch(showLoading());
        }

        if (!payload.manualEntry) {
            payload.manualEntry = false;
        }

        // Add sellTrxKeyRef for refund transactions
        const trxState = thunkAPI.getState().trx;
        if (thunkAPI.getState().terminal.trxMode === 'Refund' && trxState.originalTrxReference && !payload.sellTrxKeyRef) {
            payload.sellTrxKeyRef = trxState.originalTrxReference.key;
            console.log('scanBarcode: Adding sellTrxKeyRef:', payload.sellTrxKeyRef);
        } else if (thunkAPI.getState().terminal.trxMode === 'Refund' && !payload.sellTrxKeyRef) {
            console.log('scanBarcode: Refund mode but no originalTrxReference found');
        }

        // [multiplier fix] This scan carries its multiplier in `payload`; disarm
        // the shared one now so the next barcode can't inherit it while we wait
        // for the response. See consumeScanMultiplier.
        thunkAPI.dispatch(consumeScanMultiplier());

        return axios({
            method: 'post',
            url: '/trx/new-scan',
            data: payload
        }).then((response) => {
            if (response && response.data) {
                console.log('response.data', response.data)
                if (response.data && typeof response.data === 'object') {
                    response.data.__scanSeq = __scanSeq;
                }
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
            thunkAPI.dispatch(triggerErrorSound());
            if (error.response) {
                if (error.response.status === 401) {
                    thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                }
                const raw = error.response.data;
                const msg = typeof raw === 'string'
                    ? raw
                    : (raw && raw.message) ? raw.message : (typeof raw === 'object' ? JSON.stringify(raw) : String(raw));
                thunkAPI.dispatch(notify({ msg, sev: 'error' }));
                thunkAPI.dispatch(showItemScanError(msg));
                return thunkAPI.rejectWithValue(raw);
            }
            thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
            return thunkAPI.rejectWithValue(error.message);
        }).finally(() => {
            thunkAPI.dispatch(hideLoading());
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
                    thunkAPI.dispatch(notify({ msg: 'Error: ' + error.response.data, sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {

                thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
                // A network error has no `error.response`. Falling through here
                // used to return undefined, which RTK treats as SUCCESS: the
                // thunk fulfilled with an undefined payload, the fulfilled
                // reducer threw reading it, Immer discarded the whole update —
                // including the "in flight" flag — and every later payment on
                // this terminal was silently refused by the re-entrancy guard.
                return thunkAPI.rejectWithValue(error.message);
            }

        }).finally(() => {
            thunkAPI.dispatch(hideLoading());
        });;
    }
)

export const submitPayment = createAsyncThunk(
    'submitPayment',
    async (payload, thunkAPI) => {
        thunkAPI.dispatch(showLoading());

        // [stuck-mode fix] Used to do `data.amount = data.amount * multiplier`
        // here — `multiplier` is the qty-multiplier armed via the Numpad ×
        // button / self-service qty picker, meant ONLY for "add N of the
        // NEXT scanned item" (see scanBarcode/scanNewTransaction). It has
        // nothing to do with payment amounts, but because it lives in shared
        // trx state and is only reliably cleared by a SUCCESSFUL scan, any
        // dead-end (barcode not found, a network blip, or simply arming ×N
        // and then changing your mind without scanning) left it armed
        // indefinitely — with no cashier-facing "cancel" affordance — and it
        // would silently multiply the amount of whatever payment was
        // submitted next (cash, card, foreign currency, vouchers…), which
        // either overcharges the customer or makes the trx un-closeable
        // (customerchange never reaches >= 0) until a full app restart.
        // Self-service already had to defensively reset the multiplier right
        // before opening its pay modal specifically because of this; cashier
        // mode had no equivalent guard. Payment amounts must never be
        // implicitly multiplied — removed entirely.
        let data = {
            ...payload
        };

        return axios({
            method: 'post',
            url: '/trx/submitPayment',
            data,
            // Without a timeout, a hung request leaves paymentSubmitting=true
            // forever and the OK button stays disabled until an app reload.
            timeout: 30000
        }).then((response) => {
            if (response && response.data) {
                console.log('response.data', response.data)
                thunkAPI.dispatch(clearNumberInput());
                if (response.data.customer) {
                    thunkAPI.dispatch(setCustomer(response.data.customer));
                }
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

                if (error.code === 'ECONNABORTED') {
                    // Timed out: the server may or may not have saved the
                    // payment. Tell the cashier to check the payments list
                    // before retrying instead of blindly resubmitting.
                    thunkAPI.dispatch(notify({
                        msg: 'Server is slow — payment may not be saved. Check the payments list before trying again.',
                        sev: 'warning'
                    }));
                } else {
                    thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
                }
                // A network error has no `error.response`. Falling through here
                // used to return undefined, which RTK treats as SUCCESS: the
                // thunk fulfilled with an undefined payload, the fulfilled
                // reducer threw reading it, Immer discarded the whole update —
                // including the "in flight" flag — and every later payment on
                // this terminal was silently refused by the re-entrancy guard.
                return thunkAPI.rejectWithValue(error.message);
            }

        }).finally(() => {
            thunkAPI.dispatch(hideLoading());
        });
    },
    {
        // Hard-stop re-entrancy: ignore a new submit while one is already in
        // flight so a cashier hammering OK can't create duplicate payment rows
        // (e.g. a doubled points/cashback payment).
        condition: (payload, { getState }) => {
            const state = getState();
            if (state && state.trx && state.trx.paymentSubmitting) {
                return false;
            }
            return true;
        }
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
            },
            // Without a timeout, a hung close leaves closingTrx=true forever
            // and OK stays disabled until an app reload. The backend close is
            // an atomic OPEN->CLOSED claim, so retrying after a timeout is
            // safe: an already-closed trx is returned idempotently.
            timeout: 45000
        }).then((response) => {
            if (response && response.data) {

                thunkAPI.dispatch(notify({ msg: 'Transaction paid, print invoice ☺', sev: 'info' }));

                // [cashback/one-shot] The sale closed, but if earned loyalty
                // points could NOT be granted (Shini Me offline) the backend
                // returns a bilingual warning. Surface it prominently so the
                // cashier can tell the customer + the loyalty team adds the
                // points manually. The sale itself is fine.
                if (response.data.cashbackGrantWarning) {
                    thunkAPI.dispatch(notify({ msg: response.data.cashbackGrantWarning, sev: 'warning' }));
                }

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
                    thunkAPI.dispatch(printTrx(response.data.key));
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

                if (error.code === 'ECONNABORTED') {
                    // Timed out. The close is atomic and idempotent on the
                    // backend, so pressing OK again either finishes the close
                    // or returns the already-closed sale.
                    thunkAPI.dispatch(notify({
                        msg: 'Server is slow — press OK again to finish the sale.',
                        sev: 'warning'
                    }));
                } else {
                    thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
                }
                // See submitPayment: returning undefined here fulfils the thunk
                // and corrupts the reducer, so a network blip must reject.
                return thunkAPI.rejectWithValue(error.message);
            }

        });
    },
    {
        // Hard-stop re-entrancy: if a close is already in flight, ignore the
        // new dispatch. Prevents cashier double-tap/Enter-chord from creating
        // a second CASHBACK_BALANCE_CONSUME row on the backend.
        condition: (payload, { getState }) => {
            const state = getState();
            if (state && state.trx && state.trx.closingTrx) {
                return false;
            }
            return true;
        }
    }
)

export const redeemSpendCampaign = createAsyncThunk(
    'redeemSpendCampaign',
    async (trxKey, thunkAPI) => {
        thunkAPI.dispatch(showLoading());
        return axios({
            method: 'post',
            url: '/trx/campaign/redeem',
            headers: { trxKey }
        }).then((response) => {
            thunkAPI.dispatch(hideLoading());
            if (response && response.data) {
                if (response.data.customer) {
                    thunkAPI.dispatch(setCustomer(response.data.customer));
                }
                const snap = response.data.trx && response.data.trx.campaignSnapshot;
                const ref = snap && snap.voucherRef;
                const amt = snap && snap.reservedDiscount;
                if (ref) {
                    const msg = `تم إصدار قسيمة ${amt != null ? amt : ''} JD\nرقم المرجع: #${ref}\nادفع عبر Camp. Voucher`;
                    thunkAPI.dispatch(notify({ msg: `Campaign voucher #${ref} issued`, sev: 'success' }));
                    thunkAPI.dispatch(showHardNotification(msg));
                } else {
                    thunkAPI.dispatch(notify({ msg: 'Campaign voucher issued', sev: 'success' }));
                }
                // No auto-close — voucher is tendered later via Campaign Voucher.
                return thunkAPI.fulfillWithValue(response.data);
            }
            return thunkAPI.rejectWithValue('Incorrect server response');
        }).catch((error) => {
            thunkAPI.dispatch(hideLoading());
            const msg = error.response?.data || error.message || 'Redeem failed';
            thunkAPI.dispatch(notify({ msg: String(msg), sev: 'error' }));
            return thunkAPI.rejectWithValue(msg);
        });
    }
);

export const cancelSpendCampaignRedeem = createAsyncThunk(
    'cancelSpendCampaignRedeem',
    async (trxKey, thunkAPI) => {
        thunkAPI.dispatch(showLoading());
        return axios({
            method: 'post',
            url: '/trx/campaign/cancel-redeem',
            headers: { trxKey }
        }).then((response) => {
            thunkAPI.dispatch(hideLoading());
            if (response && response.data) {
                thunkAPI.dispatch(notify({ msg: 'Campaign reward cancelled', sev: 'info' }));
                return thunkAPI.fulfillWithValue(response.data);
            }
            return thunkAPI.rejectWithValue('Incorrect server response');
        }).catch((error) => {
            thunkAPI.dispatch(hideLoading());
            const msg = error.response?.data || error.message || 'Cancel failed';
            thunkAPI.dispatch(notify({ msg: String(msg), sev: 'error' }));
            return thunkAPI.rejectWithValue(msg);
        });
    }
);

export const printTrx = createAsyncThunk(
    'printTrx',
    async (payload, thunkAPI) => {
        console.log('trying to print TRX', payload);
        axios({
            method: 'get',
            url: `http://localhost:${config.printServicePort ?
                config.printServicePort :
                config.expressPort ? config.expressPort :
                    '3001'}/printTrx?trxKey=${payload}`,
        }).then((response) => {
            thunkAPI.dispatch(hideLoading());
        }).catch((error) => {
            console.log(error.response, error.message);
            thunkAPI.dispatch(notify({ msg: 'could not print receipt - ' + (error.response ? error.response : error.message), sev: 'error' }));
        });
    }
)

export const printTrxNoDrawer = createAsyncThunk(
    'printTrx',
    async (payload, thunkAPI) => {
        console.log('trying to print TRX', payload);
        axios({
            method: 'get',
            url: `http://localhost:${config.printServicePort ?
                config.printServicePort :
                config.expressPort ? config.expressPort :
                    '3001'}/printTrxNoDrawer?trxKey=${payload}`,
        }).then((response) => {
            thunkAPI.dispatch(hideLoading());
        }).catch((error) => {
            console.log(error.response, error.message);
            thunkAPI.dispatch(notify({ msg: 'could not print receipt - ' + (error.response ? error.response : error.message), sev: 'error' }));
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
                // See submitPayment: returning undefined here fulfils the thunk
                // and corrupts the reducer, so a network blip must reject.
                return thunkAPI.rejectWithValue(error.message);
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
                // See submitPayment: returning undefined here fulfils the thunk
                // and corrupts the reducer, so a network blip must reject.
                return thunkAPI.rejectWithValue(error.message);
            }

        });
    }
)

export const fullTrxTaxExempt = createAsyncThunk(
    'fullTrxTaxExempt',
    async (payload, thunkAPI) => {

        return axios({
            method: 'post',
            url: '/trx/fullTrxTaxExempt',
            headers: {
                trxKey: thunkAPI.getState().trx.trx.key
            }
        }).then((response) => {
            if (response && response.data) {
                thunkAPI.dispatch(notify({ msg: 'TRX tax exempted', sev: 'info' }));
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
                // See submitPayment: returning undefined here fulfils the thunk
                // and corrupts the reducer, so a network blip must reject.
                return thunkAPI.rejectWithValue(error.message);
            }

        });
    }
)


/**
 * Khairgate Wallet tender (deferred capture): amount was entered on the
 * numpad, then the cashier scanned the CUSTOMER's wallet QR. The backend
 * resolves the QR, checks the balance and RESERVES the tender — no money
 * moves here. The actual wallet debit runs inside closeTrxPayment, as the
 * last step before the invoice is closed, so an abandoned or aborted sale
 * never takes the customer's money. Shares the submitPayment reducers, so
 * the payments list and paid/change figures refresh like any other tender.
 */
export const submitKhairgatePayment = createAsyncThunk(
    'submitKhairgatePayment',
    async (payload, thunkAPI) => {
        thunkAPI.dispatch(showLoading());
        return axios({
            method: 'post',
            url: '/trx/khairgatePay',
            data: payload,
            // The backend round-trip includes the provider QR/balance calls;
            // give it more room than a local submit, but never hang the till.
            timeout: 45000
        }).then((response) => {
            if (response && response.data) {
                thunkAPI.dispatch(clearNumberInput());
                return thunkAPI.fulfillWithValue(response.data);
            }
            return thunkAPI.rejectWithValue('Incorrect server response');
        }).catch((error) => {
            if (error.response) {
                if (error.response.status === 401) {
                    thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                }
                // 503 = provider unreachable or khairgate not configured on
                // this store — warnings, not errors (nothing was charged).
                const sev = error.response.status === 503 ? 'warning' : 'error';
                thunkAPI.dispatch(notify({ msg: error.response.data, sev }));
                return thunkAPI.rejectWithValue(error.response.data);
            }
            if (error.code === 'ECONNABORTED') {
                thunkAPI.dispatch(notify({
                    msg: 'Khairgate is slow — nothing was charged (the wallet is only debited at invoice close). Scan again.',
                    sev: 'warning'
                }));
            } else {
                thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
            }
            return thunkAPI.rejectWithValue(error.message);
        }).finally(() => {
            thunkAPI.dispatch(hideLoading());
        });
    },
    {
        condition: (payload, { getState }) => {
            const state = getState();
            if (state && state.trx && state.trx.paymentSubmitting) {
                return false;
            }
            return true;
        }
    }
)

export const voidPayment = createAsyncThunk(
    'voidPayment',
    async (payload, thunkAPI) => {

        // payload is the payment key (string), or — for Khairgate Wallet rows,
        // whose charge already settled at the provider — an object
        // { key, walletRefundConfirmed: true } sent after the cashier confirms
        // the amount was refunded from the Khairgate merchant app. The backend
        // refuses the void without that header (409).
        const isObject = payload && typeof payload === 'object';
        const data = {
            trxKey: thunkAPI.getState().trx.trx.key,
            lineKey: isObject ? payload.key : payload
        };
        return axios({
            method: 'post',
            url: '/trx/voidPayment',
            headers: (isObject && payload.walletRefundConfirmed)
                ? { 'X-Wallet-Refund-Confirmed': 'true' }
                : undefined,
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
                // See submitPayment: returning undefined here fulfils the thunk
                // and corrupts the reducer, so a network blip must reject.
                return thunkAPI.rejectWithValue(error.message);
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
                // See submitPayment: returning undefined here fulfils the thunk
                // and corrupts the reducer, so a network blip must reject.
                return thunkAPI.rejectWithValue(error.message);
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
                // See submitPayment: returning undefined here fulfils the thunk
                // and corrupts the reducer, so a network blip must reject.
                return thunkAPI.rejectWithValue(error.message);
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
                            // CHARGED Khairgate rows ('KHAIRGATE-<txn>' — money
                            // really moved) need the refund-confirmed header;
                            // the cashier already answered the external-refund
                            // dialog before this QR was generated. PENDING rows
                            // ('KHAIRGATE-PENDING-…') were never charged and
                            // void like any other tender.
                            const paymentsList = thunkAPI.getState().trx.payments || [];
                            const target = paymentsList.find((p) => p && p.key === response.data.sourceKey);
                            if (target && target.paymentMethodKey === config.khairgateWallet
                                && target.sourceKey && target.sourceKey.startsWith('KHAIRGATE-')
                                && !target.sourceKey.startsWith('KHAIRGATE-PENDING-')) {
                                thunkAPI.dispatch(voidPayment({
                                    key: response.data.sourceKey,
                                    walletRefundConfirmed: true
                                }));
                            } else {
                                thunkAPI.dispatch(voidPayment(response.data.sourceKey));
                            }
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
                        case 'TalabatRefund': {
                            // Manager authorized Talabat as the refund tender.
                            const st = thunkAPI.getState();
                            const trx = st.trx.trx;
                            if (!trx || !trx.key) {
                                thunkAPI.dispatch(holdQrAuthCheck());
                                break;
                            }
                            const amount = payload.pendingAmount != null
                                ? payload.pendingAmount
                                : (trx.totalafterdiscount || 0);
                            thunkAPI.dispatch(submitPayment({
                                tillKey: st.terminal.till ? st.terminal.till.key : null,
                                trxKey: trx.key,
                                paymentMethodKey: 'Talabat',
                                currency: config.systemCurrency,
                                amount,
                                sourceKey: '',
                                visaPayment: null
                            }));
                            thunkAPI.dispatch(holdQrAuthCheck());
                            break;
                        }
                        case 'UnlockTill': {
                            thunkAPI.dispatch(unlockTill());
                            thunkAPI.dispatch(holdQrAuthCheck());
                            break;
                        }
                        case 'QTY-Multiplier': {
                            // Value was typed before the QR was shown — prefer
                            // the stashed pendingMultiplier so a cleared numpad
                            // during the wait cannot arm a bogus qty.
                            const pending = payload.pendingMultiplier;
                            if (pending != null && String(pending).trim() !== '') {
                                thunkAPI.dispatch(prepareScanMultiplierPreDefined(String(pending)));
                            } else {
                                thunkAPI.dispatch(prepareScanMultiplier());
                            }
                            thunkAPI.dispatch(holdQrAuthCheck());
                            break;
                        }
                        case 'Full-Tax-Discount': {
                            thunkAPI.dispatch(fullTrxTaxExempt());
                            thunkAPI.dispatch(holdQrAuthCheck());
                            break;
                        }
                        // [self-service Visa] No card-terminal integration yet — the
                        // supervisor/head cashier scans this QR (same role check as
                        // VoidTRX/PriceChange/etc. in auth/validateQR) to authorize
                        // the manual Visa charge they take on their own terminal.
                        // Once scanned we submit the payment ourselves and close the
                        // sale, exactly like the CashDro cash flow does.
                        case 'SelfServiceVisa': {
                            const state = thunkAPI.getState();
                            const trx = state.trx.trx;
                            const totalDue = trx ? (trx.totalafterdiscount || 0) : 0;
                            // See handleSelfServiceVisaPayment: the sale's own
                            // paidamt is authoritative, the trxPaid cache is not.
                            const totalPaid = trx ? (trx.paidamt || 0) : 0;
                            const remaining = Math.max(0, totalDue - totalPaid);
                            const tillKey = state.terminal.till ? state.terminal.till.key : null;
                            const trxKeyForClose = trx ? trx.key : null;

                            // Self-service is single-tender, so the card always
                            // settles the whole balance. Read from the live trx
                            // rather than the amount captured when the QR was
                            // generated, in case the total moved since (e.g. a
                            // void ran concurrently).
                            const chargeAmount = remaining;

                            if (trx && remaining > 0) {
                                thunkAPI.dispatch(submitPayment({
                                    tillKey,
                                    trxKey: trxKeyForClose,
                                    // Same payment_method.key the cashier-mode Visa
                                    // button uses (config.visa, a GUID synced from
                                    // head office) — NOT the literal string "Visa" —
                                    // so reports/receipts resolve a real description.
                                    paymentMethodKey: config.visa,
                                    currency: config.systemCurrency,
                                    amount: chargeAmount,
                                    sourceKey: 'MANUAL-VISA-' + (response.data.updatedBy || payload.qrAuthKey),
                                    visaPayment: null
                                })).then((result) => {
                                    const paidTrx = result && result.payload && result.payload.trx;
                                    const fullyPaid = result && result.meta && result.meta.requestStatus === 'fulfilled'
                                        && paidTrx && paidTrx.customerchange != null && paidTrx.customerchange >= 0;

                                    if (fullyPaid && trxKeyForClose) {
                                        thunkAPI.dispatch(closeTrxPayment({ key: trxKeyForClose }));
                                    } else {
                                        // The supervisor already charged the card
                                        // for the full balance on their terminal, so
                                        // neither a rejected submit nor a sale that
                                        // is still short may send the customer back
                                        // to the cart to pay a second time.
                                        const stillDue = paidTrx
                                            ? Math.max(0, (paidTrx.totalafterdiscount || 0) - (paidTrx.paidamt || 0))
                                            : null;
                                        thunkAPI.dispatch(notify({
                                            msg: SS_AR.visaChargedNotSettled
                                                + (stillDue != null ? ' — ' + SS_AR.remainingToPay + ': ' + stillDue.toFixed(2) : ''),
                                            sev: 'error'
                                        }));
                                    }
                                });
                            }
                            thunkAPI.dispatch(holdQrAuthCheck());
                            break;
                        }
                    }
                } else {
                    // [QR robustness] Poll faster (was 1500ms) so an
                    // employee's scan registers on-screen sooner — a scan
                    // that actually succeeded server-side but is still
                    // sitting in this gap can look like "nothing happened",
                    // prompting an unnecessary second scan.
                    if (thunkAPI.getState().trx.qrAuthState === 'pending') {
                        window.setTimeout(() => {
                            thunkAPI.dispatch(checkOperationQrAuth(payload));
                        }, 700);
                    }
                }
                return thunkAPI.fulfillWithValue(response.data);
            } else {
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            const isAuthError = error.response && error.response.status === 401;

            // [QR robustness] A single transient network/5xx blip here used
            // to permanently kill the poll loop (no reschedule at all on
            // error) while the QR screen kept showing "waiting for scan" —
            // so a scan that succeeded moments later would never be
            // noticed, and the only way out was to cancel and re-scan a
            // freshly generated QR. Keep polling as long as we're still
            // meant to be (qrAuthState === 'pending'), same as the
            // non-'Scanned' branch above — but not on a real auth failure,
            // since retrying that forever would just spam 401s.
            if (!isAuthError && thunkAPI.getState().trx.qrAuthState === 'pending') {
                window.setTimeout(() => {
                    thunkAPI.dispatch(checkOperationQrAuth(payload));
                }, 700);
            }

            if (error.response) {
                if (isAuthError) {
                    thunkAPI.dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                }
                else {
                    console.warn('checkQRState poll error (will retry):', error.response.data);
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {
                console.warn('checkQRState poll error (will retry):', error.message);
                return thunkAPI.rejectWithValue(error.message);
            }

        });
    }
)

export const validateRefundReference = createAsyncThunk(
    'validateRefundReference',
    async (payload, thunkAPI) => {
        return axios({
            method: 'post',
            url: '/trx/validateRefundReference',
            data: {
                serialNumber: payload.serialNumber,
                tillKey: thunkAPI.getState().terminal.till ? thunkAPI.getState().terminal.till.key : null
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
                    thunkAPI.dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                } else {
                    thunkAPI.dispatch(notify({ msg: error.response.data.message || 'Validation failed', sev: 'error' }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {
                thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
                return thunkAPI.rejectWithValue(error.message);
            }
        });
    }
)

export const setCustomCustomerName = createAsyncThunk(
    'setCustomCustomerName',
    async (payload, thunkAPI) => {
        return axios({
            method: 'post',
            url: '/trx/setCustomCustomerName',
            data: {
                trxKey: payload.trxKey,
                customerName: payload.customerName
            }
        }).then((response) => {
            if (response && response.data) {
                thunkAPI.dispatch(notify({ 
                    msg: 'Customer name updated successfully', 
                    sev: 'success' 
                }));
                return thunkAPI.fulfillWithValue(response.data);
            } else {
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            if (error.response) {
                if (error.response.status === 401) {
                    thunkAPI.dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                } else {
                    thunkAPI.dispatch(notify({ 
                        msg: error.response.data.message || 'Failed to update customer name', 
                        sev: 'error' 
                    }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {
                thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
                return thunkAPI.rejectWithValue(error.message);
            }
        });
    }
)

export const setCustomCustomerMobile = createAsyncThunk(
    'setCustomCustomerMobile',
    async (payload, thunkAPI) => {
        return axios({
            method: 'post',
            url: '/trx/setCustomCustomerMobile',
            data: {
                trxKey: payload.trxKey,
                customerMobile: payload.customerMobile
            }
        }).then((response) => {
            if (response && response.data) {
                thunkAPI.dispatch(notify({
                    msg: 'Customer mobile updated successfully',
                    sev: 'success'
                }));
                return thunkAPI.fulfillWithValue(response.data);
            } else {
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            if (error.response) {
                if (error.response.status === 401) {
                    thunkAPI.dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                } else {
                    thunkAPI.dispatch(notify({
                        msg: error.response.data.error || error.response.data.message || 'Failed to update customer mobile',
                        sev: 'error'
                    }));
                    return thunkAPI.rejectWithValue(error.response.data);
                }
            } else {
                thunkAPI.dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
                return thunkAPI.rejectWithValue(error.message);
            }
        });
    }
)

export const setReferenceNumber = createAsyncThunk(
    'setReferenceNumber',
    async (payload, thunkAPI) => {
        return axios({
            method: 'post',
            url: '/trx/setReferenceNumber',
            data: {
                trxKey: payload.trxKey,
                referenceNumber: payload.referenceNumber
            }
        }).then((response) => {
            if (response && response.data) {
                thunkAPI.dispatch(notify({
                    msg: 'Reference number updated successfully',
                    sev: 'success'
                }));
                return thunkAPI.fulfillWithValue(response.data);
            } else {
                return thunkAPI.rejectWithValue('Incorrect server response');
            }
        }).catch((error) => {
            if (error.response) {
                if (error.response.status === 401) {
                    thunkAPI.dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }));
                    return thunkAPI.rejectWithValue('Un-authorized');
                } else {
                    thunkAPI.dispatch(notify({
                        msg: error.response.data.error || error.response.data.message || 'Failed to update reference number',
                        sev: 'error'
                    }));
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
            // Preserve campaignSnapshot when a backend response omits it
            // (e.g. abortPayment) so the progress widget stays visible.
            const prevSnap = state.trx && state.trx.campaignSnapshot;
            state.trx = action.payload;
            if (action.payload && prevSnap && !action.payload.campaignSnapshot) {
                state.trx.campaignSnapshot = prevSnap;
            }
            // trxPaid/trxChange are a cache of the trx's own paidamt and
            // customerchange. Callers only ever pass an authoritative trx
            // straight from the server, so re-sync them here: leaving a stale
            // paid figure behind after the server voided the payments makes the
            // UI believe part of the sale is already covered.
            if (action.payload) {
                state.trxPaid = action.payload.paidamt || 0;
                state.trxChange = action.payload.customerchange != null
                    ? action.payload.customerchange
                    : 0;
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
            state.numberInputValue = '';
            state.multiplier = '1';
        },
        clearPriceChangeReason: (state) => {
            state.priceChangeReason = ''
        },
        prepareScanMultiplier: (state) => {
            // Piece-item qty override must be >= 1. Fractional values (0.1×)
            // were used to abuse per-unit discounts on milk gallons etc.
            // Scale/weight barcodes still send their own qty and do not use this.
            const numValue = parseFloat(state.numberInputValue);
            if (!state.numberInputValue || isNaN(numValue) || numValue < 1) {
                state.multiplier = '1';
            } else {
                state.multiplier = state.numberInputValue;
            }
            state.numberInputValue = '';
        },
        prepareScanMultiplierPreDefined: (state, action) => {
            if (action.payload) {
                const numValue = parseFloat(action.payload);
                if (isNaN(numValue) || numValue < 1) {
                    state.multiplier = '1';
                } else {
                    state.multiplier = String(action.payload);
                }
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
                    // legacy numeric vouchers (14 digits) or scanned Shini Me
                    // loyalty codes like VCH-1750843200123-4821 (longer)
                    if (state.numberInputValue.length < 30) { state.numberInputValue = state.numberInputValue + input; }
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
                    // legacy numeric vouchers or scanned Shini Me loyalty codes
                    state.numberInputValue = (input + '').slice(0, 30);
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
        setPriceChangeReason: (state, action) => {
            state.priceChangeReason = action.payload
        },
        scrollUp: (state) => {
            state.scrollAction = 'up';
        },
        scrollDown: (state) => {
            state.scrollAction = 'down';
        },
        scrollBottom: (state) => {
            state.scrollAction = 'bottom';
        },
        resetScrollAction: (state) => {
            state.scrollAction = 'none'
        },
        setOriginalTrxReference: (state, action) => {
            state.originalTrxReference = action.payload;
        },
        clearOriginalTrxReference: (state) => {
            state.originalTrxReference = null;
        },
        // [PS fix] Increment the monotonic scan sequence; called at the very
        // start of every scanBarcode / scanNewTransaction dispatch.
        bumpScanSeq: (state) => {
            state.scanSeq = (state.scanSeq || 0) + 1;
        },
        // [multiplier fix] Disarm the ×N multiplier the moment a scan request
        // leaves the terminal, instead of waiting for its response.
        //
        // The multiplier is meant for "add N of the NEXT scanned item", but it
        // was only reset in scanBarcode/scanNewTransaction .fulfilled — i.e.
        // after the round-trip. A scan takes hundreds of milliseconds, so a
        // cashier scanning two items in quick succession had the second (and
        // third…) barcode leave with the multiplier still armed, and every one
        // of them landed at qty N. Clearing at dispatch closes that window:
        // the value the first scan carries is already in its own payload.
        consumeScanMultiplier: (state) => {
            state.multiplier = '1';
        }
    },
    extraReducers: (builder) => {

        // [stuck-mode fix] The instant payment mode is entered — from ANY
        // call site (cashier Numpad payment-method buttons, CashDro,
        // self-service Cash/Visa/Employee, etc.) — force-cancel price-change
        // mode too. Entering a tender screen while priceChangeMode is still
        // true left the Numpad OK button permanently routed to changePrice()
        // (see Numpad.js's `else if (trxSlice.priceChangeMode)` branch,
        // which is only reachable when NOT in paymentMode — but the state
        // itself lingering was still confusing/wrong) and is simply never a
        // valid combination: you cannot be both changing a line's price and
        // taking a payment at the same time. Belt-and-suspenders alongside
        // the Change-Price button's own always-clickable Cancel fix.
        builder.addCase(beginPayment, (state) => {
            state.priceChangeMode = false;
        })

        /* checkOperationQrAuth thunk */
        builder.addCase(checkOperationQrAuth.fulfilled, (state, action) => {

        })

        builder.addCase(checkOperationQrAuth.rejected, (state, action) => {

        })


        /* scanNewTransaction thunk */
        builder.addCase(scanNewTransaction.fulfilled, (state, action) => {
            if (!action.payload) { return; }
            // [PS fix] Drop stale (out-of-order) responses. If a slower
            // response arrives after a newer scan has already been applied,
            // ignore it — otherwise the visible total would silently roll
            // back to whatever the older scan saw.
            const seq = action.payload && action.payload.__scanSeq;
            if (seq != null && seq < (state.lastAppliedScanSeq || 0)) {
                console.warn('[scan] dropping stale response', seq, 'last applied', state.lastAppliedScanSeq);
                return;
            }
            if (seq != null) state.lastAppliedScanSeq = seq;

            console.log(action);
            // [stale-paid fix] A new sale must start from a clean payment
            // slate. trxPaid/trxChange/payments are a cache of the PREVIOUS
            // transaction until something resets them, and the resets all live
            // on the normal close paths — so a sale that ended badly (a card
            // attempt parked for staff, an aborted CashDro run) carried its
            // paid amount into the next customer's basket. Anything that then
            // charged "the remaining balance" (totalafterdiscount - trxPaid)
            // undercharged by exactly the leftover, and the sale could never
            // settle. Reset on key change, never on a refresh of the same sale.
            const incomingKey = action.payload.trx ? action.payload.trx.key : null;
            const currentKey = state.trx ? state.trx.key : null;
            if (incomingKey && incomingKey !== currentKey) {
                state.trxPaid = 0;
                state.trxChange = 0;
                state.payments = [];
                state.selectedPayment = {};
            }
            state.trx = action.payload.trx;
            state.scannedItems = action.payload.trxLines;
            state.numberInputValue = '';
            state.multiplier = '1'
        })

        builder.addCase(scanNewTransaction.rejected, (state, action) => {
            // [stuck-mode fix] A failed scan (barcode not found, network
            // blip, backend validation error…) used to leave an armed ×N
            // multiplier sitting there with no on-screen way to clear it
            // besides the obscure "type nothing, hit backspace" trick — and
            // it would then silently apply to whatever gets scanned/paid
            // next. Always drop back to ×1 on failure; the cashier can
            // re-arm it in one tap if they still want it.
            state.multiplier = '1';
        })


        /* scan thunk */
        builder.addCase(scanBarcode.fulfilled, (state, action) => {
            if (!action.payload) { return; }
            // [PS fix] same out-of-order guard as scanNewTransaction.
            const seq = action.payload && action.payload.__scanSeq;
            if (seq != null && seq < (state.lastAppliedScanSeq || 0)) {
                console.warn('[scan] dropping stale response', seq, 'last applied', state.lastAppliedScanSeq);
                return;
            }
            if (seq != null) state.lastAppliedScanSeq = seq;

            // [PS fix / loyalty-card] Was gated on `action.payload.line`, which
            // is only set when a promo re-apply pass touched a line. Scanning
            // an LC- loyalty card onto a basket where no promo needed
            // re-applying (or a 00970/00972 mobile-number lookup) still
            // recomputes cashback/totals server-side via updateTrx() and sets
            // `trx`/`trxLines` on the response — but with the old `line`-only
            // gate the screen kept showing the pre-attach total until the next
            // item scan. A bare `C-` account-customer attach deliberately does
            // NOT set `trx` (see PosSellTrxService#onScanBarcode), so gating on
            // `trx` presence (not `line`) fixes the stale-total bug without
            // touching that path — `setCustomer` below is unaffected either way.
            if (action.payload.trx) {
                state.trx = action.payload.trx;
                if (action.payload.trxLines) {
                    state.scannedItems = action.payload.trxLines;
                }
                state.numberInputValue = '';
                state.multiplier = '1'
            }
        })

        builder.addCase(scanBarcode.rejected, (state, action) => {
            // See scanNewTransaction.rejected above for why.
            state.multiplier = '1';
        })

        builder.addCase(redeemSpendCampaign.fulfilled, (state, action) => {
            if (!action.payload) { return; }
            if (action.payload.trx) {
                state.trx = action.payload.trx;
                if (action.payload.trxLines) {
                    state.scannedItems = action.payload.trxLines;
                }
            }
        })

        builder.addCase(cancelSpendCampaignRedeem.fulfilled, (state, action) => {
            if (!action.payload) { return; }
            if (action.payload.trx) {
                state.trx = action.payload.trx;
                if (action.payload.trxLines) {
                    state.scannedItems = action.payload.trxLines;
                }
            }
        })


        /* rescanTrx thunk */
        builder.addCase(rescanTrx.fulfilled, (state, action) => {
            if (!action.payload) { return; }
            if (action.payload.line) {
                state.trx = action.payload.trx;
                state.scannedItems = action.payload.trxLines;
                state.numberInputValue = '';
                state.multiplier = '1'
            }
        })

        builder.addCase(rescanTrx.rejected, (state, action) => {

        })

        /* fullTrxTaxExempt thunk */
        builder.addCase(fullTrxTaxExempt.fulfilled, (state, action) => {
            state.trx = action.payload;
        })

        builder.addCase(fullTrxTaxExempt.rejected, (state, action) => {

        })

        /* submitPayment thunk */
        builder.addCase(submitPayment.pending, (state, action) => {
            state.paymentSubmitting = true;
        })
        builder.addCase(submitPayment.fulfilled, (state, action) => {
            // Cleared before anything else can throw. If this reducer bails
            // part-way, Immer discards the whole draft and the flag would stay
            // set, permanently blocking payments through the re-entrancy guard.
            state.paymentSubmitting = false;
            if (!action.payload) {
                return;
            }
            if (action.payload.payments) {
                state.payments = action.payload.payments;
                state.trxPaid = action.payload.totalPaid;
                state.trxChange = action.payload.change;
                state.trx = action.payload.trx;
            }
            // A loyalty item coupon (DSC-/BDL-) changes LINE prices instead of
            // adding a payment — refresh the invoice lines to show the new
            // per-item prices and discount badges.
            if (action.payload.trxLines) {
                state.scannedItems = action.payload.trxLines;
                if (action.payload.trx) {
                    state.trx = action.payload.trx;
                }
            }
        })

        builder.addCase(submitPayment.rejected, (state, action) => {
            state.paymentSubmitting = false;
        })

        /* submitKhairgatePayment thunk — same contract as submitPayment:
           the backend returns the full TrxPaymentResponse after recording
           the wallet tender. */
        builder.addCase(submitKhairgatePayment.pending, (state, action) => {
            state.paymentSubmitting = true;
        })
        builder.addCase(submitKhairgatePayment.fulfilled, (state, action) => {
            state.paymentSubmitting = false;
            if (!action.payload) {
                return;
            }
            if (action.payload.payments) {
                state.payments = action.payload.payments;
                state.trxPaid = action.payload.totalPaid;
                state.trxChange = action.payload.change;
                state.trx = action.payload.trx;
            }
        })
        builder.addCase(submitKhairgatePayment.rejected, (state, action) => {
            state.paymentSubmitting = false;
        })

        /* closeTrxPayment thunk */
        builder.addCase(closeTrxPayment.pending, (state, action) => {
            state.closingTrx = true;
        })
        builder.addCase(closeTrxPayment.fulfilled, (state, action) => {
            state.closingTrx = false;
            // Only a real server response means the sale actually closed.
            // Wiping the basket on an empty payload would show the customer a
            // receipt screen for a sale still sitting OPEN on the backend.
            if (!action.payload) {
                return;
            }
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
            state.originalTrxReference = null;
            state.closingTrx = false;
        })

        builder.addCase(closeTrxPayment.rejected, (state, action) => {
            state.closingTrx = false;
        })

        /* voidPayment thunk */
        builder.addCase(voidPayment.fulfilled, (state, action) => {
            if (action.payload && action.payload.payments) {
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
            if (!action.payload) { return; }
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
            state.originalTrxReference = null;
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
            state.originalTrxReference = null;
        })

        builder.addCase(suspendTrx.rejected, (state, action) => {

        })

        /* changePrice thunk */
        builder.addCase(changePrice.fulfilled, (state, action) => {
            if (!action.payload) { return; }
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

        /* validateRefundReference thunk */
        builder.addCase(validateRefundReference.fulfilled, (state, action) => {
            if (!action.payload) { return; }
            // Store original sale + whether it had a Talabat tender (enables Talabat refund).
            const orig = action.payload.originalTransaction || null;
            state.originalTrxReference = orig
                ? { ...orig, hasTalabatPayment: !!action.payload.hasTalabatPayment }
                : null;
        })

        builder.addCase(validateRefundReference.rejected, (state, action) => {
            // Clear any existing reference on validation failure
            state.originalTrxReference = null;
        })

        /* setCustomCustomerName thunk */
        builder.addCase(setCustomCustomerName.fulfilled, (state, action) => {
            // Update the transaction with the custom customer name
            if (state.trx && action.payload) {
                state.trx.customCustomerName = action.payload.customCustomerName;
            }
        })

        builder.addCase(setCustomCustomerName.rejected, (state, action) => {
            // Handle error case if needed
        })

        /* setCustomCustomerMobile thunk */
        builder.addCase(setCustomCustomerMobile.fulfilled, (state, action) => {
            if (state.trx && action.payload) {
                state.trx.customCustomerMobile = action.payload.customCustomerMobile;
            }
        })
        builder.addCase(setCustomCustomerMobile.rejected, (state, action) => {
            // Handle error case if needed
        })

        /* setReferenceNumber thunk */
        builder.addCase(setReferenceNumber.fulfilled, (state, action) => {
            if (state.trx && action.payload) {
                state.trx.referenceNumber = action.payload.referenceNumber;
            }
        })
        builder.addCase(setReferenceNumber.rejected, (state, action) => {
            // Handle error case if needed
        })

    },
})



export const { resumeTrx, selectLine, clearNumberInput, handleNumberInputChange, selectPayment, uploadPayments, setTrx, enablePriceChange, disablePriceChange, scroll,
    prepareScanMultiplier, handleNumberInputEntry, reverseNumberInputEntry, selectPaymentMethod, selectCurrency, holdQrAuthCheck, startQrAuthCheck, clearLastPaymentHistory,
    setPriceChangeReason, clearPriceChangeReason, scrollDown, scrollUp, resetScrollAction, prepareScanMultiplierPreDefined, scrollBottom,
    setOriginalTrxReference, clearOriginalTrxReference,
    bumpScanSeq, consumeScanMultiplier
} = trxSlice.actions
export default trxSlice.reducer
