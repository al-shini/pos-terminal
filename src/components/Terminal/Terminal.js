import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux'
import axios from '../../axios';
import { Button, Input, FlexboxGrid, Panel, Divider, Whisper, Popover } from 'rsuite';
import classes from './Terminal.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSackDollar, faBroom, faMoneyBillTransfer, faRepeat, faUser, faArrowLeft,
    faAddressCard, faCarrot, faToolbox, faShieldHalved, faMoneyBill, faIdCard, faTimes, faBullhorn, faEraser, faBan, faPause, faPlay, faRotateLeft, faDollarSign, faLock, faUnlock, faIls
} from '@fortawesome/free-solid-svg-icons'
import Numpad from './Numpad';
import Invoice from './Invoice';
import Payments from './Payments';
import BalanceSetup from './BalanceSetup';
import {
    beginPayment, uploadCurrencies, abort, logout, exitNumpadEntry, reset,
    uploadCashButtons, setPaymentType, uploadForeignButtons, uploadPaymentMethods, uploadFastItems, setTrxMode, lockTill, unlockTill, uploadExchangeRates, setCustomer
} from '../../store/terminalSlice';
import {
    selectCurrency, submitPayment, clearNumberInput, scanBarcode, scanNewTransaction, setTrx,
    selectPaymentMethod, suspendTrx, enablePriceChange, disablePriceChange,
    checkOperationQrAuth, startQrAuthCheck, holdQrAuthCheck
} from '../../store/trxSlice';
import { notify, hideLoading, showLoading } from '../../store/uiSlice';
import FlexboxGridItem from 'rsuite/esm/FlexboxGrid/FlexboxGridItem';
import Alert from "@mui/material/Alert";
import confirm from '../UI/ConfirmDlg';
import config from '../../config';
import errorBeep from '../../assets/beep.wav';
import QRCode from "react-qr-code";
import useSound from 'use-sound';
/* notes images */
import NIS_05 from '../../assets/money-notes/0.5NIS.png';
import NIS_1 from '../../assets/money-notes/1.0NIS.png';
import NIS_2 from '../../assets/money-notes/2.0NIS.png';
import NIS_5 from '../../assets/money-notes/5.0NIS.png';
import NIS_10 from '../../assets/money-notes/10.0NIS.png';
import NIS_20 from '../../assets/money-notes/20.0NIS.png';
import NIS_50 from '../../assets/money-notes/50.0NIS.png';
import NIS_100 from '../../assets/money-notes/100.0NIS.png';
import NIS_200 from '../../assets/money-notes/200.0NIS.png';
import EUR_1 from '../../assets/money-notes/1.0EUR.png';
import JOD_1 from '../../assets/money-notes/1.0JOD.png';
import JOD_10 from '../../assets/money-notes/10.0JOD.png';
import JOD_20 from '../../assets/money-notes/20.0JOD.png';
import JOD_50 from '../../assets/money-notes/50.0JOD.png';
import EUR_10 from '../../assets/money-notes/10.0EUR.png';
import USD_1 from '../../assets/money-notes/1.0USD.png';
import USD_20 from '../../assets/money-notes/20.0USD.png';
import USD_50 from '../../assets/money-notes/50.0USD.png';
import USD_100 from '../../assets/money-notes/100.0USD.png';



