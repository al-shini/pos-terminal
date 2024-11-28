import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux'
import axios from '../../axios';
import { Button, FlexboxGrid, Divider, Input, SelectPicker, Drawer, ButtonGroup, IconButton, ButtonToolbar, Grid, Row, Col, Panel, Modal } from 'rsuite';
import classes from './Terminal.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSackDollar, faMoneyBillTransfer, faRepeat, faUser, faScaleBalanced, faTag, faChevronUp, faChevronDown, faCogs,
    faCarrot, faToolbox, faShieldHalved, faMoneyBill, faIdCard, faTimes, faEraser, faBan, faPause, faRotateLeft, faDollarSign, faLock, faUnlock, faSearch, faStar, faChain, faHistory, faPlay, faPlusSquare, faTags, faKey, faExclamationTriangle, faList, faCheck
} from '@fortawesome/free-solid-svg-icons'
import Numpad from './Numpad';
import Invoice from './Invoice';
import Payments from './Payments';
import BalanceSetup from './BalanceSetup';
import terminalSlice, {
    beginPayment, uploadCurrencies, abort, exitNumpadEntry, reset,
    uploadCashButtons, setPaymentType, uploadForeignButtons, uploadPaymentMethods, uploadFastItems, setTrxMode, lockTill, unlockTill, uploadExchangeRates, setCustomer, setManagerMode, setTerminal, fetchSuspendedForTill, setManagerUser, verifyManagerMode,
    logout
} from '../../store/terminalSlice';
import {
    selectCurrency, submitPayment, clearNumberInput, scanBarcode, scanNewTransaction, setTrx,
    selectPaymentMethod, suspendTrx, enablePriceChange, disablePriceChange,
    checkOperationQrAuth, startQrAuthCheck, holdQrAuthCheck, voidTrx, voidPayment, voidLine, uploadCashBackCoupons, setUsedCoupons, rescanTrx, closeTrxPayment, clearLastPaymentHistory, setPriceChangeReason, prepareScanMultiplierPreDefined,
    fullTrxTaxExempt
} from '../../store/trxSlice';
import { hideLoading, notify, showLoading } from '../../store/uiSlice';
import FlexboxGridItem from 'rsuite/esm/FlexboxGrid/FlexboxGridItem';
import confirm from '../UI/ConfirmDlg';
import config from '../../config';
import errorBeep from '../../assets/error.wav';
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

import JOD_005 from '../../assets/money-notes/0.05JOD.jpg';
import JOD_010 from '../../assets/money-notes/0.10JOD.jpg';
import JOD_025 from '../../assets/money-notes/0.25JOD.jpg';
import JOD_05 from '../../assets/money-notes/0.5JOD.jpg';
import JOD_1 from '../../assets/money-notes/1.0JOD.jpg';
import JOD_5 from '../../assets/money-notes/5.0JOD.jpg';
import JOD_10 from '../../assets/money-notes/10.0JOD.jpg';
import JOD_20 from '../../assets/money-notes/20.0JOD.jpg';
import JOD_50 from '../../assets/money-notes/50.0JOD.jpg';

import EUR_1 from '../../assets/money-notes/1.0EUR.png';
import EUR_10 from '../../assets/money-notes/10.0EUR.png';

import USD_1 from '../../assets/money-notes/1.0USD.png';
import USD_20 from '../../assets/money-notes/20.0USD.png';
import USD_50 from '../../assets/money-notes/50.0USD.png';
import USD_100 from '../../assets/money-notes/100.0USD.png';

import Logo from '../../assets/full-logo.png';
import Lock from '../../assets/lock.png';
import { ArrowLeft, Funnel, IOs, Tmall } from '@rsuite/icons';
import InactivityHandler from '../InactivityHandler';
const { ipcRenderer } = window.require('electron');


// Import the images
const importAll = (requireContext) => requireContext.keys().reduce((acc, next) => {
    acc[next.replace('./', '')] = requireContext(next);
    return acc;
}, {});

const images = importAll(require.context('../../assets/produce_images', false, /\.(png|jpe?g|svg)$/));


const matchProduceCategory = (selectedScaleCategory, itemCategory) => {
    if (!itemCategory) return false;

    const normalizedCategory = itemCategory.toLowerCase();

    if (selectedScaleCategory === 'fruit') {
        return /fruit/i.test(normalizedCategory);
    } else if (selectedScaleCategory === 'vegetable') {
        return /vegetable/i.test(normalizedCategory);
    } else {
        return false;
    }
}



