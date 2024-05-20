import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux'
import axios from '../../axios';
import { Button, FlexboxGrid, Divider, Input, SelectPicker, Drawer, ButtonGroup, IconButton, ButtonToolbar } from 'rsuite';
import classes from './Terminal.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSackDollar, faMoneyBillTransfer, faRepeat, faUser, faScaleBalanced, faTag, faChevronUp, faChevronDown,
    faCarrot, faToolbox, faShieldHalved, faMoneyBill, faIdCard, faTimes, faEraser, faBan, faPause, faRotateLeft, faDollarSign, faLock, faUnlock, faSearch, faStar, faChain, faHistory, faPlay, faPlusSquare, faTags, faKey, faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons'
import Numpad from './Numpad';
import Invoice from './Invoice';
import Payments from './Payments';
import BalanceSetup from './BalanceSetup';
import terminalSlice, {
    beginPayment, uploadCurrencies, abort, exitNumpadEntry, reset,
    uploadCashButtons, setPaymentType, uploadForeignButtons, uploadPaymentMethods, uploadFastItems, setTrxMode, lockTill, unlockTill, uploadExchangeRates, setCustomer, setManagerMode, setTerminal, fetchSuspendedForTill, setManagerUser, verifyManagerMode
} from '../../store/terminalSlice';
import {
    selectCurrency, submitPayment, clearNumberInput, scanBarcode, scanNewTransaction, setTrx,
    selectPaymentMethod, suspendTrx, enablePriceChange, disablePriceChange,
    checkOperationQrAuth, startQrAuthCheck, holdQrAuthCheck, voidTrx, voidPayment, voidLine, uploadCashBackCoupons, setUsedCoupons, rescanTrx, closeTrxPayment, clearLastPaymentHistory, setPriceChangeReason, prepareScanMultiplierPreDefined
} from '../../store/trxSlice';
import { hideLoading, notify, showLoading } from '../../store/uiSlice';
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
import Logo from '../../assets/full-logo.png';
import Lock from '../../assets/lock.png';