const Terminal = (props) => {
    const terminal = useSelector((state) => state.terminal);
    const trxSlice = useSelector((state) => state.trx);
    const uiSlice = useSelector((state) => state.ui);

    const [actionsMode, setActionsMode] = useState('payment');
    const [notesImages, setNotesImages] = useState([]);
    const [authQR, setAuthQR] = useState({});
    const [play] = useSound(errorBeep);

    const [groupedFastItems, setGroupedFastItems] = useState({});
    const [selectedFGroup, setSelectedFGroup] = useState(null);

    useEffect(() => {
        play();
    }, [terminal.errorSound])


    const dispatch = useDispatch();

    useEffect(() => {
        let arr = [];
        arr['0.5NIS'] = NIS_05;
        arr['1NIS'] = NIS_1;
        arr['2NIS'] = NIS_2;
        arr['5NIS'] = NIS_5;
        arr['10NIS'] = NIS_10;
        arr['20NIS'] = NIS_20;
        arr['50NIS'] = NIS_50;
        arr['100NIS'] = NIS_100;
        arr['200NIS'] = NIS_200;
        arr['1JOD'] = JOD_1;
        arr['10JOD'] = JOD_10;
        arr['20JOD'] = JOD_20;
        arr['50JOD'] = JOD_50;
        arr['10EUR'] = EUR_10;
        arr['1USD'] = USD_1;
        arr['20USD'] = USD_20;
        arr['50USD'] = USD_50;
        arr['100USD'] = USD_100;
        arr['1EUR'] = EUR_1;
        setNotesImages(arr);
    }, [])

    useEffect(() => {

        axios({
            method: 'get',
            url: '/item/fastItems'
        }).then((response) => {
            if (response && response.data) {
                dispatch(uploadFastItems(response.data));
            } else {
                dispatch(notify({ msg: 'Incorrect /item/fastItems response', sev: 'error' }))
            }
        }).catch((error) => {
            if (error.response) {
                if (error.response.status === 401) {
                    dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }))
                } else {

                    dispatch(notify({ msg: error.response.data, sev: 'error' }));
                }
            } else {
                dispatch(notify({ msg: error.message, sev: 'error' }));
            }

        });

        axios({
            method: 'get',
            url: '/payment-method/getCashNotes'
        }).then((response) => {
            if (response && response.data) {
                dispatch(uploadCashButtons(response.data));
            } else {
                dispatch(notify({ msg: 'Incorrect /payment-method/getCashNotes response', sev: 'error' }))
            }
        }).catch((error) => {
            if (error.response) {
                if (error.response.status === 401) {
                    dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }))
                } else {

                    dispatch(notify({ msg: error.response.data, sev: 'error' }));
                }
            } else {
                dispatch(notify({ msg: error.message, sev: 'error' }));
            }

        });

        axios({
            method: 'get',
            url: '/payment-method/getForeignNotes'
        }).then((response) => {
            if (response && response.data) {
                dispatch(uploadForeignButtons(response.data));
            } else {
                dispatch(notify({ msg: 'Incorrect /payment-method/getForeignNotes response', sev: 'error' }))
            }
        }).catch((error) => {
            if (error.response) {
                if (error.response.status === 401) {
                    dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }))
                } else {

                    dispatch(notify({ msg: error.response.data, sev: 'error' }));
                }
            } else {
                dispatch(notify({ msg: error.message, sev: 'error' }));
            }

        });

        axios({
            method: 'get',
            url: '/currency/list',
            params: {
                showDeleted: 0
            }
        }).then((response) => {
            if (response && response.data) {
                dispatch(uploadCurrencies(response.data));
                if (response.data.length > 0) {
                    dispatch(selectCurrency(response.data[0].key))
                } else {
                    dispatch(notify({ msg: 'No currencies found', sev: 'error' }))
                }
            } else {
                dispatch(notify({ msg: 'Incorrect /currency/list response', sev: 'error' }))
            }
        }).catch((error) => {
            if (error.response) {
                if (error.response.status === 401) {
                    dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }))
                } else {

                    dispatch(notify({ msg: error.response.data, sev: 'error' }));
                }
            } else {
                dispatch(notify({ msg: error.message, sev: 'error' }));
            }

        });

        axios({
            method: 'get',
            url: '/payment-method/list',
            params: {
                showDeleted: 0
            }
        }).then((response) => {
            if (response && response.data) {
                let paymentMethods = {};
                response.data.map((obj) => {
                    paymentMethods[obj.key] = obj
                })
                dispatch(uploadPaymentMethods(paymentMethods));
            } else {
                dispatch(notify({ msg: 'Incorrect /payment-methods/list response', sev: 'error' }))
            }
        }).catch((error) => {
            if (error.response) {
                if (error.response.status === 401) {
                    dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }))
                } else {

                    dispatch(notify({ msg: error.response.data, sev: 'error' }));
                }
            } else {
                dispatch(notify({ msg: error.message, sev: 'error' }));
            }

        });

        axios({
            method: 'get',
            url: '/exchange-rate/listOfDay',
            params: {
                tillKey: terminal.till ? terminal.till.key : null
            }
        }).then((response) => {
            if (response && response.data) {
                let rates = {};
                response.data.map((obj) => {
                    rates[obj.currencyKey] = obj.rate
                })
                rates['NIS'] = 1;

                dispatch(uploadExchangeRates(rates));
            } else {
                dispatch(notify({ msg: 'Incorrect /exchange-rates/list response', sev: 'error' }))
            }
        }).catch((error) => {
            if (error.response) {
                if (error.response.status === 401) {
                    dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }))
                } else {

                    dispatch(notify({ msg: error.response.data, sev: 'error' }));
                }
            } else {
                dispatch(notify({ msg: error.message, sev: 'error' }));
            }

        });
    }, [])

    useEffect(() => {
        let tmp = {};

        terminal.fastItems.map((obj) => {
            if (!tmp[obj.fgroup])
                tmp[obj.fgroup] = [];
            tmp[obj.fgroup].push(obj);
        });

        setGroupedFastItems(tmp);
    }, [terminal.fastItems]);

    const resetToStoreCustomer = () => {
        if (terminal.store && terminal.store.sapCustomerCode) {
            axios({
                method: 'post',
                url: '/posAcc/fetchCustomer',
                headers: {
                    customerKey: terminal.store.sapCustomerCode
                }
            }).then((response) => {
                if (response && response.data) {
                    dispatch(setCustomer(response.data));
                }
            }).catch((error) => {
                if (error.response) {
                    if (error.response.status === 401) {
                        dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }))
                    } else {

                        dispatch(notify({ msg: error.response.data, sev: 'error' }));
                    }
                } else {
                    dispatch(notify({ msg: error.message, sev: 'error' }));
                }

            });
        }
    }

    const startPayment = (type, inputType) => {
        dispatch(clearNumberInput());
        dispatch(beginPayment());
        dispatch(setPaymentType({
            type,
            inputType
        }));
        dispatch(selectPaymentMethod(config[type]));
    }

    const handleVoidLine = () => {
        if (trxSlice.trx) {
            if (terminal.paymentMode) {
                if (trxSlice.selectedPayment) {
                    axios({
                        method: 'post',
                        url: '/utilities/generateQR',
                        data: {
                            hardwareId: config.deviceId,
                            source: 'VoidPayment',
                            sourceKey: trxSlice.selectedPayment.key,
                        }
                    }).then((response) => {
                        if (response && response.data) {
                            setAuthQR({
                                ...response.data,
                                source: 'VoidPayment'
                            });
                        } else {
                            dispatch(notify({ msg: 'Incorrect generate QR response', sev: 'error' }))
                        }
                    }).catch((error) => {
                        if (error.response) {
                            if (error.response.status === 401) {
                                dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }))
                            }
                        } else {
                            dispatch(notify({ msg: error.message, sev: 'error' }));
                        }
                    });

                } else {
                    dispatch(notify({ msg: 'No payment line selected', sev: 'warning' }));
                }
            } else {
                if (trxSlice.selectedLine) {
                    axios({
                        method: 'post',
                        url: '/utilities/generateQR',
                        data: {
                            hardwareId: config.deviceId,
                            source: 'VoidLine',
                            sourceKey: trxSlice.selectedLine.key,
                        }
                    }).then((response) => {
                        if (response && response.data) {
                            setAuthQR({
                                ...response.data,
                                source: 'VoidLine'
                            });
                        } else {
                            dispatch(notify({ msg: 'Incorrect generate QR response', sev: 'error' }))
                        }
                    }).catch((error) => {
                        if (error.response) {
                            if (error.response.status === 401) {
                                dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }))
                            }
                        } else {
                            dispatch(notify({ msg: error.message, sev: 'error' }));
                        }
                    });
                } else {
                    dispatch(notify({ msg: 'No transaction line selected', sev: 'warning' }));
                }
            }
        } else {
            dispatch(notify({ msg: 'No open transactions', sev: 'warning' }));
        }
    }

    const handlePriceChange = () => {
        if (!trxSlice.priceChangeMode) {
            dispatch(clearNumberInput());
            dispatch(reset());
            axios({
                method: 'post',
                url: '/utilities/generateQR',
                data: {
                    hardwareId: config.deviceId,
                    source: 'PriceChange',
                    sourceKey: trxSlice.selectedLine.key,
                }
            }).then((response) => {
                if (response && response.data) {
                    setAuthQR({
                        ...response.data,
                        source: 'PriceChange'
                    });
                } else {
                    dispatch(notify({ msg: 'Incorrect generate QR response', sev: 'error' }))
                }
            }).catch((error) => {
                if (error.response) {
                    if (error.response.status === 401) {
                        dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }))
                    }
                } else {
                    dispatch(notify({ msg: error.message, sev: 'error' }));
                }
            });
        } else if (trxSlice.priceChangeMode) {
            dispatch(clearNumberInput());
            dispatch(reset());
            dispatch(disablePriceChange());
        }
    }

    const handleAbort = () => {
        dispatch(clearNumberInput());

        if (terminal.paymentMode && actionsMode === 'payment' && terminal.paymentType === 'none') {
            axios({
                method: 'post',
                url: '/trx/abortPayment',
                headers: {
                    trxKey: trxSlice.trx ? trxSlice.trx.key : null
                }
            }).then((response) => {
                if (response && response.data) {
                    dispatch(setTrx(response.data));
                } else {
                    dispatch(notify({ msg: 'Incorrect trx/abortPayment/ response', sev: 'error' }))
                }
            }).catch((error) => {
                if (error.response) {
                    if (error.response.status === 401) {
                        dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }))
                    } else {

                        dispatch(notify({ msg: error.response.data, sev: 'error' }));
                    }
                } else {
                    dispatch(notify({ msg: error.message, sev: 'error' }));
                }

            });
        } else if (terminal.paymentMode && terminal.paymentInput === 'numpad') {
            dispatch(exitNumpadEntry());
        }

        if (!terminal.paymentMode) {
            //  dispatch(logout());
            // dispatch(notify({ msg: 'YOU CANT SHUTDOWN', sev: 'error' }));
            window.location.reload();
        } else {
            dispatch(abort());
        }

    }

    useEffect(() => {
        if (authQR.qrAuthKey) {
            dispatch(startQrAuthCheck());
        }
    }, [authQR]);

    useEffect(() => {
        if (trxSlice.qrAuthState === 'pending') {
            dispatch(checkOperationQrAuth(authQR));
        }
    }, [trxSlice.qrAuthState]);



    const handleVoidTrx = () => {
        if (trxSlice.trx) {
            axios({
                method: 'post',
                url: '/utilities/generateQR',
                data: {
                    hardwareId: config.deviceId,
                    source: 'VoidTRX',
                    sourceKey: trxSlice.trx.key,
                }
            }).then((response) => {
                if (response && response.data) {
                    setAuthQR({
                        ...response.data,
                        source: 'VoidTRX'
                    });
                } else {
                    dispatch(notify({ msg: 'Incorrect generate QR response', sev: 'error' }))
                }
            }).catch((error) => {
                if (error.response) {
                    if (error.response.status === 401) {
                        dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }))
                    }
                } else {
                    dispatch(notify({ msg: error.message, sev: 'error' }));
                }
            });
        } else {
            dispatch(notify({
                msg: 'No valid Transaction to void',
                sev: 'warning'
            }))
        }
    }

    const handleSuspendTrx = () => {
        if (trxSlice.trx) {
            axios({
                method: 'post',
                url: '/utilities/generateQR',
                data: {
                    hardwareId: config.deviceId,
                    source: 'SuspendTRX',
                    sourceKey: trxSlice.trx.key,
                }
            }).then((response) => {
                if (response && response.data) {
                    setAuthQR({
                        ...response.data,
                        source: 'SuspendTRX'
                    });
                } else {
                    dispatch(notify({ msg: 'Incorrect generate QR response', sev: 'error' }))
                }
            }).catch((error) => {
                if (error.response) {
                    if (error.response.status === 401) {
                        dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }))
                    }
                } else {
                    dispatch(notify({ msg: error.message, sev: 'error' }));
                }
            });
        } else {
            dispatch(notify({
                msg: 'No valid Transaction to suspend',
                sev: 'warning'
            }))
        }
    }

    const handleLockTill = () => {
        if (terminal.till) {
            if (terminal.till.status === 'O') {
                confirm('Lock Till?', 'This marks as closable',
                    () => { dispatch(lockTill()) }
                )
            } else {
                dispatch(notify({
                    msg: 'Till cannot be locked, till not open',
                    sev: 'warning'
                }))
            }
        }
    }

    const handleUnlockTill = () => {
        if (terminal.till) {
            if (terminal.till.status === 'L') {
                dispatch(unlockTill());
            } else {
                dispatch(notify({
                    msg: 'Till cannot be unlocked',
                    sev: 'warning'
                }))
            }
        }
    }

    const buildPaymentTypesButtons = () => {
        return <React.Fragment>
            <Button key='cash' className={classes.MainActionButton} onClick={() => { startPayment('cash', 'fixed') }}>
                <FontAwesomeIcon icon={faMoneyBill} style={{ marginRight: '5px' }} />
                <label>Cash</label>
            </Button>
            <br />
            <Button key='foregin' disabled={terminal.trxMode === 'Refund'} className={classes.MainActionButton} onClick={() => { startPayment('foreign', 'fixed') }}>
                <FontAwesomeIcon icon={faMoneyBillTransfer} style={{ marginRight: '5px' }} />
                <label>Currency</label>
            </Button>
            <br />
            <Button key='visa' disabled={terminal.trxMode === 'Refund'} className={classes.MainActionButton} onClick={() => { startPayment('visa', 'numpad') }}>
                <FontAwesomeIcon icon={faIdCard} style={{ marginRight: '5px' }} />
                <label>Visa</label>
            </Button>
            <br />
            <Button key='jawwalPay' disabled={terminal.trxMode === 'Refund'} className={classes.MainActionButton} onClick={() => { startPayment('jawwalPay', 'numpad') }}>
                <FontAwesomeIcon icon={faDollarSign} style={{ marginRight: '5px' }} />
                <label>Jawwal Pay</label>
            </Button>
            <br />
            <Button key='voucher' disabled={terminal.trxMode === 'Refund'} className={classes.MainActionButton} onClick={() => { startPayment('voucher', 'numpad') }}>
                <FontAwesomeIcon icon={faDollarSign} style={{ marginRight: '5px' }} />
                <label>Voucher</label>
            </Button>
            <br />
            {terminal.customer && terminal.store && <Button key='onAccount' disabled={(terminal.trxMode === 'Refund') || (terminal.store.sapCustomerCode === terminal.customer.key)}
                className={classes.MainActionButton} onClick={() => { startPayment('onAccount', 'numpad') }}>
                <FontAwesomeIcon icon={faDollarSign} style={{ marginRight: '5px' }} />
                <label>On Account</label>
            </Button>}
        </React.Fragment>;
    }

    const buildCashButtons = () => {
        let tmp = [];

        if (terminal.trxMode === 'Sale') {
            terminal.cashButtons.map((obj, i) => {
                tmp.push(
                    <a key={i} onClick={() => {
                        dispatch(submitPayment({
                            tillKey: terminal.till ? terminal.till.key : null,
                            trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                            paymentMethodKey: obj.paymentMethodKey,
                            currency: obj.currency,
                            amount: obj.amount
                        }))
                    }}
                        style={{ backgroundColor: '#f7f7fa', display: 'block' }}

                    >
                        <img src={notesImages[obj.amount + '' + obj.currency]} style={{ display: 'block', margin: 'auto', width: obj.amount > 10 ? '90%' : 'auto', height: '60px' }} />
                    </a>
                )
                tmp.push(<div style={{ lineHeight: '0.6705', color: 'transparent' }} key={i + 'space'} > .</div>);
            });
        } else if (terminal.trxMode === 'Refund') {
            tmp.push(
                <Button key='fulfilRefundPayment' className={classes.MainActionButton} onClick={() => {
                    dispatch(submitPayment({
                        tillKey: terminal.till ? terminal.till.key : null,
                        trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                        paymentMethodKey: 'Cash',
                        currency: 'NIS',
                        amount: trxSlice.trx ? trxSlice.trx.totalafterdiscount : 0
                    }))
                }}>
                    <FontAwesomeIcon icon={faMoneyBill} style={{ marginRight: '5px' }} />
                    <label>Refund ({trxSlice.trx.totalafterdiscount} ₪)</label>
                </Button>
            );
        }



        tmp.push(<div key='fs' style={{ lineHeight: '0.6705', color: 'transparent' }}> .</div>);

        return tmp;
    }

    const buildForeignButtons = () => {
        let tmp = [];

        terminal.foreignButtons.map((obj) => {
            tmp.push(
                <a key={obj.uuid} onClick={() => {
                    dispatch(submitPayment({
                        tillKey: terminal.till ? terminal.till.key : null,
                        trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                        paymentMethodKey: obj.paymentMethodKey,
                        currency: obj.currency,
                        amount: obj.amount
                    }))
                }} style={{ backgroundColor: '#f7f7fa', display: 'block' }} >
                    <img src={notesImages[obj.amount + '' + obj.currency]} style={{ display: 'block', margin: 'auto', width: '90%', height: '57px' }} />
                </a>
            )
            tmp.push(<div style={{ lineHeight: '0.6705', color: 'transparent' }} key={obj.uuid + 'space'} > .</div>);
        });

        tmp.push(<div key='fs' style={{ lineHeight: '0.6705', color: 'transparent' }}> .</div>);

        return tmp;
    }

    const buildVisaButtons = () => {
        let tmp = [];

        terminal.currencies.map((obj, i) => {
            tmp.push(
                <Button key={i} className={classes.ActionButton}
                    appearance={obj.key === trxSlice.selectedCurrency ? 'primary' : 'default'}
                    onClick={() => dispatch(selectCurrency(obj.key))} >
                    <div style={{ textAlign: 'center' }}>
                        {obj.key}
                    </div>
                </Button>
            )
            tmp.push(<div style={{ lineHeight: '0.6705', color: 'transparent' }} key={obj.key + 'space'} > .</div>);
        });

        tmp.push(<div key='fs' style={{ lineHeight: '0.6705', color: 'transparent' }}> .</div>);

        return tmp;
    }


    const buildOperationsButtons = () => {
        return <React.Fragment>
            <Button key='suspend' className={classes.MainActionButton} onClick={handleSuspendTrx}>
                <div style={{ textAlign: 'center', fontSize: '14px', }}>
                    <FontAwesomeIcon icon={faPause} style={{ marginRight: '5px' }} />
                    <label>Suspend Trx</label>
                </div>
            </Button>
            <br />
            {
                terminal.trxMode === 'Sale' &&
                <Button disabled={trxSlice.trx !== null} key='refund' className={classes.MainActionButton} onClick={() => { dispatch(setTrxMode('Refund')) }}>
                    <div style={{ textAlign: 'center', fontSize: '14px', }}>
                        <FontAwesomeIcon icon={faRotateLeft} style={{ marginRight: '5px' }} />
                        <label>Refund</label>
                    </div>
                </Button>
            }
            {
                terminal.trxMode === 'Refund' &&
                <Button disabled={trxSlice.trx !== null} key='sale' className={classes.MainActionButton} onClick={() => { dispatch(setTrxMode('Sale')) }}>
                    <div style={{ textAlign: 'center', fontSize: '14px', }}>
                        <FontAwesomeIcon icon={faDollarSign} style={{ marginRight: '5px' }} />
                        <label>Sale</label>
                    </div>
                </Button>
            }
            <br />
            {
                (terminal.till && terminal.till.status === 'O') &&
                <Button disabled={trxSlice.trx !== null} key='lock' className={classes.MainActionButton} onClick={handleLockTill}>
                    <div style={{ textAlign: 'center', fontSize: '14px', }}>
                        <FontAwesomeIcon icon={faLock} style={{ marginRight: '5px' }} />
                        <label>Lock Till</label>
                    </div>
                </Button>
            }
            {
                terminal.till && terminal.till.status === 'L' &&
                <Button key='unlock' style={{ zIndex: '1000' }} className={classes.MainActionButton} onClick={handleUnlockTill}>
                    <div style={{ textAlign: 'center', fontSize: '14px', }}>
                        <FontAwesomeIcon icon={faUnlock} style={{ marginRight: '5px' }} />
                        <label>Unlock Till</label>
                    </div>
                </Button>
            }
        </React.Fragment >;
    }

    const buildFastItemGroupButtons = () => {
        let tmp = [];

        Object.keys(groupedFastItems).map((key, i) => {
            tmp.push(
                <Button key={i} className={classes.ActionButton}
                    onClick={() => {
                        setSelectedFGroup(key);
                    }} >
                    <div key={key + 'di'} style={{ textAlign: 'center', fontSize: '14px', }}>
                        {key}
                    </div>
                </Button>
            )
            tmp.push(<div key={key + 'div'} style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>);
        });

        tmp.push(<div key='fsz' style={{ lineHeight: '0.6705', color: 'transparent' }}> .</div>);

        return tmp;
    }

    const buildFastItemsButtonsForGroup = () => {
        let tmp = [];
        groupedFastItems[selectedFGroup].map((obj, i) => {
            tmp.push(
                <Button key={i} className={classes.ActionButton}
                    onClick={() => {
                        if (trxSlice.trx && trxSlice.trx.key) {
                            dispatch(scanBarcode({
                                customerKey: terminal.customer ? terminal.customer.key : null,
                                barcode: obj.barcode,
                                trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                                trxMode: terminal.trxMode,
                                tillKey: terminal.till ? terminal.till.key : null,
                                multiplier: trxSlice.multiplier ? trxSlice.multiplier : '1'
                            }))
                        } else {

                            dispatch(scanNewTransaction({
                                customerKey: terminal.customer ? terminal.customer.key : null,
                                barcode: obj.barcode,
                                trxKey: null,
                                trxMode: terminal.trxMode,
                                tillKey: terminal.till ? terminal.till.key : null,
                                multiplier: '1'
                            }))
                        }

                    }} >
                    <div key={obj.key + 'di'} style={{ textAlign: 'center', fontSize: '14px', }}>
                        {obj.itemName}
                    </div>
                </Button>
            )
            tmp.push(<div key={obj.key + 'div'} style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>);
        });
        tmp.push(
            <Button key={'backBtnD'} className={classes.ActionButton} appearance="primary" color="orange"
                onClick={() => { setSelectedFGroup(null) }} >
                <div key={'backBtn'} style={{ textAlign: 'center', fontSize: '14px', }}>
                    Back
                </div>
            </Button>
        )

        tmp.push(<div key='fs' style={{ lineHeight: '0.6705', color: 'transparent' }}> .</div>);

        return tmp;
    }



    return (
        <FlexboxGrid  >
            <FlexboxGrid.Item colspan={11} style={{ background: 'white', position: 'relative', left: '6px', width: '48.83333333%' }}  >
                {terminal.display === 'ready' && <Invoice />}
                {terminal.display === 'balance-setup' && <BalanceSetup />}
                {terminal.display === 'payment' && <Payments />}
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={1} style={{ width: '1.166667%' }}>

                {
                    terminal.blockActions && <div style={{
                        position: 'fixed',
                        zIndex: '999',
                        backgroundColor: 'rgba(0,0,0,0.6)', height: '100%', width: '100%', top: '0%', left: '0%'
                    }}>
                        <h1 style={{ textAlign: 'center', color: 'white', margin: '15%' }}>
                            <FontAwesomeIcon icon={faLock} style={{ marginRight: '8px' }} />
                            TERMINAL LOCKED
                        </h1>
                    </div>
                }

                {
                    (trxSlice.qrAuthState === 'pending') && authQR && <div style={{
                        position: 'fixed',
                        zIndex: '999',
                        backgroundColor: 'rgba(0,0,0,0.6)', height: '100%', width: '100%', top: '0%', left: '0%'
                    }}>
                        <h1 style={{ textAlign: 'center', color: 'white', margin: '15%' }}>
                            <FontAwesomeIcon icon={faLock} style={{ marginRight: '8px' }} />
                            Access Needed
                            <hr />
                            <QRCode value={JSON.stringify(authQR)} size={180} />
                            <br />
                            <span> ( {authQR.source} )</span>
                            <hr />
                            <Button style={{ fontSize: '24px' }} appearance="primary" color="red"
                                onClick={() => dispatch(holdQrAuthCheck())} >
                                <FontAwesomeIcon icon={faBan} style={{ marginRight: '8px' }} />
                                CANCEL
                            </Button>
                        </h1>
                    </div>
                }
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={9} style={{ position: 'relative', left: '6px', height: '87.5vh' }}>
                <div style={{ background: '#303030', color: 'white', height: '5vh', position: 'relative', width: '120%', right: '12px' }}>
                    <h6 style={{ lineHeight: '5vh', textAlign: 'left' }}>
                        <span> <FontAwesomeIcon icon={faUser} style={{ marginLeft: '7px', marginRight: '7px' }} /> {terminal.loggedInUser ? terminal.loggedInUser.username : 'No User'}</span>
                        <span style={{ marginRight: '10px', marginLeft: '10px' }}>/</span>
                        <span>{terminal.till && terminal.till.workDay ? terminal.till.workDay.businessDateAsString : 'No Work Day'}</span>
                    </h6>
                </div>

                <div style={{ background: 'white', padding: '10px', position: 'absolute', top: '5vh', width: '96.5%', height: '33vh' }}>
                    <span>
                        <a style={{ color: '#2196f3', padding: '2px' }} onClick={() => {
                            confirm('Reset Customer?', 'This clears to default customer',
                                () => { resetToStoreCustomer() }
                            )
                        }}>
                            <FontAwesomeIcon icon={faIdCard} style={{ marginLeft: '7px', marginRight: '7px' }} /> {terminal.customer ? terminal.customer.customerName : 'No Customer'}
                        </a>
                    </span>
                    <Divider style={{ margin: '7px' }} />
                    <div style={{ padding: '0px' }}>
                        <Alert severity={uiSlice.toastType} sx={{ width: '100%' }}>
                            {uiSlice.toastMsg.toString()}
                        </Alert>
                    </div>
                    <Divider style={{ margin: '7px' }} />
                    {
                        terminal.paymentMode &&
                        <FlexboxGrid>
                            <FlexboxGrid.Item colspan={24} >
                                <div style={{ border: '1px solid #e1e1e1', padding: '3px', minWidth: '60%', margin: 'auto' }}>
                                    <small style={{ fontSize: '20px', marginRight: '5px' }}>
                                        Paid =
                                    </small>
                                    <b>
                                        <label id='Total' style={{ fontSize: '25px' }}>
                                            {(Math.round(trxSlice.trxPaid * 100) / 100).toFixed(2)}
                                        </label>
                                    </b>
                                </div>
                            </FlexboxGrid.Item>
                            <FlexboxGrid.Item colspan={24}>
                                <br />
                            </FlexboxGrid.Item>
                            <FlexboxGrid.Item colspan={24}>
                                <div style={{ border: '1px solid #e1e1e1', padding: '3px', minwidth: '60%', margin: 'auto' }}>
                                    <small style={{ fontSize: '20px', marginRight: '5px' }}>
                                        Change =
                                    </small>
                                    <b> <label id='Total' style={{ fontSize: '25px', color: trxSlice.trxChange < 0 ? 'red' : 'green' }} >
                                        {(Math.round(trxSlice.trxChange * 100) / 100).toFixed(2)}
                                    </label>
                                    </b>
                                    {
                                        terminal.paymentInput === 'numpad' && trxSlice.selectedCurrency !== 'NIS' &&
                                        <small style={{ fontSize: '15px', marginLeft: '5px' }}>
                                            ( { (Math.round(Math.abs(trxSlice.trxChange / terminal.exchangeRates[trxSlice.selectedCurrency]) * 100) / 100).toFixed(2) } {trxSlice.selectedCurrency} )
                                        </small>
                                    }
                                </div>
                            </FlexboxGrid.Item>
                        </FlexboxGrid>
                    }

                    {
                        trxSlice.lastTrxPayment && <FlexboxGrid>
                            <FlexboxGrid.Item colspan={24} >
                                <div style={{ border: '1px solid #e1e1e1', padding: '3px', minWidth: '60%', margin: 'auto' }}>
                                    <small style={{ fontSize: '20px', marginRight: '5px' }}>
                                        Paid =
                                    </small>
                                    <b>
                                        <label id='Total' style={{ fontSize: '25px' }}>
                                            {(Math.round(trxSlice.lastTrxPayment.paid * 100) / 100).toFixed(2)}
                                        </label>
                                    </b>
                                </div>
                            </FlexboxGrid.Item>
                            <FlexboxGrid.Item colspan={24}>
                                <br />
                            </FlexboxGrid.Item>
                            <FlexboxGrid.Item colspan={24}>
                                <div style={{ border: '1px solid #e1e1e1', padding: '3px', minwidth: '60%', margin: 'auto' }}>
                                    <small style={{ fontSize: '20px', marginRight: '5px' }}>
                                        Change =
                                    </small>
                                    <b> <label id='Total' style={{ fontSize: '25px', color: trxSlice.lastTrxPayment.change < 0 ? 'red' : 'green' }} >
                                        {(Math.round(trxSlice.lastTrxPayment.change * 100) / 100).toFixed(2)}
                                    </label>
                                    </b>
                                </div>
                            </FlexboxGrid.Item>
                        </FlexboxGrid>
                    }
                </div>

                <div style={{ background: 'white', padding: '10px', position: 'absolute', bottom: '0%', width: '96.5%' }}>
                    <Numpad />
                </div>

            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={3} style={{ position: 'relative', right: '10px' }}>
                <div style={{ background: '#303030', color: 'white', height: '5vh', position: 'relative', width: '130%', right: '17px' }}>
                    <h6 style={{ lineHeight: '5vh', textAlign: 'center' }}>
                    </h6>
                </div>
                <div  >
                    <FlexboxGrid justify='space-between' style={{
                        maxHeight: "82vh",
                        overflowY: "hidden",
                        width: "105%",
                        marginLeft: '10px'
                    }}>

                        <FlexboxGrid.Item colspan={24}>
                            {
                                actionsMode === 'payment' && terminal.paymentType === 'none' &&
                                buildPaymentTypesButtons()
                            }

                            {
                                actionsMode === 'payment' && terminal.paymentType === 'cash' &&
                                buildCashButtons()
                            }

                            {
                                actionsMode === 'payment' && terminal.paymentType === 'foreign' &&
                                buildForeignButtons()
                            }

                            {
                                actionsMode === 'payment' && terminal.paymentType === 'visa' &&
                                buildVisaButtons()
                            }

                            {
                                actionsMode === 'payment' && terminal.trxMode !== 'Refund' && terminal.paymentType === 'jawwalPay' &&
                                <Button className={classes.ActionButton}
                                    appearance={'NIS' === trxSlice.selectedCurrency ? 'primary' : 'default'}
                                    onClick={() => dispatch(selectCurrency('NIS'))} >
                                    <div style={{ textAlign: 'center' }}>
                                        Jawwal NIS
                                    </div>
                                </Button>
                            }

                            {
                                actionsMode === 'payment' && terminal.trxMode !== 'Refund' && terminal.paymentType === 'voucher' &&
                                <Button className={classes.ActionButton}
                                    appearance={'NIS' === trxSlice.selectedCurrency ? 'primary' : 'default'}
                                    onClick={() => dispatch(selectCurrency('NIS'))} >
                                    <div style={{ textAlign: 'center' }}>
                                        Voucher NIS
                                    </div>
                                </Button>
                            }


                            {
                                actionsMode === 'payment' && terminal.trxMode !== 'Refund' && terminal.paymentType === 'onAccount' &&
                                <Button className={classes.ActionButton}
                                    appearance={'NIS' === trxSlice.selectedCurrency ? 'primary' : 'default'}
                                    onClick={() => dispatch(selectCurrency('NIS'))} >
                                    <div style={{ textAlign: 'center' }}>
                                        On Account NIS
                                    </div>
                                </Button>
                            }


                            {
                                actionsMode === 'fastItems' && !selectedFGroup &&
                                buildFastItemGroupButtons()
                            }
                            {
                                actionsMode === 'fastItems' && selectedFGroup &&
                                buildFastItemsButtonsForGroup()
                            }
                            {
                                actionsMode === 'operations' &&
                                buildOperationsButtons()
                            }



                        </FlexboxGrid.Item>
                    </FlexboxGrid>
                </div>
            </FlexboxGrid.Item>
            <FlexboxGridItem colspan={24}>
                <span style={{ color: 'transparent', lineHeight: '1.5vh' }}>.</span>
            </FlexboxGridItem>
            <FlexboxGridItem colspan={24} style={{ left: '6px' }}>
                <FlexboxGrid  >
                    <FlexboxGrid.Item colspan={3} >
                        <Button color={'orange'} appearance="primary" className={classes.POSButton} disabled >
                            <FontAwesomeIcon icon={faShieldHalved} style={{ marginRight: '5px' }} />
                            <label>Manager</label>
                        </Button>
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={3}>
                        <Button className={classes.POSButton}
                            appearance={actionsMode === 'payment' ? 'primary' : 'default'}
                            color='green'
                            onClick={() => {
                                setActionsMode('payment')
                            }} >
                            <FontAwesomeIcon icon={faSackDollar} style={{ marginRight: '5px' }} />
                            <label>Payment</label>
                        </Button>
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={3}>
                        <Button className={classes.POSButton}
                            appearance={actionsMode === 'fastItems' ? 'primary' : 'default'}
                            color='green'
                            onClick={() => setActionsMode('fastItems')} >
                            <FontAwesomeIcon icon={faCarrot} style={{ marginRight: '5px' }} />
                            <label>Fast Items</label>
                        </Button>
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={3}>
                        <Button className={classes.POSButton}
                            appearance={actionsMode === 'operations' ? 'primary' : 'default'}
                            color='green'
                            onClick={() => setActionsMode('operations')} >
                            <FontAwesomeIcon icon={faToolbox} style={{ marginRight: '5px' }} />
                            <label>Operations</label>
                        </Button>
                    </FlexboxGrid.Item>


                    <FlexboxGrid.Item colspan={3}>
                        {terminal.paymentMode &&
                            <Button className={classes.POSButton}
                                onClick={handleVoidLine}
                                disabled={!trxSlice.selectedPayment || !trxSlice.selectedPayment.key}
                                appearance='primary' color='blue'>
                                <FontAwesomeIcon icon={faEraser} style={{ marginRight: '5px' }} />
                                <label>Void Payment</label>
                            </Button>
                        }
                        {!terminal.paymentMode &&
                            <Button className={classes.POSButton}
                                onClick={handleVoidLine}
                                disabled={!trxSlice.selectedLine || !trxSlice.selectedLine.key}
                                appearance='primary' color='blue'>
                                <FontAwesomeIcon icon={faEraser} style={{ marginRight: '5px' }} />
                                <label>Void Line</label>
                            </Button>
                        }
                    </FlexboxGrid.Item>
                    <FlexboxGrid.Item colspan={3}>
                        <Button className={classes.POSButton}
                            onClick={handleVoidTrx}
                            disabled={terminal.paymentMode}
                            appearance='primary' color='blue'>
                            <FontAwesomeIcon icon={faToolbox} style={{ marginRight: '5px' }} />
                            <label>Void TRX</label>
                        </Button>
                    </FlexboxGrid.Item>
                    <FlexboxGrid.Item colspan={3}>
                        <Button className={classes.POSButton}
                            disabled={terminal.paymentMode || !trxSlice.selectedLine || !trxSlice.selectedLine.key}
                            onClick={handlePriceChange}
                            appearance='primary' color={trxSlice.priceChangeMode ? 'orange' : 'blue'}  >
                            <FontAwesomeIcon icon={faRepeat} style={{ marginRight: '5px' }} />
                            <label>{trxSlice.priceChangeMode ? 'CANCEL' : 'Price Change'}</label>
                        </Button>
                    </FlexboxGrid.Item>
                    <FlexboxGrid.Item colspan={3}>
                        <Button className={classes.POSButton}
                            // disabled={terminal.display === 'ready'}
                            onClick={handleAbort}
                            appearance='primary' color='red'>
                            <FontAwesomeIcon icon={faTimes} style={{ marginRight: '5px' }} />
                            <label>
                                {
                                    (terminal.paymentMode && actionsMode === 'payment' && terminal.paymentType === 'none') ? 'Abort' :
                                        (terminal.paymentMode && actionsMode === 'payment' && terminal.paymentType !== 'none') ? 'Back' : !terminal.paymentMode ? 'Restart' : ''
                                }

                            </label>
                        </Button>
                    </FlexboxGrid.Item>


                </FlexboxGrid>
            </FlexboxGridItem >
        </FlexboxGrid >
    );
}

export default Terminal;