const Terminal = (props) => {
    const terminal = useSelector((state) => state.terminal);
    const trxSlice = useSelector((state) => state.trx);

    const [actionsMode, setActionsMode] = useState('payment');
    const [notesImages, setNotesImages] = useState([]);
    const [authQR, setAuthQR] = useState({});
    const [bopVisaIp, setBopVisaIp] = useState('');
    const [passkey, setPasskey] = useState('');
    const [play] = useSound(errorBeep);
    const [groupedFastItems, setGroupedFastItems] = useState({});
    const [selectedFGroup, setSelectedFGroup] = useState(null);
    const [hasEshiniConnection, setHasEshiniConnection] = useState(true);
    const [scaleItemsOpen, setScaleItemsOpen] = useState(false);
    const [scaleConnected, setScaleConnected] = useState(false);
    const [selectedScaleCategory, setSelectedScaleCategory] = useState('vegetable');
    const [produceItems, setProduceItems] = useState([]);
    const [alphabtet, setAlphabet] = useState('ا');
    const [settingsOpen, setSettingsOpen] = useState(false);

    const [trxCounter, setTrxCounter] = useState(0);

    const incrementTrxCount = () => {
        if (trxCounter == 9) {
            // 10th transaction closed, reload 
            dispatch(showLoading('Purging Cache'))
            window.location.reload();
        } else {
            setTrxCounter(trxCounter + 1);
        }
    }

    useEffect(() => {
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
        if (config.scale && !(produceItems.length > 0)) {
            axios({
                method: 'get',
                url: '/barcode/produceItems/',
            }).then((response) => {
                if (response) {
                    setProduceItems(response.data);
                }
            }).catch((error) => {
                dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
            });
        }
    }, [])




    const dispatch = useDispatch();

    /**  
     * basic/setup data initialization
     * */
    useEffect(() => {

        // initialize currency images
        let arr = [];
        // NIS
        arr['0.5NIS'] = NIS_05;
        arr['1NIS'] = NIS_1;
        arr['2NIS'] = NIS_2;
        arr['5NIS'] = NIS_5;
        arr['10NIS'] = NIS_10;
        arr['20NIS'] = NIS_20;
        arr['50NIS'] = NIS_50;
        arr['100NIS'] = NIS_100;
        arr['200NIS'] = NIS_200;

        // JOD
        arr['0.05JOD'] = JOD_005;
        arr['0.1JOD'] = JOD_010;
        arr['0.25JOD'] = JOD_025;
        arr['0.5JOD'] = JOD_05;
        arr['1JOD'] = JOD_1;
        arr['5JOD'] = JOD_5;
        arr['10JOD'] = JOD_10;
        arr['20JOD'] = JOD_20;
        arr['50JOD'] = JOD_50;

        // EUR
        arr['1EUR'] = EUR_1;
        arr['10EUR'] = EUR_10;

        // USD
        arr['1USD'] = USD_1;
        arr['20USD'] = USD_20;
        arr['50USD'] = USD_50;
        arr['100USD'] = USD_100;
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
                dispatch(selectCurrency(config.systemCurrency));
                // if (response.data.length > 0) {
                //     dispatch(selectCurrency(response.data[0].key))
                // } else {
                //     dispatch(notify({ msg: 'No currencies found', sev: 'error' }))
                // }
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
                rates[config.systemCurrency] = 1;

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

        checkScalePortConnection();

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


    function formatDouble(number) {
        console.log('number passed to format: ', number);
        let formattedNumber = number + '';

        // Split the number into whole part and decimal part
        let parts = formattedNumber.split('.');
        let wholePart = parts[0];
        let decimalPart = parts[1];

        // Pad the whole part with leading zeros if needed
        while (wholePart.length < 2) {
            wholePart = '0' + wholePart;
        }
        if (wholePart.length === 3) {
            wholePart = wholePart.substr(1)
        }

        // Combine the parts and remove the decimal point
        formattedNumber = wholePart + decimalPart;

        return formattedNumber;
    }



    /* [START] Scale utilities */

    const openScalePort = () => {
        if (config.scale && !scaleConnected) {
            axios({
                method: 'get',
                url: `http://localhost:${config.expressPort ? config.expressPort : '3001'}/openScalePort`,
            }).then((response) => {
                dispatch(notify({ msg: 'Scale port opened', sev: 'info' }));
                setScaleConnected(true);
            }).catch((error) => {
                dispatch(notify({ msg: 'Could not open scale port', sev: 'error' }));
                setScaleConnected(false);
            }).finally(() => {
                dispatch(hideLoading());
            })
        }
    }

    const closeScalePort = () => {
        if (config.scale && scaleConnected) {
            axios({
                method: 'get',
                url: `http://localhost:${config.expressPort ? config.expressPort : '3001'}/closeScalePort`,
            }).then((response) => {
                dispatch(notify({ msg: 'Scale port closed', sev: 'info' }));
                setScaleConnected(false);
                setScaleItemsOpen(false);
            }).catch((error) => {
                dispatch(notify({ msg: 'Could not close scale port', sev: 'error' }));
            }).finally(() => {
                dispatch(hideLoading());
            })
        }
    }

    const checkScalePortConnection = () => {
        if (config.scale) {
            axios({
                method: 'get',
                url: `http://localhost:${config.expressPort ? config.expressPort : '3001'}/isScaleConnected`,
            }).then((response) => {
                dispatch(notify({ msg: 'Scale port is open', sev: 'info' }));
                setScaleConnected(true);
            }).catch((error) => {
                dispatch(notify({ msg: 'Scale port is not open', sev: 'error' }));
                setScaleConnected(false);
                // attempt to open scale port after 0.5 seconds
                window.setTimeout(openScalePort, 500);
            }).finally(() => {
                dispatch(hideLoading());
            })
        }
    }

    const zeroScale = () => {
        if (config.scale && scaleConnected) {
            axios({
                method: 'get',
                url: `http://localhost:${config.expressPort ? config.expressPort : '3001'}/zeroScale`,
            }).then((response) => {
                dispatch(notify({ msg: 'Scale zero command sent', sev: 'info' }));
                setScaleConnected(true);
            }).catch((error) => {
                dispatch(notify({ msg: 'Scale zero command failed', sev: 'error' }));
                setScaleConnected(false);
            }).finally(() => {
                dispatch(hideLoading());
            })
        }
    }

    const restartScale = () => {
        if (config.scale && scaleConnected) {
            axios({
                method: 'get',
                url: `http://localhost:${config.expressPort ? config.expressPort : '3001'}/restartScale`,
            }).then((response) => {
                dispatch(notify({ msg: 'Scale restart command sent', sev: 'info' }));
                setSettingsOpen(false);
            }).catch((error) => {
                dispatch(notify({ msg: 'Scale restart command failed', sev: 'error' }));
            }).finally(() => {
                dispatch(hideLoading());
            })
        }
    }

    const scanWeightableItem = (item) => {
        dispatch(showLoading({ msg: 'Fetching weight from scale' }));
        let barcode = item.barcode;

        if (item.isScalePiece) {
            let _multi = trxSlice.multiplier ? trxSlice.multiplier : '1';
            let _barcode = 'SQ'.concat(barcode);
            if (trxSlice.trx && trxSlice.trx.key) {
                dispatch(scanBarcode({
                    customerKey: terminal.customer ? terminal.customer.key : null,
                    barcode: _barcode,
                    trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                    trxMode: terminal.trxMode,
                    tillKey: terminal.till ? terminal.till.key : null,
                    multiplier: _multi
                }))
            } else {
                dispatch(scanNewTransaction({
                    customerKey: terminal.customer ? terminal.customer.key : null,
                    barcode: _barcode,
                    trxKey: null,
                    trxMode: terminal.trxMode,
                    tillKey: terminal.till ? terminal.till.key : null,
                    multiplier: _multi
                }))
            }
            dispatch(hideLoading());
            setScaleItemsOpen(false);
        } else {
            axios({
                method: 'get',
                url: `http://localhost:${config.expressPort ? config.expressPort : '3001'}/weightScale`,
            }).then((response) => {
                let qty = response.data;
                if (qty > 0.0) {
                    setScaleItemsOpen(false);
                    if (trxSlice.trx && trxSlice.trx.key) {
                        dispatch(scanBarcode({
                            customerKey: terminal.customer ? terminal.customer.key : null,
                            barcode: '61'.concat(barcode).concat(formatDouble(qty)).concat('1'),
                            trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                            trxMode: terminal.trxMode,
                            tillKey: terminal.till ? terminal.till.key : null,
                            multiplier: qty
                        }))
                    } else {
                        dispatch(scanNewTransaction({
                            customerKey: terminal.customer ? terminal.customer.key : null,
                            barcode: '61'.concat(barcode).concat(formatDouble(qty)).concat('1'),
                            trxKey: null,
                            trxMode: terminal.trxMode,
                            tillKey: terminal.till ? terminal.till.key : null,
                            multiplier: qty
                        }))
                    }
                } else {
                    dispatch(notify({ msg: 'Please add item on scale first', sev: 'warning' }));
                }
            }).catch((error) => {
                console.error(error);
                dispatch(notify({ msg: 'could not fetch weight from scale', sev: 'error' }));
            }).finally(() => {
                dispatch(hideLoading());
            })
        }
    }

    /* [END] Scale utilities */


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
    }


    const autoVisaFlow = async () => {

        if (trxSlice.selectedCurrency === 'EUR') {
            dispatch(notify({ msg: 'Auto Visa does not support Euro', sev: 'warning' }));
            return;
        }

        if (trxSlice.selectedCurrency !== config.systemCurrency && !terminal.exchangeRates[trxSlice.selectedCurrency]) {
            dispatch(notify({ msg: 'Selected currency has no exchange rate defined', sev: 'error' }));
            return;
        }

        dispatch(showLoading('Connecting to Auto Visa [BANK OF PALESTINE]...'));

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
                    amt = (Math.round(Math.abs(trxSlice.trxChange / terminal.exchangeRates[trxSlice.selectedCurrency]) * 100) / 100).toFixed(config.systemCurrency === 'NIS' ? 2 : 3);
                    break;
                }
            }

            let integerPart = Math.floor(amt);
            let decimalPart = amt - integerPart;
            decimalPart = decimalPart.toFixed(config.systemCurrency === 'NIS' ? 2 : 3);

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

    const autoVisaFlowArabi = async () => {

        if (trxSlice.selectedCurrency === 'EUR') {
            dispatch(notify({ msg: 'Auto Visa does not support Euro', sev: 'warning' }));
            return;
        }

        if (trxSlice.selectedCurrency !== config.systemCurrency && !terminal.exchangeRates[trxSlice.selectedCurrency]) {
            dispatch(notify({ msg: 'Selected currency has no exchange rate defined', sev: 'error' }));
            return;
        }

        dispatch(showLoading('Connecting to Auto Visa [BANK OF PALESTINE]...'));

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
                    amt = (Math.round(Math.abs(trxSlice.trxChange / terminal.exchangeRates[trxSlice.selectedCurrency]) * 100) / 100).toFixed(config.systemCurrency === 'NIS' ? 2 : 3);
                    break;
                }
            }

            let integerPart = Math.floor(amt);
            let decimalPart = amt - integerPart;
            decimalPart = decimalPart.toFixed(config.systemCurrency === 'NIS' ? 2 : 3);

            amt = integerPart * 100;
            amt += parseFloat(decimalPart) * 100;

            let trxId = trxSlice.trx.nanoId.replace('-', '');
            // implement ARABI BANK auto visa flow
            axios({
                method: 'post',
                data: {
                    id: trxId,
                    amt,
                    curr: cur
                },
                url: `http://127.0.0.1:9600/arabiVisaSale`
            }).then((response) => {
                try {
                    let makePayment = false;

                    const badFormatData = response.data;
                    const responseDataAsString = badFormatData.split("{")[1].split("}")[0];
                    const responseData = JSON.parse("{" + responseDataAsString + "}");
                    console.log(responseData, responseData.RespCode);
                    if (responseData.RespCode === '-139') {
                    } else if (responseData.RespCode === '000') {
                        makePayment = true;
                    } else if (responseData.RespCode === '001') {
                        makePayment = true;
                    } else if (responseData.RespCode === '003') {
                        makePayment = true;
                    } else if (responseData.RespCode === '004') {
                        makePayment = true;
                    } else if (responseData.RespCode === '007') {
                        makePayment = true;
                    } else if (responseData.RespCode === '010') {
                        makePayment = true;
                    }

                    if (makePayment) {
                        dispatch(notify({ msg: responseData.RespDesc, sev: 'info' }));
                        const transactionAmountAsString = responseData.TransAmount;
                        const transactionAmount = parseFloat(transactionAmountAsString) / 100;

                        dispatch(submitPayment({
                            tillKey: terminal.till ? terminal.till.key : null,
                            trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                            paymentMethodKey: trxSlice.selectedPaymentMethod,
                            currency: trxSlice.selectedCurrency,
                            amount: transactionAmount,
                            sourceKey: 'AUTO VISA'
                        }))
                    }

                } catch (e) {
                    console.log(e);
                    dispatch(notify({ msg: 'could not parse response data object!', sev: 'error' }));
                }
                dispatch(hideLoading())
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
                dispatch(hideLoading())
            });

        } // end IF
    }

    const autoVisaFlowNetwork = async () => {

        // this is fixed to JOD only

        dispatch(showLoading('Connecting to Auto Visa [NETWORK]...'));

        let amt = Math.abs(trxSlice.trxChange);

        if (trxSlice.trx && amt > 0) {
            axios({
                method: 'post',
                data: {
                    id: trxSlice.trx.key,
                    ref: trxSlice.trx.key,
                    amt,
                    user: terminal.loggedInUser.employeeNumber,
                    username: terminal.loggedInUser.username,
                    curr: 400
                },
                url: `http://127.0.0.1:9600/arabiVisaSale`
            }).then((response) => {
                try {
                    if (response && response.data) {
                        let makePayment = false;

                        const responseData = response.data;
                        console.log(responseData, responseData.RespCode);
                        if (responseData.isApproved) {
                            makePayment = true;
                        }

                        if (makePayment) {
                            dispatch(notify({ msg: responseData.description, sev: 'info' }));
                            const transactionAmountAsString = responseData.amt;
                            const transactionAmount = parseFloat(transactionAmountAsString);

                            dispatch(submitPayment({
                                tillKey: terminal.till ? terminal.till.key : null,
                                trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                                paymentMethodKey: trxSlice.selectedPaymentMethod,
                                currency: trxSlice.selectedCurrency,
                                amount: transactionAmount,
                                sourceKey: 'NI-AUTOVISA-' + responseData.rrn
                            }))
                        } else {
                            if (responseData.description) {
                                dispatch(notify({ msg: responseData.description, sev: 'warning' }));
                            } else {
                                dispatch(notify({ msg: 'payment failed, please try again', sev: 'error' }));
                            }
                        }
                    }
                } catch (e) {
                    console.log(e);
                    dispatch(notify({ msg: 'could not parse response data object!', sev: 'error' }));
                }
                dispatch(hideLoading())
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
                dispatch(hideLoading())
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
                                        creator: terminal.loggedInUser.key
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
                                        creator: terminal.loggedInUser.key
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
                        creator: terminal.loggedInUser.key
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
                // window.location.reload();
            }
        } else {
            dispatch(abort());
        }

    }

    const handleManagerMode = () => {
        if (!terminal.managerMode && passkey === 'NotBane@4994') {
            dispatch(setManagerMode(true))
            setPasskey('');
        } else if (!terminal.managerMode && passkey !== 'NotBane@4994') {
            dispatch(setManagerMode(false))
            alert('Wrong admin passkey, this incident has been logged.')
        } else if (terminal.managerMode) {
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
                                creator: terminal.loggedInUser.key
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
                                creator: terminal.loggedInUser.key
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
        confirm(`Refund Mode ?`, '',
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
                            creator: terminal.loggedInUser.key
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

    const handleFUllTaxExempt = () => {
        if (terminal.till) {
            if (terminal.till.status === 'O') {
                if (terminal.managerMode) {
                    dispatch(fullTrxTaxExempt());
                } else {
                    confirm('Apply Tax Exempt?', 'This cannot be undone',
                        () => {
                            axios({
                                method: 'post',
                                url: '/utilities/generateQR',
                                data: {
                                    hardwareId: config.deviceId,
                                    source: 'Full-Tax-Discount',
                                    sourceKey: terminal.terminal.tillKey,
                                    creator: terminal.loggedInUser.key
                                }
                            }).then((response) => {
                                if (response && response.data) {
                                    setAuthQR({
                                        ...response.data,
                                        source: 'Full-Tax-Discount'
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
                    )
                }
            } else {
                dispatch(notify({
                    msg: 'Till cannot be locked, till not open',
                    sev: 'warning'
                }))
            }

        }
    }

    const handleLogout = () => {
        dispatch(logout());
    }

    const handleUnlockTill = () => {
        if (terminal.till) {

            if (terminal.till.status === 'L') {
                axios({
                    method: 'post',
                    url: '/utilities/generateQR',
                    data: {
                        hardwareId: config.deviceId,
                        source: 'UnlockTill',
                        sourceKey: terminal.till.key,
                        creator: terminal.loggedInUser.key,

                    }
                }).then((response) => {
                    if (response && response.data) {
                        setAuthQR({
                            ...response.data,
                            source: 'UnlockTill'
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
            <Button key='cash' disabled={!trxSlice.trx} className={classes.MainActionButton} onClick={() => { startPayment('cash', 'fixed') }}>
                <FontAwesomeIcon icon={faMoneyBill} style={{ marginRight: '5px' }} />
                <label>Cash</label>
            </Button>
            <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            <Button key='foregin' disabled={terminal.trxMode === 'Refund' || !trxSlice.trx} className={classes.MainActionButton} onClick={() => { startPayment('foreign', 'numpad') }}>
                <FontAwesomeIcon icon={faMoneyBillTransfer} style={{ marginRight: '5px' }} />
                <label>Currency</label>
            </Button>
            <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            <Button key='visa' disabled={terminal.trxMode === 'Refund' || !trxSlice.trx} className={classes.MainActionButton}
                onClick={() => { startPayment('visa', 'numpad') }}>
                <FontAwesomeIcon icon={faIdCard} style={{ marginRight: '5px' }} />
                <label>Visa</label>
            </Button>
            {/* <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            <Button key='visa' disabled={terminal.trxMode === 'Refund' || !trxSlice.trx} className={classes.MainActionButton}
                style={{ background: '#b32572', color: 'white' }}
                onClick={() => { startPayment('visa', 'numpad') }}>
                <FontAwesomeIcon icon={faIdCard} style={{ marginRight: '5px' }} />
                <label>Visa (BOP)</label>
            </Button>
            <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            <Button key='visaArabi' disabled={terminal.trxMode === 'Refund' || !trxSlice.trx} className={classes.MainActionButton}
                style={{ background: '#015aab', color: 'white' }}
                onClick={() => { startPayment('visaArabi', 'numpad') }}>
                <FontAwesomeIcon icon={faIdCard} style={{ marginRight: '5px' }} />
                <label>Visa (ARABI)</label>
            </Button> */}
            {/* <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            <Button key='jawwalPay' disabled={terminal.trxMode === 'Refund' || !trxSlice.trx} className={classes.MainActionButton} onClick={() => { startPayment('jawwalPay', 'numpad') }}>
                <FontAwesomeIcon icon={faDollarSign} style={{ marginRight: '5px' }} />
                <label>Jawwal Pay</label>
            </Button> */}
            <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            <Button key='voucher' disabled={terminal.trxMode === 'Refund' || !trxSlice.trx} className={classes.MainActionButton} onClick={() => { startPayment('voucher', 'numpad') }}>
                <FontAwesomeIcon icon={faDollarSign} style={{ marginRight: '5px' }} />
                <label>Voucher</label>
            </Button>
            <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            {terminal.customer && terminal.store && <Button key='onAccount'
                disabled={(terminal.trxMode === 'Refund') || (terminal.store.sapCustomerCode === terminal.customer.key) || terminal.customer.club || !trxSlice.trx}
                className={classes.MainActionButton} onClick={() => { startPayment('onAccount', 'numpad') }}>
                <FontAwesomeIcon icon={faDollarSign} style={{ marginRight: '5px' }} />
                <label>On Account</label>
            </Button>}
            <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            {terminal.customer && terminal.store && <Button key='cashBack'
                disabled={(terminal.trxMode === 'Refund') || (terminal.store.sapCustomerCode === terminal.customer.key) || !terminal.customer.club || !hasEshiniConnection || !trxSlice.trx}
                className={classes.MainActionButton} onClick={() => { startPayment('cashBack', 'fixed') }}>
                <FontAwesomeIcon icon={faDollarSign} style={{ marginRight: '5px' }} />
                <label>Cash Back</label>
            </Button>}
            <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            {terminal.customer && terminal.customer.employee && terminal.store && <Button key='employeeExtra'
                disabled={(terminal.trxMode === 'Refund') || (terminal.store.sapCustomerCode === terminal.customer.key) || !terminal.customer.club || !hasEshiniConnection || !trxSlice.trx}
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
                        currency: config.systemCurrency,
                        amount: trxSlice.trx ? trxSlice.trx.totalafterdiscount : 0,
                        sourceKey: '',
                        visaPayment: null
                    }))
                }}>
                    <label style={{ marginRight: '5px' }}>Refund</label>
                    <label style={{ fontFamily: 'DSDIGI', fontSize: '20px' }}>
                        {trxSlice.trx.totalafterdiscount} {config.systemCurrency === 'NIS' ? '₪' : 'JD'}
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
            const currButton = <Button key={i} className={classes.ActionButton}
                appearance={obj.key === trxSlice.selectedCurrency ? 'primary' : 'default'}
                onClick={() => {
                    dispatch(selectCurrency(obj.key));
                }} >
                <div style={{ textAlign: 'center' }}>
                    {obj.key}
                </div>
            </Button>;
            if (config.systemCurrency === 'JOD') {
                if (obj.key === config.systemCurrency) {
                    tmp.push(currButton);
                }
            } else {
                tmp.push(currButton);
            }

            tmp.push(<div style={{ lineHeight: '0.6705', color: 'transparent' }} key={obj.key + 'space'} > .</div>);
        });

        tmp.push(
            <Button key='autovisa' className={classes.ActionButton}
                style={{ background: '#b32572', color: 'white' }}
                onClick={() => {
                    autoVisaFlowNetwork();
                }} >
                <div style={{ textAlign: 'center' }}>
                    <FontAwesomeIcon icon={faChain} />
                    <label style={{ marginLeft: '2px' }}>AUTO VISA</label>
                </div>
            </Button>
        )
        tmp.push(<div key='fs2' style={{ lineHeight: '0.6705', color: 'transparent' }}> .</div>);


        return tmp;
    }

    const buildVisaButtonsArabi = () => {
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

        tmp.push(
            <Button key='autovisa_arabi' className={classes.ActionButton}
                disabled={!terminal.terminal.bopVisaIp}
                style={{ background: '#015aab', color: 'white' }}
                onClick={() => {
                    autoVisaFlowArabi();
                }} >
                <div style={{ textAlign: 'center' }}>
                    <FontAwesomeIcon icon={faChain} />
                    <label style={{ marginLeft: '2px' }}>AUTO - ARABI</label>
                </div>
            </Button>
        )
        tmp.push(<div key='fs3' style={{ lineHeight: '0.6705', color: 'transparent' }}> .</div>);

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
            <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            <Button key='voidTrx' className={classes.MainActionButton}
                onClick={handleVoidTrx}
                disabled={terminal.paymentMode} >
                <div style={{ textAlign: 'center', fontSize: '14px', }}>
                    <FontAwesomeIcon icon={faToolbox} style={{ marginRight: '5px' }} />
                    <label>Void TRX </label>
                </div>
            </Button>
            <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
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
            <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
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
            {
                terminal.till && terminal.till.status === 'L' &&
                <Button key='logout' style={{ zIndex: '1000' }} className={classes.MainActionButton} onClick={handleLogout}>
                    <div style={{ textAlign: 'center', fontSize: '14px', }}>
                        <FontAwesomeIcon icon={faUnlock} style={{ marginRight: '5px' }} />
                        <label>Sign Out</label>
                    </div>
                </Button>
            }
            <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            {
                <Button key='fullTaxExempt' className={classes.MainActionButton} onClick={handleFUllTaxExempt}>
                    <div style={{ textAlign: 'center', fontSize: '14px', }}>
                        <FontAwesomeIcon icon={faMoneyBillTransfer} style={{ marginRight: '5px' }} />
                        <label>Full Tax Exempt</label>
                    </div>
                </Button>
            }
            <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            {
                <Button key='settings' className={classes.MainActionButton} onClick={() => setSettingsOpen(true)}>
                    <div style={{ textAlign: 'center', fontSize: '14px', }}>
                        <FontAwesomeIcon icon={faCogs} style={{ marginRight: '5px' }} />
                        <label>Settings</label>
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
                        ( {config.systemCurrency === 'NIS' ? '₪' : 'JD'} {obj.totalafterdiscount} ) <small>Restore <FontAwesomeIcon icon={faPlay} /></small>
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
                    Balance: {config.systemCurrency === 'NIS' ? '₪' : 'JD'} {terminal.customer.employeeBalance}
                    <hr style={{ padding: '2px', margin: '2px' }} />
                    <small>
                        (Limit: {config.systemCurrency === 'NIS' ? '₪' : 'JD'} {terminal.customer.employeeBalanceLimit})
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
                            currency: config.systemCurrency,
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
                            <b style={{ fontSize: '16px' }}>{obj.amount} {config.systemCurrency}</b>
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
                    <div
                        key={obj.key + 'di'}
                        style={{
                            textAlign: 'center',
                            fontSize: obj.itemName.length > 18 ? '10px' : '14px',
                        }}
                    >
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
        const _alphabetButtons = ['ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ر', 'ذ', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي'];
        let buttons = [];
        _alphabetButtons.map((c, i) => {
            buttons.push(<Button appearance={c === alphabtet ? 'primary' : 'default'}
                size='lg'
                key={i} style={{ float: 'right', borderRadius: '0px', margin: '2px', width: '60px' }}
                onClick={() => { setAlphabet(c) }} >
                <h5 style={{ textAlign: 'center', fontWeight: 'bolder' }}>
                    {c}
                </h5>
            </Button>)
        })
        return buttons;
    }


    return (
        <FlexboxGrid style={{ zoom: 0.9 }} >
            <FlexboxGrid.Item colspan={11} style={{ background: 'white', position: 'relative', left: '6px', width: '48.83333333%' }}  >
                {terminal.display === 'ready' && <Invoice authQR={authQR} />}
                {terminal.display === 'payment' && <Payments />}
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={1} style={{ width: '1.166667%' }}>
                <InactivityHandler setActionsMode={setActionsMode} />

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

                            <div style={{ margin: 'auto', borderRadius: '10px', padding: 15, background: 'white' }}>
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
                                <SelectPicker value={trxSlice.priceChangeReason} placeholder="Price Change Reason" searchable={false} width={250}
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

            <FlexboxGrid.Item colspan={9} style={{ position: 'relative', left: '6px', height: '100vh' }}>
                <div style={{ background: '#303030', color: 'white', height: '5vh', position: 'relative', width: '120%', right: '12px' }}>
                    <h6 style={{ lineHeight: '5vh', textAlign: 'left', fontSize: '95%' }}>
                        <span> <FontAwesomeIcon icon={faUser} style={{ marginLeft: '20px', marginRight: '7px' }} /> {terminal.loggedInUser ?
                            terminal.loggedInUser.employeeNumber.concat(' - ').concat(terminal.loggedInUser.username) : 'No User'}</span>
                        <span style={{ marginRight: '10px', marginLeft: '10px' }}>/</span>
                        <span>{terminal.till && terminal.till.workDay ? terminal.till.workDay.businessDateAsString : 'No Work Day'}</span>
                    </h6>
                    <img src={Logo} style={{ position: 'fixed', right: '1vw', top: '0', zIndex: 1000, height: 'inherit' }} />
                </div>

                <div id='rightPosPanel' style={{ background: 'white', padding: '10px', position: 'absolute', top: '5vh', width: '96.5%', }}>
                    <span>
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
                    {!hasEshiniConnection && <span style={{ color: 'orangered' }}>
                        <FontAwesomeIcon icon={faExclamationTriangle} style={{ marginRight: '7px' }} />
                        <b>WARNING:</b> NO CONNECTION TO E-SHINI
                    </span>}
                    {
                        !terminal.paymentMode && config.scale &&
                        (<h4 style={{ textAlign: 'center', cursor: 'pointer', }}>
                            <Button size='lg' appearance='ghost' style={{ width: '200px' }}
                                disabled={!scaleConnected} onClick={() => setScaleItemsOpen(true)}><FontAwesomeIcon icon={faScaleBalanced} /> Scale Items </Button>
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
                                            {config.systemCurrency === 'NIS' ? '₪' : 'JD'} {(Math.round(trxSlice.trxPaid * 100) / 100).toFixed(config.systemCurrency === 'NIS' ? 2 : 3)}
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
                                        {config.systemCurrency === 'NIS' ? '₪' : 'JD'} {(Math.round(trxSlice.trxChange * 100) / 100).toFixed(config.systemCurrency === 'NIS' ? 2 : 3)}
                                    </label>
                                    </b>
                                    {
                                        terminal.paymentInput === 'numpad' && trxSlice.selectedCurrency !== config.systemCurrency &&
                                        <small style={{ fontSize: '15px', marginLeft: '5px' }}>
                                            ( {(Math.round(Math.abs(trxSlice.trxChange / terminal.exchangeRates[trxSlice.selectedCurrency]) * 100) / 100).toFixed(config.systemCurrency === 'NIS' ? 2 : 3)} {trxSlice.selectedCurrency} )
                                        </small>
                                    }
                                    {
                                        (trxSlice.trx && trxSlice.trx.affectedByPlusTax && trxSlice.trx.totalPlusTaxAmt > 0) && <h5 style={{ fontSize: '15px', color: '#8B0000' }}>
                                            *Required Plus Tax = <span style={{ fontFamily: 'DSDIGI' }}>{config.systemCurrency === 'NIS' ? '₪' : 'JD'} {trxSlice.trx.totalPlusTaxAmt}</span>
                                        </h5>
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
                                            {(Math.round(trxSlice.lastTrxPayment.paid * 100) / 100).toFixed(config.systemCurrency === 'NIS' ? 2 : 3)}
                                        </label>
                                    </b>
                                    <Divider vertical />
                                    <small style={{ fontSize: '20px', marginRight: '5px' }}>
                                        Change =
                                    </small>
                                    <b> <label id='Total' style={{ fontSize: '25px', color: trxSlice.lastTrxPayment.change < 0 ? 'red' : 'green' }} >
                                        {(Math.round(trxSlice.lastTrxPayment.change * 100) / 100).toFixed(config.systemCurrency === 'NIS' ? 2 : 3)}
                                    </label>
                                    </b>
                                </div>
                            </FlexboxGrid.Item>
                        </FlexboxGrid>
                    }
                </div>

                <div style={{ background: 'white', padding: '10px', position: 'absolute', bottom: '0%', width: '96.5%' }}>
                    <Numpad setAuthQR={setAuthQR} incrementTrxCount={incrementTrxCount} />
                </div>

            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={3} style={{ position: 'relative', right: '10px' }}>
                <div style={{ background: '#303030', color: 'white', height: '5vh', position: 'relative', width: '130%', right: '17px' }}>
                    <h6 style={{ lineHeight: '5vh', textAlign: 'center' }}>
                    </h6>
                </div>
                <div style={{ marginTop: 10 }}>
                    <FlexboxGrid justify='space-between' style={{
                        maxHeight: "90vh",
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
                                actionsMode === 'payment' && terminal.paymentType === 'visaArabi' &&
                                buildVisaButtonsArabi()
                            }

                            {
                                actionsMode === 'payment' && terminal.trxMode !== 'Refund' &&
                                config.systemCurrency === 'NIS' &&
                                terminal.paymentType === 'jawwalPay' &&
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
                                    appearance={config.systemCurrency === trxSlice.selectedCurrency ? 'primary' : 'default'}
                                    onClick={() => dispatch(selectCurrency(config.systemCurrency))} >
                                    <div style={{ textAlign: 'center' }}>
                                        Voucher {config.systemCurrency}
                                    </div>
                                </Button>
                            }


                            {
                                actionsMode === 'payment' && terminal.trxMode !== 'Refund' && terminal.paymentType === 'onAccount' &&
                                <Button className={classes.ActionButton}
                                    appearance={config.systemCurrency === trxSlice.selectedCurrency ? 'primary' : 'default'}
                                    onClick={() => dispatch(selectCurrency(config.systemCurrency))} >
                                    <div style={{ textAlign: 'center' }}>
                                        On Account
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

                    <FlexboxGrid.Item colspan={3}>

                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={3}>
                        <Button className={classes.POSButton}
                            appearance={actionsMode === 'payment' ? 'primary' : 'default'}
                            color='green'
                            onClick={() => {
                                setActionsMode('payment')
                            }} >
                            <FontAwesomeIcon icon={faSackDollar} style={{ marginRight: '5px' }} />
                            <div>Payment</div>
                        </Button>
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={3}>
                        <Button className={classes.POSButton}
                            appearance={actionsMode === 'fastItems' ? 'primary' : 'default'}
                            color='green'
                            onClick={() => setActionsMode('fastItems')} >
                            <FontAwesomeIcon icon={faCarrot} style={{ marginRight: '5px' }} />
                            <div>Fast Items</div>
                        </Button>
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={3}>
                        <Button className={classes.POSButton}
                            appearance={actionsMode === 'operations' ? 'primary' : 'default'}
                            color='green'
                            onClick={() => setActionsMode('operations')} >
                            <FontAwesomeIcon icon={faToolbox} style={{ marginRight: '5px' }} />
                            <div>Operations</div>
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
                            <div>{trxSlice.priceChangeMode ? 'CANCEL' : 'Change Price'}</div>
                        </Button>
                    </FlexboxGrid.Item>
                    <FlexboxGrid.Item colspan={3}>
                        {terminal.paymentMode && <Button className={classes.POSButton}
                            onClick={handleAbort}
                            appearance='primary' color='red'>
                            <label style={{ fontSize: '12px' }}>
                                {
                                    (terminal.paymentMode && actionsMode === 'payment' && terminal.paymentType === 'none') ? 'Cancel Payment' :
                                        (terminal.paymentMode && actionsMode === 'payment' && terminal.paymentType !== 'none') ? 'Back' : !terminal.paymentMode ? '' : ''
                                }
                            </label>
                        </Button>}
                    </FlexboxGrid.Item>
                </FlexboxGrid>
            </FlexboxGridItem >

            <Drawer style={{ width: '100vw' }} position='right' open={scaleItemsOpen}  >
                <Grid style={{ padding: '0px' }}>
                    <Row>
                        <Col xs={24}>
                            <ButtonToolbar style={{ textAlign: 'center', marginTop: '5px' }}>
                                <ButtonGroup >
                                    {conjureAlphabet()}
                                </ButtonGroup>
                            </ButtonToolbar>
                            <Divider style={{ margin: '5px' }} />
                        </Col>
                    </Row>
                    <Row >
                        <Col xs={24}>
                            <div style={{ height: '72.5vh', overflowX: 'hidden', overflowY: 'auto' }}>
                                <ButtonToolbar style={{ textAlign: 'center', width: '100%' }}>
                                    {produceItems.map((item) => {
                                        if (typeof item.descriptionAr === 'string' && item.descriptionAr.startsWith(alphabtet)
                                            && matchProduceCategory(selectedScaleCategory, item.category)) {

                                            const imgSrc = images[`PLU_${item.barcode}.jpg`] || images['nophoto.jpg'];


                                            return (
                                                <Button key={item.barcode} appearance='ghost' color='cyan' style={{ width: '22%', margin: '5px' }}
                                                    onClick={() => { scanWeightableItem(item); }}>
                                                    <img
                                                        src={imgSrc}
                                                        onError={(e) => {
                                                            e.target.src = images['nophoto.jpg'];
                                                        }}

                                                        height={100} width={100}
                                                    />
                                                    <br />
                                                    <b style={{ color: 'black' }}>
                                                        {item.descriptionAr} {item.isScalePiece && <FontAwesomeIcon icon={faTag} />}
                                                    </b>
                                                </Button>
                                            );
                                        } else {
                                            return null;
                                        }
                                    })}
                                </ButtonToolbar>
                            </div>
                        </Col>
                    </Row>
                    <Row>
                        <Divider style={{ margin: '10px' }} />
                    </Row>
                    <Row>
                        <Col xs={7}>
                            <ButtonToolbar >
                                <IconButton icon={<ArrowLeft />} onClick={() => { setScaleItemsOpen(false) }}>
                                    Go Back
                                </IconButton>
                                <IconButton style={{ width: '100px' }}
                                    disabled={!scaleConnected}
                                    icon={<Tmall />} appearance='primary'
                                    color='blue'
                                    onClick={zeroScale} >
                                    ZERO
                                </IconButton>
                            </ButtonToolbar>
                        </Col>
                        <Col xs={5}>
                        </Col>
                        <Col xs={12}>
                            <ButtonToolbar style={{ textAlign: 'right' }} >
                                <IconButton style={{ width: '150px' }}
                                    disabled={selectedScaleCategory === 'fruit'}
                                    icon={<IOs />} appearance={selectedScaleCategory === 'fruit' ? 'default' : 'primary'}
                                    color='cyan'
                                    onClick={() => { setSelectedScaleCategory('fruit') }} >
                                    Fruits
                                </IconButton>
                                <IconButton style={{ width: '150px' }} icon={<Funnel />}
                                    disabled={selectedScaleCategory === 'vegetable'}
                                    appearance={selectedScaleCategory === 'vegetable' ? 'default' : 'primary'}
                                    color='cyan'
                                    onClick={() => { setSelectedScaleCategory('vegetable') }}>
                                    Vegetables
                                </IconButton>
                            </ButtonToolbar>
                        </Col>
                    </Row>
                </Grid>
            </Drawer>

            <Modal open={settingsOpen} onClose={() => { setSettingsOpen(false) }}  >
                <h4 style={{ padding: '0px', margin: '0px' }}>
                    POS Settings
                </h4>
                <Divider style={{ margin: '5px' }} />
                <Panel bordered header='Integrated Scale' style={{ margin: '10px' }}>
                    <ButtonToolbar >
                        <Button appearance='primary' onClick={openScalePort}
                            disabled={scaleConnected} >
                            Connect to Scale
                        </Button>
                        <Button appearance='primary' onClick={zeroScale}
                            disabled={!scaleConnected} >
                            Zero Scale
                        </Button>
                        <Button appearance='primary' onClick={restartScale}
                            disabled={!scaleConnected} >
                            Restart Scale
                        </Button>
                        <Button appearance='primary' onClick={closeScalePort}
                            disabled={!scaleConnected} >
                            Close Scale Port
                        </Button>
                    </ButtonToolbar>
                </Panel>
                <Panel bordered header='General' style={{ margin: '10px' }}>
                    <ButtonToolbar >
                        <Button color={terminal.managerMode ? 'red' : 'yellow'} appearance="primary" onClick={handleManagerMode} >
                            {terminal.managerMode ? 'Exit Manager' : 'Manager'}
                        </Button>
                        <Button appearance='primary' onClick={() => {
                            ipcRenderer.send('show-dev-tools', {});
                        }} >
                            Open DEV Tools
                        </Button>
                        <Button appearance='primary' onClick={() => {
                            window.location.reload();
                        }} >
                            Restart
                        </Button>
                        <Button appearance='primary' onClick={() => {
                            ipcRenderer.send('checkForUpdates', {});
                        }} >
                            Check for Updates
                        </Button>
                    </ButtonToolbar>
                    <br />
                    <Input type='password' key='adminPasskey' placeholder='Admin Passkey'
                        style={{ width: 150, display: 'inline-block', marginRight: 5 }}
                        value={passkey}
                        onChange={(e) => { setPasskey(e) }} >
                    </Input>
                </Panel>
                <Panel bordered header='BOP VISA Integration' style={{ margin: '10px' }}>
                    {!terminal.terminal.bopVisaIp && <Input key='bopvisasetupIp' placeholder='BOP Visa IP'
                        style={{ width: 150, display: 'inline-block', marginRight: 5 }}
                        value={bopVisaIp}
                        onChange={(e) => { setBopVisaIp(e) }} >
                    </Input>}

                    {!terminal.terminal.bopVisaIp && <Button key='bopvisasetup'
                        style={{ display: 'inline-block' }}
                        onClick={initTerminalWithBopVisa} >
                        <div style={{ textAlign: 'center' }}>
                            <FontAwesomeIcon icon={faChain} /> Link BOP Visa
                        </div>
                    </Button>}

                    {terminal.terminal.bopVisaIp && <div style={{ textAlign: 'center' }}>
                        <FontAwesomeIcon icon={faCheck} /> Already Linked @ {terminal.terminal.bopVisaIp}
                    </div>}
                    <br />
                </Panel>
            </Modal>

        </FlexboxGrid >
    );
}

export default Terminal;