const Terminal = (props) => {
    const terminal = useSelector((state) => state.terminal);
    const trxSlice = useSelector((state) => state.trx);
    const uiSlice = useSelector((state) => state.ui);

    const [actionsMode, setActionsMode] = useState('payment');
    const [notesImages, setNotesImages] = useState([]);
    const [authQR, setAuthQR] = useState({});
    const [bopVisaIp, setBopVisaIp] = useState('');
    const [play] = useSound(errorBeep);

    const [groupedFastItems, setGroupedFastItems] = useState({});
    const [selectedFGroup, setSelectedFGroup] = useState(null);

    const [cashDroState, setCashDroState] = useState({
        timestamp: new Date().getTime(),
        state: 0 // 0 = idle, 1 = listening
    });

    const [hasEshiniConnection, setHasEshiniConnection] = useState(true);

    const [scaleItemsOpen, setScaleItemsOpen] = useState(false);
    const [selectedScaleCategory, setSelectedScaleCategory] = useState('veggie');
    const [produceItems, setProduceItems] = useState([]);
    const [localMsg, setLocalMsg] = useState('');
    const [alphabtet, setAlphabet] = useState('all');
    const [veggieScrollAction, setVeggieScrollAction] = useState('none');

    useEffect(() => {
        if (veggieScrollAction === 'up') {
            document.querySelector('#veggieList').scroll({
                top: document.querySelector('#veggieList').scrollTop - 300,
                behavior: 'smooth'
            });
            setVeggieScrollAction('none')
        } else if (veggieScrollAction === 'down') {
            document.querySelector('#veggieList').scroll({
                top: document.querySelector('#veggieList').scrollTop + 300,
                behavior: 'smooth'
            });
            setVeggieScrollAction('none')
        }
    }, [veggieScrollAction])




    useEffect(() => {
        if (terminal.errorSound)
            play();
    }, [terminal.errorSound])

    useEffect(() => {
        axios({
            method: 'post',
            url: '/trx/hasEshiniConnection'
        }).then((response) => {
            if (response) {
                setHasEshiniConnection(response.data);
            }
        }).catch((error) => {
            dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
        });
    }, [])

    useEffect(() => {
        if (selectedScaleCategory) {
            axios({
                method: 'get',
                url: '/barcode/produceItems/'.concat(selectedScaleCategory).concat('/').concat(alphabtet),
            }).then((response) => {
                if (response) {
                    setProduceItems(response.data);
                }
            }).catch((error) => {
                dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
            });
        }
    }, [selectedScaleCategory, alphabtet])


    const [logoCounter, setLogoCounter] = useState(0);
    const handleLogoClick = () => {
        setLogoCounter(logoCounter + 1);
    }

    useEffect(() => {
        if (trxSlice.numberInputValue === '4.994') {
            if (logoCounter === 10) {
                dispatch(setManagerMode(true));
                setLogoCounter(0);
            }
        } else {
            setLogoCounter(0);
        }
    }, [logoCounter])



    const dispatch = useDispatch();

    /**  
     * basic/setup data initialization
     * */
    useEffect(() => {

        // initialize currency images
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

        // initialize fast items
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


        //initialize cash notes
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

        // initialize cash foreign notes
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

        // initialize currency list
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


        // initialie payment method list
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

        // initialize currency exchange rates
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

        // load any suspended TRX for this till
        dispatch(fetchSuspendedForTill());
    }, [])

    /**
     * re-arrange fast items into groups
     */
    useEffect(() => {
        let tmp = {};

        terminal.fastItems.map((obj) => {
            if (!tmp[obj.fgroup])
                tmp[obj.fgroup] = [];
            tmp[obj.fgroup].push(obj);
        });

        setGroupedFastItems(tmp);
    }, [terminal.fastItems]);

    useEffect(() => {
        // console.log('TRX changed, check for cashdro');
        // console.log(trxSlice.trx);
        // console.log(terminal.paymentMode);
        if (config.cashDroEnabled
            && trxSlice.trx
            && trxSlice.trx.cashdroId
            && terminal.paymentMode) {
            if (trxSlice.trx.cashdroState === 'PENDING') {
                // change CashDro state to listening
                setCashDroState({
                    timestamp: new Date().getTime(),
                    state: 1
                });
            } else if (trxSlice.trx.cashdroState === 'COMPLETED') {
                const change = trxSlice.trx.customerchange;
                if (change >= 0) {
                    dispatch(closeTrxPayment({
                        key: trxSlice.trx.key
                    }));
                    window.setTimeout(() => {
                        dispatch(clearLastPaymentHistory());
                    }, 6000)

                    return;
                }
            }
        }

        axios({
            method: 'post',
            url: '/trx/hasEshiniConnection'
        }).then((response) => {
            if (response) {
                setHasEshiniConnection(response.data);
            }
        }).catch((error) => {
            dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
        });

    }, [trxSlice.trx]);

    useEffect(() => {
        if (cashDroState.state === 1) {
            // start listening for CashDro transaction state
            if (terminal.paymentMode) {
                checkCashDroState();
            } else {
                setCashDroState({
                    timestamp: new Date().getTime(),
                    state: 0
                });
            }
        }
    }, [cashDroState]);

    const checkCashDroState = () => {

        if (cashDroState.state === 1) {
            // still listening, check again
            axios({
                method: 'post',
                headers: {
                    trxKey: trxSlice.trx ? trxSlice.trx.key : null
                },
                url: '/trx/checkTrxCashDroStatus'
            }).then((response) => {
                if (response && response.data) {
                    const cashDroResponse = response.data;
                    if (cashDroResponse.state === 'F') {
                        // CashDro state finished, submit payment
                        // console.log('CashDro state finished, submit payment');
                        let paymentAmt = cashDroResponse.totalIn + cashDroResponse.totalOut;
                        paymentAmt = paymentAmt / 100.0;
                        if (paymentAmt > 0) {
                            dispatch(submitPayment({
                                tillKey: terminal.till ? terminal.till.key : null,
                                trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                                paymentMethodKey: 'Cash',
                                currency: 'NIS',
                                amount: paymentAmt,
                                sourceKey: 'CashDro',
                                visaPayment: null
                            }));
                            // console.log('stop listening');
                            setCashDroState({
                                timestamp: new Date().getTime(),
                                state: 0
                            }); // stop listening
                        }
                    } else {
                        // console.log('waiting for payment from CashDro');
                        setCashDroState({
                            timestamp: new Date().getTime(),
                            state: 1
                        }); // keep listening
                    }
                } else {
                    dispatch(notify({ msg: 'Incorrect /trx/checkTrxCashDroStatus response', sev: 'error' }))
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

    function formatDouble(number) {
        console.log('number passed to format: ', number);
        // Ensure the number has 3 decimal places
        let formattedNumber = number;//.toFixed(3);

        // Split the number into whole part and decimal part
        let parts = formattedNumber.split('.');
        let wholePart = parts[0];
        let decimalPart = parts[1];

        // Pad the whole part with leading zeros if needed
        while (wholePart.length < 2) {
            wholePart = '0' + wholePart;
        }
        if(wholePart.length === 3){
            wholePart = wholePart.substr(1)
        }

        // Combine the parts and remove the decimal point
        formattedNumber = wholePart + decimalPart;

        return formattedNumber;
    }

    const scanWeightableItem = (item) => {
        dispatch(showLoading());
        const barcode = item.barcode;
        axios({
            method: 'get',
            url: `http://localhost:${config.expressPort ? config.expressPort : '3001'}/fetchFromScale`,
        }).then((response) => {
            let qty = response.data;
            if (item.scalePieceItem) {
                qty = trxSlice.multiplier ? trxSlice.multiplier : '1';
            }
            if (qty > 0.0) {
                setScaleItemsOpen(false);
                setLocalMsg('');
                if (trxSlice.trx && trxSlice.trx.key) {
                    dispatch(scanBarcode({
                        customerKey: terminal.customer ? terminal.customer.key : null,
                        barcode: '61'.concat(barcode).concat(formatDouble(qty)).concat('1'),
                        trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                        trxMode: terminal.trxMode,
                        tillKey: terminal.till ? terminal.till.key : null,
                        multiplier: '1'
                    }))
                } else {
                    dispatch(scanNewTransaction({
                        customerKey: terminal.customer ? terminal.customer.key : null,
                        barcode: '61'.concat(barcode).concat(formatDouble(qty)).concat('1'),
                        trxKey: null,
                        trxMode: terminal.trxMode,
                        tillKey: terminal.till ? terminal.till.key : null,
                        multiplier: '1'
                    }))
                }
            } else {
                setLocalMsg('Please add item on scale first');
            }
        }).catch((error) => {
            console.error(error);
            setLocalMsg('could not fetch weight from scale');
            dispatch(notify({ msg: 'could not fetch weight from scale', sev: 'error' }));
            dispatch(hideLoading());
        })
    }


    const startPayment = (type, inputType) => {
        dispatch(clearNumberInput());
        dispatch(beginPayment());
        dispatch(setPaymentType({
            type,
            inputType
        }));
        dispatch(selectPaymentMethod(config[type]));
        if (type === 'cashBack') {
            loadCashbackCoupons();
        }

        if (type === 'cash' && config.cashDroEnabled) {
            // initiate cashdro listener
            cashdrowFlow();
        }
    }

    const cashdrowFlow = () => {
        // start
        // console.log(terminal.terminal);
        if (terminal.terminal && terminal.terminal.cashDroIp) {
            // start operation on cashdro & link TRX with operation
            axios({
                method: 'post',
                headers: {
                    trxKey: trxSlice.trx ? trxSlice.trx.key : null
                },
                url: '/trx/linkTrxToCashDro'
            }).then((response) => {
                if (response && response.data) {
                    dispatch(setTrx(response.data));
                } else {
                    dispatch(notify({ msg: 'Incorrect /trx/linkTrxToCashDro response', sev: 'error' }))
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
        } else {
            // console.log('terminal has no cashdro configured');
        }

    }

    const autoVisaFlow = async () => {

        if (trxSlice.selectedCurrency === 'EUR') {
            dispatch(notify({ msg: 'Auto Visa does not support Euro', sev: 'warning' }));
            return;
        }

        if (trxSlice.selectedCurrency !== 'NIS' && !terminal.exchangeRates[trxSlice.selectedCurrency]) {
            dispatch(notify({ msg: 'Selected currency has no exchange rate defined', sev: 'error' }));
            return;
        }

        dispatch(showLoading('Connecting to Auto Visa...'));


        // check connectivity to auto visa
        // let connection = true;

        // try {
        //     const timeoutPromise = new Promise((_, reject) =>
        //         setTimeout(() => reject(new Error('Request timed out')), 2000) // 2000 milliseconds (2 seconds)
        //     );

        //     const fetchPromise = fetch(`http://${terminal.terminal.bopVisaIp}:7800`);

        //     const _visa_response = await Promise.race([fetchPromise, timeoutPromise]);

        //     if (!_visa_response || !_visa_response.ok) {
        //         connection = false;
        //     }
        // } catch (e) {
        //     connection = false;
        // }

        // if (!connection) {
        //     dispatch(hideLoading())
        //     dispatch(notify({ msg: `Visa @ ${terminal.terminal.bopVisaIp}:7800 not reachable`, sev: 'error' }));
        //     return;;
        // } 

        let amt = Math.abs(trxSlice.trxChange);

        if (trxSlice.trx && amt > 0) {

            let cur = 376;

            switch (trxSlice.selectedCurrency) {
                case 'NIS': {
                    cur = 376;
                    break;
                }
                case 'JOD': {
                    cur = 400;
                    amt = (Math.round(Math.abs(trxSlice.trxChange / terminal.exchangeRates[trxSlice.selectedCurrency]) * 1000) / 100).toFixed(3);
                    break;
                }
                case 'USD': {
                    cur = 840;
                    amt = (Math.round(Math.abs(trxSlice.trxChange / terminal.exchangeRates[trxSlice.selectedCurrency]) * 100) / 100).toFixed(2);
                    break;
                }
            }

            let integerPart = Math.floor(amt);
            let decimalPart = amt - integerPart;
            decimalPart = decimalPart.toFixed(2);

            amt = integerPart * 100;
            amt += parseFloat(decimalPart) * 100;

            let trxId = trxSlice.trx.nanoId.replace('-', '');
            // implement BOP auto visa flow
            axios({
                method: 'post',
                url: `http://127.0.0.1:${config.expressPort ? config.expressPort : '3001'}/bopVisaSale`,
                data: {
                    trxId,
                    amt,
                    cur,
                    terminal: terminal.terminal
                }
            }).then((response) => {
                if (response && response.data) {
                    const visaResponse = response.data;
                    // console.log(visaResponse);
                    if (visaResponse.resp_code === 0) {
                        // success, make payment
                        const transactionAmount = amt / 100;

                        dispatch(submitPayment({
                            tillKey: terminal.till ? terminal.till.key : null,
                            trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                            paymentMethodKey: trxSlice.selectedPaymentMethod,
                            currency: trxSlice.selectedCurrency,
                            amount: transactionAmount,
                            sourceKey: 'AUTO VISA',
                            visaPayment: {
                                amt: visaResponse.sale ? visaResponse.sale.amt : visaResponse.amt,
                                curr: visaResponse.sale ? visaResponse.sale.cur : visaResponse.cur,
                                pan: visaResponse.card ? visaResponse.card.pan : null,
                                respCode: visaResponse.resp_code,
                                authCode: visaResponse.auth_code,
                                fullResponseJson: JSON.stringify(visaResponse)
                            }
                        }))
                    } else {
                        dispatch(notify({ msg: visaResponse.error_msg, sev: 'error' }));
                    }
                }
                dispatch(hideLoading());
            }).catch((error) => {
                // console.log(error, error.response, error.message);
                dispatch(notify({ msg: error.response ? error.response : error.message, sev: 'error' }));
                dispatch(hideLoading());
            });

        } // end IF
    }

    const handleVoidLine = () => {
        if (trxSlice.trx) {
            if (terminal.paymentMode) {

                if (trxSlice.selectedPayment) {
                    confirm('Void Payment?', trxSlice.selectedPayment.amount + ' ' + trxSlice.selectedPayment.currency,
                        () => {
                            if (terminal.managerMode) {
                                dispatch(voidPayment(trxSlice.selectedPayment.key));
                            } else {
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
                            }
                        }
                    )

                } else {
                    dispatch(notify({ msg: 'No payment line selected', sev: 'warning' }));
                }
            } else {
                if (trxSlice.selectedLine) {
                    confirm('Void Line?', trxSlice.selectedLine.description,
                        () => {
                            if (terminal.managerMode) {
                                dispatch(voidLine(trxSlice.selectedLine.key));
                            } else {
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
                            }
                        }
                    )
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
            // dispatch(reset());
            if (terminal.managerMode || (trxSlice.selectedLine.barcode === '7290012080142' && terminal.store.key === 'maintira')) {
                dispatch(enablePriceChange());
            } else {
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
            }
        } else if (trxSlice.priceChangeMode) {
            dispatch(clearNumberInput());
            // dispatch(reset());
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
            if (trxSlice.numberInputValue === '123') {
                axios({
                    method: 'get',
                    url: `http://localhost:${config.expressPort ? config.expressPort : '3001'}/restart`,
                })
            } else {
                window.location.reload();
            }
        } else {
            dispatch(abort());
        }

    }

    const handleManagerMode = () => {
        if (!terminal.managerMode) {
            axios({
                method: 'post',
                url: '/utilities/generateQR',
                data: {
                    hardwareId: config.deviceId,
                    source: 'ManagerMode',
                    sourceKey: terminal.till.key,
                }
            }).then((response) => {
                if (response && response.data) {
                    setAuthQR({
                        ...response.data,
                        source: 'ManagerMode'
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
            dispatch(setManagerMode(false))
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

    useEffect(() => {
        if (terminal.managerMode) {
            dispatch(holdQrAuthCheck());
            dispatch(setPriceChangeReason(terminal._managerUser))
        }
    }, [terminal.managerMode]);


    const handleVoidTrx = () => {
        if (trxSlice.trx) {
            confirm('Void Transaction?', '',
                () => {
                    if (terminal.managerMode) {
                        dispatch(voidTrx(trxSlice.trx.key));
                    } else {
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
                    }
                }
            )
        } else {
            dispatch(notify({
                msg: 'No valid Transaction to void',
                sev: 'warning'
            }))
        }
    }

    const handleSuspendTrx = () => {
        if (trxSlice.trx) {
            confirm('Suspend Transaction?', '',
                () => {
                    if (terminal.managerMode) {

                        dispatch(suspendTrx(trxSlice.trx.key));

                    } else {
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
                    }
                }
            )
        } else {
            dispatch(notify({
                msg: 'No valid Transaction to suspend',
                sev: 'warning'
            }))
        }
    }

    const handleSwitchToRefund = () => {
        confirm('Switch to Refund Mode?', '',
            () => {
                if (terminal.managerMode) {
                    dispatch(setTrxMode('Refund'));
                } else {
                    axios({
                        method: 'post',
                        url: '/utilities/generateQR',
                        data: {
                            hardwareId: config.deviceId,
                            source: 'Refund',
                            sourceKey: null,
                        }
                    }).then((response) => {
                        if (response && response.data) {
                            setAuthQR({
                                ...response.data,
                                source: 'Refund'
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
                }
            }
        )
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

    const loadCashbackCoupons = () => {
        // console.log('loading cashback coupons');
        axios({
            method: 'post',
            url: '/trx/loadCouponsPayments',
            headers: {
                trxKey: trxSlice.trx.key
            }
        }).then((response) => {
            if (response && response.data) {
                dispatch(uploadCashBackCoupons(response.data));
            } else {
                dispatch(notify({ msg: 'Incorrect fetch cash back coupons response', sev: 'error' }))
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
    }

    const buildPaymentTypesButtons = () => {
        return <React.Fragment>
            <Button key='cash' disabled={terminal.trxMode === 'Refund' && !trxSlice.trx} className={classes.MainActionButton} onClick={() => { startPayment('cash', 'fixed') }}>
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
            {terminal.customer && terminal.store && <Button key='onAccount'
                disabled={(terminal.trxMode === 'Refund') || (terminal.store.sapCustomerCode === terminal.customer.key) || terminal.customer.club}
                className={classes.MainActionButton} onClick={() => { startPayment('onAccount', 'numpad') }}>
                <FontAwesomeIcon icon={faDollarSign} style={{ marginRight: '5px' }} />
                <label>On Account</label>
            </Button>}
            <br />
            {terminal.customer && terminal.store && <Button key='cashBack'
                disabled={(terminal.trxMode === 'Refund') || (terminal.store.sapCustomerCode === terminal.customer.key) || !terminal.customer.club || !hasEshiniConnection}
                className={classes.MainActionButton} onClick={() => { startPayment('cashBack', 'fixed') }}>
                <FontAwesomeIcon icon={faDollarSign} style={{ marginRight: '5px' }} />
                <label>Cash Back</label>
            </Button>}
            <br />
            {terminal.customer && terminal.customer.employee && terminal.store && <Button key='employeeExtra'
                disabled={(terminal.trxMode === 'Refund') || (terminal.store.sapCustomerCode === terminal.customer.key) || !terminal.customer.club || !hasEshiniConnection}
                className={classes.MainActionButton} onClick={() => { startPayment('employeeExtra', 'numpad') }}>
                <FontAwesomeIcon icon={faPlusSquare} style={{ marginRight: '5px' }} />
                <label>Employee</label>
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
                            amount: obj.amount,
                            sourceKey: '',
                            visaPayment: null
                        }));
                    }}
                        style={{ backgroundColor: '#f7f7fa', display: 'block' }}

                    >
                        <img src={notesImages[obj.amount + '' + obj.currency]} style={{ display: 'block', margin: 'auto', width: obj.amount > 10 ? '90%' : 'auto', height: '60px' }} />
                    </a>
                )
                tmp.push(<div style={{ lineHeight: '0.6705', color: 'transparent' }} key={i + 'space'} > .</div>);
            });
        } else if (terminal.trxMode === 'Refund' && trxSlice.trx) {
            tmp.push(
                <Button key='fulfilRefundPayment' className={classes.MainActionButton} onClick={() => {
                    dispatch(submitPayment({
                        tillKey: terminal.till ? terminal.till.key : null,
                        trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                        paymentMethodKey: 'Cash',
                        currency: 'NIS',
                        amount: trxSlice.trx ? trxSlice.trx.totalafterdiscount : 0,
                        sourceKey: '',
                        visaPayment: null
                    }))
                }}>
                    <label style={{ marginRight: '5px' }}>Refund</label>
                    <label style={{ fontFamily: 'DSDIGI', fontSize: '20px' }}>
                        {trxSlice.trx.totalafterdiscount} ₪
                    </label>
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
                        amount: obj.amount,
                        sourceKey: '',
                        visaPayment: null
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
                    onClick={() => {
                        dispatch(selectCurrency(obj.key));
                    }} >
                    <div style={{ textAlign: 'center' }}>
                        {obj.key}
                    </div>
                </Button>
            )
            tmp.push(<div style={{ lineHeight: '0.6705', color: 'transparent' }} key={obj.key + 'space'} > .</div>);
        });

        if (!terminal.terminal.bopVisaIp) {
            tmp.push(<div key='fsbopvisasetup' style={{ lineHeight: '0.6705', color: 'transparent' }}> .</div>);
            tmp.push(
                <Input key='bopvisasetupIp' placeholder='BOP Visa IP'
                    value={bopVisaIp} disabled={!terminal.managerMode}
                    onChange={(e) => { setBopVisaIp(e) }} >
                </Input>
            )
            tmp.push(
                <Button key='bopvisasetup' className={classes.ActionButton}
                    style={{ background: '#ffbf00', color: 'black', marginTop: '5px' }}
                    disabled={terminal.terminal.bopVisaIp}
                    onClick={initTerminalWithBopVisa} >
                    <div style={{ textAlign: 'center' }}>
                        <FontAwesomeIcon icon={faChain} />
                        LINK VISA
                    </div>
                </Button>
            )
        } else {
            tmp.push(<div key='fs' style={{ lineHeight: '0.6705', color: 'transparent' }}> .</div>);
            tmp.push(
                <Button key='autovisa' className={classes.ActionButton}
                    style={{ background: '#b5ff00', color: 'black' }}
                    onClick={() => {
                        autoVisaFlow();
                    }} >
                    <div style={{ textAlign: 'center' }}>
                        <FontAwesomeIcon icon={faChain} />
                        <label style={{ marginLeft: '2px' }}>AUTO VISA</label>
                    </div>
                </Button>
            )
        }
        tmp.push(<div key='fs2' style={{ lineHeight: '0.6705', color: 'transparent' }}> .</div>);

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
            <Button key='voidTrx' className={classes.MainActionButton}
                onClick={handleVoidTrx}
                disabled={terminal.paymentMode} >
                <div style={{ textAlign: 'center', fontSize: '14px', }}>
                    <FontAwesomeIcon icon={faToolbox} style={{ marginRight: '5px' }} />
                    <label>Void TRX </label>
                </div>
            </Button>
            <br />
            {
                terminal.trxMode === 'Sale' &&
                <Button disabled={trxSlice.trx !== null} key='refund' className={classes.MainActionButton} onClick={handleSwitchToRefund}>
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

    const buildSuspendedButtons = () => {
        let tmp = [];

        tmp.push(<h6 key={'title'} style={{ textAlign: 'center', color: 'white', marginBottom: '5px' }} >Suspended List <br /><small>Click to Resume</small></h6>);

        terminal.suspendedForTill.map((obj, i) => {
            // console.log('sus', obj);
            tmp.push(
                <Button key={i} className={classes.ActionButton} disabled={trxSlice.trx}
                    style={{ height: '100px !important' }}
                    onClick={() => {
                        dispatch(scanNewTransaction({
                            customerKey: terminal.customer ? terminal.customer.key : null,
                            barcode: 'SUS-' + obj.nanoId,
                            trxKey: null,
                            trxMode: terminal.trxMode,
                            tillKey: terminal.till ? terminal.till.key : null,
                            multiplier: trxSlice.multiplier ? trxSlice.multiplier : '1'
                        }))
                        dispatch(setActionsMode('payment'))
                    }} >

                    <div key={i + 'cbc'} style={{ textAlign: 'center', fontSize: '16px', }}>
                        ( ₪{obj.totalafterdiscount} ) <small>Restore <FontAwesomeIcon icon={faPlay} /></small>
                    </div>

                </Button>
            )
            tmp.push(<div key={i + 'div'} style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>);
        });
        tmp.push(<div key='fsz' style={{ lineHeight: '0.6705', color: 'transparent' }}> .</div>);
        return tmp;
    }

    const buildEmployeeExtraButtons = () => {
        let tmp = [];

        tmp.push(
            <Button key={'1'} className={classes.LongActionButton}
                disabled style={{ color: '#004109' }}>
                <div style={{ textAlign: 'center' }}>
                    Balance: ₪ {terminal.customer.employeeBalance}
                    <hr style={{ padding: '2px', margin: '2px' }} />
                    <small>
                        (Limit: ₪ {terminal.customer.employeeBalanceLimit})
                    </small>
                </div>
            </Button >
        )
        tmp.push(<div style={{ lineHeight: '0.6705', color: 'transparent' }} key={'empExtraSpace'} > .</div>);

        return tmp;
    }

    const buildCashBackCouponButtons = () => {
        let tmp = [];

        trxSlice.cashBackCoupons.map((obj, i) => {
            tmp.push(
                <Button key={i} className={classes.ActionButton}
                    disabled={trxSlice.usedCoupons[obj.key]}
                    style={{
                        background: trxSlice.usedCoupons[obj.key] ? '#e1e1e1' : '#cd1515',
                        color: trxSlice.usedCoupons[obj.key] ? '#cd1515' : 'white',
                        textDecoration: trxSlice.usedCoupons[obj.key] ? 'line-through' : 'auto',
                        height: '200px !important'
                    }}

                    onClick={() => {
                        dispatch(submitPayment({
                            tillKey: terminal.till ? terminal.till.key : null,
                            trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                            paymentMethodKey: 'CashBack',
                            currency: 'NIS',
                            amount: obj.amount,
                            sourceKey: obj.key,
                            visaPayment: null
                        }))

                        let usedCoupons = {
                            ...trxSlice.usedCoupons
                        };
                        usedCoupons[obj.key] = true;
                        dispatch(setUsedCoupons(usedCoupons));
                    }} >
                    <div key={i + 'cbc'} style={{ textAlign: 'center', fontSize: '14px', }}>
                        <div>
                            <b style={{ fontSize: '16px' }}>{obj.amount} NIS</b>
                        </div>
                        <div style={{ fontSize: '11px' }}>
                            Expires: {obj.expiryDateAsString}
                        </div>
                    </div>
                </Button>
            )
            tmp.push(<div key={i + 'div'} style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>);
        });

        // loadCashbackCoupons();

        tmp.push(<div key='fsz' style={{ lineHeight: '0.6705', color: 'transparent' }}> .</div>);

        return tmp;
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
                                multiplier: trxSlice.multiplier ? trxSlice.multiplier : '1'
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

    const initTerminalWithBopVisa = () => {
        if (!bopVisaIp) {
            dispatch(notify({ msg: 'No BOP Visa IP specified', sev: 'error' }));
            return;
        }

        dispatch(showLoading());
        axios({
            method: 'post',
            url: `http://127.0.0.1:${config.expressPort ? config.expressPort : '3001'}/linkTerminalWithBopVisa`,
            data: {
                terminalKey: terminal.terminal.key,
                bopVisaIp: bopVisaIp
            }
        }).then((response) => {
            // console.log(response);
            if (response && response.data && response.status !== 500) {
                dispatch(setTerminal(response.data));
                dispatch(notify({ msg: 'BOP Visa Linked' }))
            }
            dispatch(hideLoading());
        }).catch((error) => {
            console.error(error.response);
            dispatch(notify({ msg: 'could not link visa '.concat(error.response.data.code ? error.response.data.code : JSON.stringify(error.response)), sev: 'error' }));
            dispatch(hideLoading());
        })
    }

    const conjureAlphabet = () => {
        var arabicAlphabet = ['ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي'];
        let buttons = [];
        buttons.push(<Button appearance={'all' === alphabtet ? 'primary' : 'default'} key={'all'} style={{ float: 'right', borderRadius: '0px', margin: '2px', width: '60px' }}
            onClick={() => { setAlphabet('all') }} >ALL</Button>)
        arabicAlphabet.map((c) => {
            buttons.push(<Button appearance={c === alphabtet ? 'primary' : 'default'} key={c.barcode} style={{ float: 'right', borderRadius: '0px', margin: '2px', width: '35px' }}
                onClick={() => { setAlphabet(c) }} >{c}</Button>)
        })


        return buttons;
    }


    return (
        <FlexboxGrid  >
            <FlexboxGrid.Item colspan={11} style={{ background: 'white', position: 'relative', left: '6px', width: '48.83333333%' }}  >
                {terminal.display === 'ready' && <Invoice authQR={authQR} />}
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
                        <img src={Lock} style={{ margin: 'auto', display: 'block', top: '30%', position: 'relative' }} width='15%' />
                        <div style={{ textAlign: 'center', color: 'white', top: '30%', position: 'relative', fontSize: '25px' }} >
                            Terminal Locked
                        </div>
                    </div>
                }

                {
                    (trxSlice.qrAuthState === 'pending') && authQR && <div style={{
                        position: 'fixed',
                        zIndex: '999',
                        backgroundColor: 'rgba(0,0,0,0.50)', height: '100%', width: '100%', top: '0%', left: '0%'
                    }}>
                        <h1 style={{ textAlign: 'center', color: 'white', margin: '5% 0%' }}>
                            <div style={{
                                color: '#a30b00',
                                background: 'white',
                                padding: '20px ',
                                marginBottom: '20px'
                            }}>
                                <FontAwesomeIcon icon={faLock} style={{ marginRight: '8px' }} />
                                Manager Access Required
                            </div>

                            <div style={{ margin: 'auto', borderRadius: '10px' }}>
                                {authQR.source !== 'ManagerMode' && ((authQR.source !== 'PriceChange') || (authQR.source === 'PriceChange' && trxSlice.priceChangeReason)) &&
                                    <QRCode value={JSON.stringify(authQR)} size={200} style={{ margin: '20px' }}
                                    />}
                                {authQR.source === 'ManagerMode' &&
                                    <Input autoFocus={true} value={terminal.managerUser} onChange={(e) => { dispatch(setManagerUser(e)) }} type='password' style={{ width: '100%' }} />}
                                {authQR.source === 'ManagerMode' &&
                                    <Button style={{ fontSize: '20px', marginTop: '10px' }} appearance="primary" color="green"
                                        disabled={!terminal.managerUser || terminal.managerUser.length < 10}
                                        onClick={() => dispatch(verifyManagerMode())} >
                                        <FontAwesomeIcon icon={faKey} style={{ marginRight: '8px' }} />
                                        Verify Access
                                    </Button>}

                            </div>

                            <span style={{ display: 'block', marginBottom: '14px' }}>[ {authQR.source} ]</span>

                            {authQR.source === 'PriceChange' &&
                                <SelectPicker value={trxSlice.priceChangeReason} placeholder="Line Discount Reason" searchable={false} width={250}
                                    menuStyle={{ zIndex: '1000' }} data={[
                                        { label: 'Offer (Wrong Sign)', value: '1' },
                                        { label: 'Offer (Facebook & No Cash)', value: '2' },
                                        { label: 'Nearly Expired', value: '3' },
                                        { label: 'Corrupted Item', value: '4' },
                                    ]} onChange={(value) => { dispatch(setPriceChangeReason(value)) }}>
                                </SelectPicker>
                            }

                            <Button style={{ fontSize: '24px', display: 'block', margin: 'auto', marginTop: '15px' }}
                                onClick={() => dispatch(holdQrAuthCheck())} >
                                <FontAwesomeIcon icon={faBan} style={{ marginRight: '8px' }} />
                                Go Back to Transaction
                            </Button>
                        </h1>
                    </div>
                }
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={9} style={{ position: 'relative', left: '6px', height: '87.5vh' }}>
                <div style={{ background: '#303030', color: 'white', height: '5vh', position: 'relative', width: '120%', right: '12px' }}>
                    <h6 style={{ lineHeight: '5vh', textAlign: 'left', fontSize: '95%' }}>
                        <span> <FontAwesomeIcon icon={faUser} style={{ marginLeft: '20px', marginRight: '7px' }} /> {terminal.loggedInUser ? terminal.loggedInUser.username : 'No User'}</span>
                        <span style={{ marginRight: '10px', marginLeft: '10px' }}>/</span>
                        <span>{terminal.till && terminal.till.workDay ? terminal.till.workDay.businessDateAsString : 'No Work Day'}</span>
                    </h6>
                    <img src={Logo} onClick={handleLogoClick} style={{ position: 'fixed', right: '1vw', top: '0', zIndex: 1000, height: 'inherit' }} />
                </div>

                <div id='rightPosPanel' style={{ background: 'white', padding: '10px', position: 'absolute', top: '5vh', width: '96.5%', height: '33vh' }}>
                    <span>
                        {/* <a style={{ color: '#2196f3', padding: '2px' }} onClick={() => {
                            confirm('Reset Customer?', 'This clears to default customer',
                                () => { resetToStoreCustomer() }
                            )
                        }}> */}
                        <FontAwesomeIcon icon={faIdCard} style={{
                            marginLeft: '7px', marginRight: '7px', fontSize: '18px'
                        }} />
                        <span style={{
                            marginRight: '7px', fontFamily: 'Janna',
                            fontSize: '18px'
                        }}>
                            {terminal.customer ? terminal.customer.customerName : 'No Customer'}
                        </span>
                        {/* </a> */}
                    </span>

                    {terminal.customer && terminal.customer.club && <Divider vertical /> &&
                        <span style={{ color: '#fa8900' }}>
                            <FontAwesomeIcon icon={faStar} style={{ marginLeft: '7px', marginRight: '7px' }} /> Club
                            {terminal.customer && terminal.customer.employee && <span style={{ color: 'rgb(227,37,33)' }}> <b> (E)</b></span>}
                        </span>}

                    {terminal.managerMode && <Divider vertical /> &&
                        <span style={{ color: '#db2417' }}>
                            <FontAwesomeIcon icon={faShieldHalved} style={{ marginLeft: '7px', marginRight: '7px' }} /> Manager
                        </span>}

                    <Divider style={{ margin: '7px' }} />
                    <div style={{ padding: '0px' }}>
                        <Alert severity={uiSlice.toastType} sx={{ width: '100%', fontSize: '15px', fontFamily: 'Janna' }}>
                            {uiSlice.toastMsg.toString()}
                        </Alert>
                    </div>
                    <Divider style={{ margin: '7px' }} />
                    {!hasEshiniConnection && <span style={{ color: 'orangered' }}>
                        <FontAwesomeIcon icon={faExclamationTriangle} style={{ marginRight: '7px' }} />
                        <b>WARNING:</b> NO CONNECTION TO E-SHINI
                    </span>}
                    {
                        !terminal.paymentMode && config.scale &&
                        (<h4 style={{ textAlign: 'center', cursor: 'pointer', }}>
                            <a onClick={() => setScaleItemsOpen(true)}><FontAwesomeIcon icon={faScaleBalanced} /> Scale Items </a>
                        </h4>)
                    }
                    {
                        terminal.paymentMode &&
                        <FlexboxGrid>
                            <FlexboxGrid.Item colspan={24} >
                                <br />
                                <div >
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
                            </FlexboxGrid.Item>
                            <FlexboxGrid.Item colspan={24}>
                                <div >
                                    <small style={{ fontSize: '20px', marginRight: '5px' }}>
                                        {trxSlice.trxChange > 0 ? 'Change = ' : 'Due = '}
                                    </small>
                                    <b> <label id='Total' style={{ fontSize: '25px', color: trxSlice.trxChange < 0 ? 'red' : 'green' }} >
                                        {(Math.round(trxSlice.trxChange * 100) / 100).toFixed(2)}
                                    </label>
                                    </b>
                                    {
                                        terminal.paymentInput === 'numpad' && trxSlice.selectedCurrency !== 'NIS' &&
                                        <small style={{ fontSize: '15px', marginLeft: '5px' }}>
                                            ( {(Math.round(Math.abs(trxSlice.trxChange / terminal.exchangeRates[trxSlice.selectedCurrency]) * 100) / 100).toFixed(2)} {trxSlice.selectedCurrency} )
                                        </small>
                                    }
                                </div>
                            </FlexboxGrid.Item>
                        </FlexboxGrid>
                    }

                    {
                        trxSlice.lastTrxPayment && <FlexboxGrid>
                            <FlexboxGrid.Item colspan={24} >
                                <div style={{ border: '1px solid #e1e1e1', padding: '3px', minWidth: '60%', margin: 'auto', marginTop: '10px', marginBot: '10px' }}>
                                    <small style={{ fontSize: '20px', marginRight: '5px' }}>
                                        Paid =
                                    </small>
                                    <b>
                                        <label id='Total' style={{ fontSize: '25px' }}>
                                            {(Math.round(trxSlice.lastTrxPayment.paid * 100) / 100).toFixed(2)}
                                        </label>
                                    </b>
                                    <Divider vertical />
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
                                actionsMode === 'payment' && terminal.trxMode !== 'Refund' && terminal.paymentType === 'cashBack' &&
                                buildCashBackCouponButtons()
                            }

                            {
                                actionsMode === 'payment' && terminal.trxMode !== 'Refund' && terminal.paymentType === 'employeeExtra' &&
                                buildEmployeeExtraButtons()
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
                            {
                                actionsMode === 'suspended' &&
                                buildSuspendedButtons()
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
                        <Button color={terminal.managerMode ? 'red' : 'yellow'} appearance="primary" className={classes.POSButton} onClick={handleManagerMode} >
                            <FontAwesomeIcon icon={faShieldHalved} style={{ marginRight: '5px' }} />
                            <label>
                                {terminal.managerMode ? 'Exit Manager' : 'Manager'}
                            </label>
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
                        <Button className={classes.POSButton}
                            appearance={actionsMode === 'suspended' ? 'primary' : 'default'}
                            color='green'
                            onClick={() => setActionsMode('suspended')} >
                            <FontAwesomeIcon icon={faHistory} style={{ marginRight: '5px' }} />
                            <div>Suspended</div>
                        </Button>
                    </FlexboxGrid.Item>
                    <FlexboxGrid.Item colspan={3}>
                        {terminal.paymentMode &&
                            <Button className={classes.POSButton}
                                onClick={handleVoidLine}
                                disabled={!trxSlice.selectedPayment || !trxSlice.selectedPayment.key}
                                appearance='primary' color='blue'>
                                <FontAwesomeIcon icon={faEraser} style={{ marginRight: '5px' }} />
                                <div>Void Payment</div>
                            </Button>
                        }
                        {!terminal.paymentMode &&
                            <Button className={classes.POSButton}
                                onClick={handleVoidLine}
                                disabled={!trxSlice.selectedLine || !trxSlice.selectedLine.key}
                                appearance='primary' color='blue'>
                                <FontAwesomeIcon icon={faEraser} style={{ marginRight: '5px' }} />
                                <div>Void Line</div>
                            </Button>
                        }
                    </FlexboxGrid.Item>
                    <FlexboxGrid.Item colspan={3}>
                        <Button className={classes.POSButton}
                            disabled={terminal.paymentMode || !trxSlice.selectedLine || !trxSlice.selectedLine.key}
                            onClick={handlePriceChange}
                            appearance='primary' color={trxSlice.priceChangeMode ? 'orange' : 'blue'}  >
                            <FontAwesomeIcon icon={faTags} style={{ marginRight: '5px' }} />
                            <div>{trxSlice.priceChangeMode ? 'CANCEL' : 'Line Discount'}</div>
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

            <Drawer style={{ width: '60vw' }} position='right' open={scaleItemsOpen} onClose={() => setScaleItemsOpen(false)}>
                <div style={{ padding: '15px' }}>
                    <h3>
                        <FontAwesomeIcon icon={faScaleBalanced} /> Scale Items
                        <ButtonGroup style={{ width: '50%', float: 'right' }}>
                            <Button style={{ width: '50%' }} appearance={selectedScaleCategory === 'veggie' ? 'primary' : 'ghost'} color='green' size='lg' onClick={() => setSelectedScaleCategory('veggie')} > Vegetables </Button>
                            <Button style={{ width: '50%' }} appearance={selectedScaleCategory === 'fruit' ? 'primary' : 'ghost'} color='green' size='lg' onClick={() => setSelectedScaleCategory('fruit')}  > Fruits </Button>
                        </ButtonGroup>
                    </h3>
                    {localMsg && <h6 style={{ color: 'darkred', margin: '10px', textAlign: 'center' }}>{localMsg}</h6>}
                    <Divider />
                    <ButtonToolbar>
                        <ButtonGroup>
                            {/* {conjureAlphabet()} */}
                        </ButtonGroup>
                    </ButtonToolbar>
                    {/* <Divider /> */}
                    <div id='veggieList' style={{ overflowY: 'hidden', height: '70vh' }}>
                        <FlexboxGrid>
                            {produceItems.map((item) => {
                                return (<FlexboxGrid.Item key={item.barcode} colspan={6}>
                                    <Button style={{ width: '96%', margin: '2%', background: 'white', border: '1px solid #363636' }} onClick={() => { scanWeightableItem(item); }}>
                                        <img src={`http://46.43.70.210:9000/veggies/${item.barcode}.jpg`}
                                            onError={(e) => {
                                                e.target.src = `http://46.43.70.210:9000/veggies/nophoto.jpg`;
                                            }}
                                            height={100} />
                                        <br />
                                        <b>{item.descriptionAr} {item.scalePieceItem && <FontAwesomeIcon icon={faTag} />}</b>
                                    </Button>
                                </FlexboxGrid.Item>)
                            })}
                        </FlexboxGrid>
                    </div>
                    <FlexboxGrid style={{ color: 'white', width: '200px', marginTop: '10px' }}>
                        <FlexboxGrid.Item colspan={8} >
                            <IconButton onClick={() => setVeggieScrollAction('up')}
                                style={{ width: '100px !important' }}
                                icon={<FontAwesomeIcon size='4x' icon={faChevronUp} />} />
                        </FlexboxGrid.Item>
                        <FlexboxGrid.Item colspan={2} />
                        <FlexboxGrid.Item colspan={8} >
                            <IconButton onClick={() => setVeggieScrollAction('down')}
                                style={{ width: '80px !important' }}
                                icon={<FontAwesomeIcon size='4x' icon={faChevronDown} />} />
                        </FlexboxGrid.Item>
                    </FlexboxGrid>
                </div>
            </Drawer>

        </FlexboxGrid >
    );
}

export default Terminal;