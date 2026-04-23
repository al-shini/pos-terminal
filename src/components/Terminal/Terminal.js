import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux'
import axios from '../../axios';
import { Button, FlexboxGrid, Divider, Input, SelectPicker, Drawer, ButtonGroup, IconButton, ButtonToolbar, Grid, Row, Col, Panel, Modal } from 'rsuite';
import classes from './Terminal.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSackDollar, faMoneyBillTransfer, faRepeat, faUser, faScaleBalanced, faTag, faChevronUp, faChevronDown, faCogs,
    faCarrot, faShieldHalved, faMoneyBill, faIdCard, faTimes, faEraser, faBan, faPause, faRotateLeft, faDollarSign, faLock, faUnlock, faSearch, faStar, faChain, faHistory, faPlay, faPlusSquare, faTags, faKey, faExclamationTriangle, faList, faCheck, faArrowRightFromBracket, faQrcode, faMobileScreenButton, faHashtag, faMotorcycle, faBullhorn, faHourglassHalf, faBoxOpen
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
    fullTrxTaxExempt,
    printTrx, clearOriginalTrxReference, setOriginalTrxReference, setCustomCustomerName,
    printTrxNoDrawer
} from '../../store/trxSlice';
import { hideLoading, notify, showHardNotification, showLoading } from '../../store/uiSlice';
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
import { ArrowLeft, Funnel, IOs, Global } from '@rsuite/icons';
import InactivityHandler from '../InactivityHandler';
import VirtualKeyboardInput from '../UI/VirtualKeyboardInput';
import RefundReferenceDialog from './RefundReferenceDialog';
import CustomCustomerNameDialog from './CustomCustomerNameDialog';
import CustomCustomerMobileDialog from './CustomCustomerMobileDialog';
import ReferenceNumberDialog from './ReferenceNumberDialog';
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

    if (selectedScaleCategory === 'all') {
        return /fruit/i.test(normalizedCategory) || /vegetable/i.test(normalizedCategory);
    } else if (selectedScaleCategory === 'fruit') {
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
    const [selectedScaleCategory, setSelectedScaleCategory] = useState('all');
    const [produceItems, setProduceItems] = useState([]);
    const [alphabtet, setAlphabet] = useState('ا');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [lastTrxOpen, setLastTrxOpen] = useState(false);
    const [lastTrxList, setLastTrxList] = useState([]);
    const [refundReferenceDialogOpen, setRefundReferenceDialogOpen] = useState(false);
    const [customCustomerNameDialogOpen, setCustomCustomerNameDialogOpen] = useState(false);
    const [customCustomerMobileDialogOpen, setCustomCustomerMobileDialogOpen] = useState(false);
    const [referenceNumberDialogOpen, setReferenceNumberDialogOpen] = useState(false);
    const [cashDroModalOpen, setCashDroModalOpen] = useState(false);
    const [cashDroStatus, setCashDroStatus] = useState({ message: '', state: null, totalIn: 0, changeNotAvailable: 0 });
    const [cashDroPollingRef, setCashDroPollingRef] = useState(null);
    
    // Secret manager mode activation: tap logo 3x when numpad has "4994"
    const [logoTapCount, setLogoTapCount] = useState(0);
    const [logoTapTimer, setLogoTapTimer] = useState(null);

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

    useEffect(() => {
        // if (!trxSlice.trx || (trxSlice.trx && !trxSlice.trx.key)) {
        //     dispatch(showHardNotification("Ask for Shini Me Loyalty Card"));
        // }
    }, [trxSlice.trx])

    const handleLastTrxList = () => {
        axios({
            method: 'get',
            url: '/trx/last-10-trx/',
            headers: {
                TillKey: terminal.till.key
            }
        }).then((response) => {
            if (response) {
                console.log(response.data);

                setLastTrxList(response.data);
                setLastTrxOpen(true);
            }
        }).catch((error) => {
            dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
        });
    }




    const dispatch = useDispatch();

    // Memoized filtered produce items to ensure fresh filtering on each alphabet/category change
    const filteredProduceItems = useMemo(() => {
        if (!produceItems || produceItems.length === 0) {
            return [];
        }

        const normalizedAlphabet = alphabtet.toString().trim();

        // First filter by criteria, then remove duplicates by barcode
        const filtered = produceItems.filter((item) => {
            // Improved filtering with better Arabic text handling
            const itemDescAr = item.descriptionAr || '';
            const normalizedItemDesc = itemDescAr.toString().trim();

            return normalizedItemDesc &&
                normalizedItemDesc.startsWith(normalizedAlphabet) &&
                matchProduceCategory(selectedScaleCategory, item.category);
        });

        // Remove duplicates by barcode to prevent React key conflicts
        const uniqueItems = filtered.reduce((acc, current) => {
            const existingItem = acc.find(item => item.barcode === current.barcode);
            if (!existingItem) {
                acc.push(current);
            }
            return acc;
        }, []);

        return uniqueItems;
    }, [produceItems, alphabtet, selectedScaleCategory]);

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
                console.error('Scale port opening error:', error);
                let errorMessage = 'Could not open scale port';

                if (error.response && error.response.data) {
                    errorMessage = error.response.data;
                }

                dispatch(notify({ msg: errorMessage, sev: 'error' }));
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
                console.error('Scale port closing error:', error);
                let errorMessage = 'Could not close scale port';

                if (error.response && error.response.data) {
                    errorMessage = error.response.data;
                }
                dispatch(notify({ msg: errorMessage, sev: 'error' }));
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
        dispatch(showLoading({ msg: 'Reading weight from scale (may retry if unstable)...' }));
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

                // Handle enhanced error responses from the new scale system
                let errorMessage = 'Could not fetch weight from scale';
                let severity = 'error';

                if (error.response) {
                    const status = error.response.status;
                    const responseMessage = error.response.data;

                    switch (status) {
                        case 408: // Request timeout - unstable weight
                            errorMessage = 'Weight is unstable. Please place items steadily on the scale and try again.';
                            severity = 'warning';
                            break;
                        case 409: // Conflict - scale busy
                            errorMessage = 'Scale is busy. Please wait and try again.';
                            severity = 'info';
                            break;
                        case 500: // Server error
                            if (responseMessage && responseMessage.includes('not open')) {
                                errorMessage = 'Scale not connected. Please check scale connection.';
                            } else {
                                errorMessage = responseMessage || 'Scale communication error';
                            }
                            break;
                        default:
                            errorMessage = responseMessage || errorMessage;
                    }
                } else if (error.request) {
                    errorMessage = 'Cannot communicate with scale service';
                } else {
                    errorMessage = error.message || errorMessage;
                }

                dispatch(notify({ msg: errorMessage, sev: severity }));
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

    /* CashDro Payment Flow */
    const handleCashDroPayment = async () => {
        if (!trxSlice.trx) {
            dispatch(notify({ msg: 'No transaction open', sev: 'warning' }));
            return;
        }

        if (terminal.trxMode === 'Refund') {
            dispatch(notify({ msg: 'CashDro does not support refunds', sev: 'warning' }));
            return;
        }

        // Enter payment mode if not already in it
        if (!terminal.paymentMode) {
            dispatch(clearNumberInput());
            dispatch(beginPayment());
            dispatch(setPaymentType({ type: 'cash', inputType: 'fixed' }));
        }

        // Calculate remaining amount - use transaction total if no payments yet
        const totalDue = trxSlice.trx.totalafterdiscount || 0;
        const totalPaid = trxSlice.trxPaid || 0;
        const remainingAmount = totalDue - totalPaid;
        
        if (remainingAmount <= 0) {
            dispatch(notify({ msg: 'No remaining amount to pay', sev: 'warning' }));
            return;
        }

        setCashDroStatus({ message: 'Starting CashDro...', state: 'STARTING', totalIn: 0, changeNotAvailable: 0 });
        setCashDroModalOpen(true);

        try {
            // 1. Link transaction to CashDro (starts the machine)
            const linkResponse = await axios({
                method: 'post',
                url: '/trx/linkTrxToCashDro',
                headers: { trxKey: trxSlice.trx.key }
            });

            if (!linkResponse.data || !linkResponse.data.cashdroId) {
                throw new Error('Failed to start CashDro operation');
            }

            setCashDroStatus({ 
                message: `Insert ${remainingAmount.toFixed(2)} ${config.systemCurrency} into CashDro machine...`, 
                state: 'PENDING', 
                totalIn: 0, 
                changeNotAvailable: 0 
            });

            // 2. Start polling for completion
            const pollInterval = setInterval(async () => {
                try {
                    const statusResponse = await axios({
                        method: 'post',
                        url: '/trx/checkTrxCashDroStatus',
                        headers: { trxKey: trxSlice.trx.key }
                    });

                    const droState = statusResponse.data;
                    
                    if (droState.state === 'F') { // Finished
                        clearInterval(pollInterval);
                        setCashDroPollingRef(null);
                        setCashDroModalOpen(false);

                        // CashDro returns amounts in cents, convert to currency
                        const cashReceived = droState.totalIn / 100;
                        const changeDispensed = droState.totalOut / 100;
                        const changeNotAvailable = droState.changeNotAvailable / 100;
                        
                        // Submit as Cash payment
                        dispatch(submitPayment({
                            tillKey: terminal.till ? terminal.till.key : null,
                            trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                            paymentMethodKey: 'Cash',
                            currency: config.systemCurrency,
                            amount: cashReceived,
                            sourceKey: 'CASHDRO-' + linkResponse.data.cashdroId,
                            visaPayment: null
                        }));

                        dispatch(notify({ 
                            msg: `CashDro: Received ${cashReceived.toFixed(2)}, Change ${changeDispensed.toFixed(2)}`, 
                            sev: 'info' 
                        }));

                        // Warn if machine couldn't dispense all change
                        if (changeNotAvailable > 0) {
                            dispatch(notify({ 
                                msg: `Manual change needed: ${changeNotAvailable.toFixed(2)} ${config.systemCurrency}`, 
                                sev: 'warning' 
                            }));
                        }
                    } else {
                        // Update status with current amounts
                        setCashDroStatus(prev => ({ 
                            ...prev, 
                            totalIn: droState.totalIn / 100,
                            message: `Waiting for customer... Inserted: ${(droState.totalIn / 100).toFixed(2)} ${config.systemCurrency}`
                        }));
                    }
                } catch (pollError) {
                    console.error('CashDro poll error:', pollError);
                }
            }, 2000); // Poll every 2 seconds

            setCashDroPollingRef(pollInterval);

            // 3. Timeout after 5 minutes
            setTimeout(() => {
                if (cashDroPollingRef) {
                    clearInterval(cashDroPollingRef);
                    setCashDroPollingRef(null);
                    setCashDroModalOpen(false);
                    setCashDroStatus({ message: '', state: null, totalIn: 0, changeNotAvailable: 0 });
                    dispatch(notify({ msg: 'CashDro timeout - payment not completed', sev: 'error' }));
                }
            }, 5 * 60 * 1000);

        } catch (error) {
            setCashDroModalOpen(false);
            setCashDroStatus({ message: '', state: null, totalIn: 0, changeNotAvailable: 0 });
            dispatch(notify({ 
                msg: 'CashDro error: ' + (error.response?.data || error.message), 
                sev: 'error' 
            }));
        }
    };

    const handleCancelCashDro = () => {
        if (cashDroPollingRef) {
            clearInterval(cashDroPollingRef);
            setCashDroPollingRef(null);
        }
        setCashDroModalOpen(false);
        setCashDroStatus({ message: '', state: null, totalIn: 0, changeNotAvailable: 0 });
        dispatch(notify({ msg: 'CashDro payment cancelled', sev: 'warning' }));
    };

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
        if (!terminal.managerMode && passkey === 'bane@4994') {
            dispatch(setManagerMode(true))
            setPasskey('');
        } else if (!terminal.managerMode) {
            dispatch(setManagerMode(false))
            setPasskey('');
        } else if (terminal.managerMode) {
            dispatch(setManagerMode(false))
        }
    }

    // Secret pattern: tap logo 3x when numpad has "4994" to enable manager mode
    const handleLogoTap = () => {
        if (terminal.managerMode) return; // Already in manager mode
        
        // Clear previous timer
        if (logoTapTimer) {
            clearTimeout(logoTapTimer);
        }
        
        const newCount = logoTapCount + 1;
        setLogoTapCount(newCount);
        
        // Check if secret pattern is complete: 3 taps + numpad has "4994"
        if (newCount >= 3 && trxSlice.numberInputValue === '4994') {
            dispatch(setManagerMode(true));
            dispatch(clearNumberInput());
            setLogoTapCount(0);
            dispatch(notify({ msg: '🔓 Manager Mode Activated', sev: 'info' }));
            return;
        }
        
        // Reset tap count after 2 seconds of no tapping
        const timer = setTimeout(() => {
            setLogoTapCount(0);
        }, 2000);
        setLogoTapTimer(timer);
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
                // First, show the refund reference dialog
                setRefundReferenceDialogOpen(true);
            }
        )
    }

    const handleRefundReferenceValidated = (originalTransaction) => {
        // Store the original transaction reference in Redux state
        dispatch(setOriginalTrxReference(originalTransaction));

        // After successful validation, proceed with QR auth if needed
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

    const handleRefundReferenceDialogClose = () => {
        setRefundReferenceDialogOpen(false);
        // Clear any stored reference when dialog is closed without validation
        // dispatch(clearOriginalTrxReference());
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
            {/* CashDro - only show if terminal has CashDro configured */}
            {terminal.terminal && terminal.terminal.cashDroIp && (
                <React.Fragment>
                    <Button 
                        key='cashdro' 
                        disabled={terminal.trxMode === 'Refund' || !trxSlice.trx} 
                        className={classes.MainActionButton}
                        style={{ background: '#2e7d32', color: 'white' }}
                        onClick={handleCashDroPayment}
                    >
                        <FontAwesomeIcon icon={faMoneyBill} style={{ marginRight: '5px' }} />
                        <label>CashDro</label>
                    </Button>
                    <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
                </React.Fragment>
            )}
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
            <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            <Button key='mobicash' disabled={terminal.trxMode === 'Refund' || !trxSlice.trx} className={classes.MainActionButton}
                onClick={() => { startPayment('mobiCash', 'numpad') }}>
                <FontAwesomeIcon icon={faIdCard} style={{ marginRight: '5px' }} />
                <label>MobiCash</label>
            </Button>
            <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            <Button key='talabat' disabled={terminal.trxMode === 'Refund' || !trxSlice.trx} className={classes.MainActionButton}
                onClick={() => { startPayment('talabat', 'numpad') }}>
                <FontAwesomeIcon icon={faMotorcycle} style={{ marginRight: '5px' }} />
                <label>Talabat</label>
            </Button>
            <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            {config.systemCurrency === 'NIS' && <Button key='wfp' disabled={terminal.trxMode === 'Refund' || !trxSlice.trx} className={classes.MainActionButton}
                onClick={() => { startPayment('wfp', 'numpad') }}>
                <FontAwesomeIcon icon={faIdCard} style={{ marginRight: '5px' }} />
                <label>WFP</label>
            </Button>}
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
                className={classes.MainActionButton} onClick={() => { startPayment('cashBack', 'numpad') }}>
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
                        style={{
                            backgroundColor: '#FFFFFF',
                            display: 'block',
                            width: 'calc(100% - 12px)',
                            margin: '4px 6px',
                            border: '1px solid #E5E7EB',
                            borderRadius: '12px',
                            boxShadow: '0 1px 2px rgba(17, 24, 39, 0.04)',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            transition: 'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.12s ease'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.borderColor = '#FBC9CC';
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(225, 30, 38, 0.10)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.borderColor = '#E5E7EB';
                            e.currentTarget.style.boxShadow = '0 1px 2px rgba(17, 24, 39, 0.04)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <img
                            src={notesImages[obj.amount + '' + obj.currency]}
                            alt={obj.amount + ' ' + obj.currency}
                            style={{
                                display: 'block',
                                margin: '6px auto',
                                maxWidth: '92%',
                                maxHeight: '56px',
                                height: 'auto',
                                width: 'auto',
                                objectFit: 'contain'
                            }}
                        />
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
                    <label style={{ fontSize: '20px' }}>
                        <span style={{ fontFamily: '"DSDIGI", monospace' }}>{trxSlice.trx.totalafterdiscount}</span> {config.systemCurrency === 'NIS' ? 'JD' : 'JD'}
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
                }}
                    style={{
                        backgroundColor: '#FFFFFF',
                        display: 'block',
                        width: 'calc(100% - 12px)',
                        margin: '4px 6px',
                        border: '1px solid #E5E7EB',
                        borderRadius: '12px',
                        boxShadow: '0 1px 2px rgba(17, 24, 39, 0.04)',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        transition: 'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.12s ease'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#FBC9CC';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(225, 30, 38, 0.10)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#E5E7EB';
                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(17, 24, 39, 0.04)';
                        e.currentTarget.style.transform = 'translateY(0)';
                    }}
                >
                    <img
                        src={notesImages[obj.amount + '' + obj.currency]}
                        alt={obj.amount + ' ' + obj.currency}
                        style={{
                            display: 'block',
                            margin: '6px auto',
                            maxWidth: '92%',
                            maxHeight: '56px',
                            height: 'auto',
                            width: 'auto',
                            objectFit: 'contain'
                        }}
                    />
                </a>
            )
            tmp.push(<div style={{ lineHeight: '0.6705', color: 'transparent' }} key={obj.uuid + 'space'} > .</div>);
        });

        tmp.push(<div key='fs' style={{ lineHeight: '0.6705', color: 'transparent' }}> .</div>);

        return tmp;
    }

    const buildMobiCashButtons = () => {
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
                <div style={{ fontSize: '12px', }}>
                    <FontAwesomeIcon icon={faPause} style={{ marginRight: '5px' }} />
                    <label>Suspend Trx</label>
                </div>
            </Button>
            <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            <Button key='voidTrx' className={classes.MainActionButton}
                onClick={handleVoidTrx}
                disabled={terminal.paymentMode} >
                <div style={{ fontSize: '12px', }}>
                    <FontAwesomeIcon icon={faShieldHalved} style={{ marginRight: '5px' }} />
                    <label>Void TRX </label>
                </div>
            </Button>
            <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            {
                terminal.trxMode === 'Sale' &&
                <Button disabled={trxSlice.trx !== null} key='refund' className={classes.MainActionButton} onClick={handleSwitchToRefund}>
                    <div style={{ fontSize: '12px', }}>
                        <FontAwesomeIcon icon={faRotateLeft} style={{ marginRight: '5px' }} />
                        <label>Refund</label>
                    </div>
                </Button>
            }
            {
                terminal.trxMode === 'Refund' &&
                <Button disabled={trxSlice.trx !== null} key='sale' className={classes.MainActionButton} onClick={() => { dispatch(setTrxMode('Sale')) }}>
                    <div style={{ fontSize: '12px', }}>
                        <FontAwesomeIcon icon={faDollarSign} style={{ marginRight: '5px' }} />
                        <label>Sale</label>
                    </div>
                </Button>
            }
            <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            {
                (terminal.till && terminal.till.status === 'O') &&
                <Button disabled={trxSlice.trx !== null} key='lock' className={classes.MainActionButton} onClick={handleLockTill}>
                    <div style={{ fontSize: '12px', }}>
                        <FontAwesomeIcon icon={faLock} style={{ marginRight: '5px' }} />
                        <label>Lock Till</label>
                    </div>
                </Button>
            }

            {
                terminal.till && terminal.till.status === 'L' &&
                <Button key='unlock' style={{ zIndex: '1000' }} className={classes.MainActionButton} onClick={handleUnlockTill}>
                    <div style={{ fontSize: '12px', }}>
                        <FontAwesomeIcon icon={faUnlock} style={{ marginRight: '5px' }} />
                        <label>Unlock Till</label>
                    </div>
                </Button>
            }
            {
                terminal.till && terminal.till.status === 'L' &&
                <Button key='logout' style={{ zIndex: '1000' }} className={classes.MainActionButton} onClick={handleLogout}>
                    <div style={{ fontSize: '12px', }}>
                        <FontAwesomeIcon icon={faUnlock} style={{ marginRight: '5px' }} />
                        <label>Sign Out</label>
                    </div>
                </Button>
            }
            <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            {
                <Button key='fullTaxExempt' className={classes.MainActionButton} onClick={handleFUllTaxExempt}>
                    <div style={{ fontSize: '12px', }}>
                        <FontAwesomeIcon icon={faMoneyBillTransfer} style={{ marginRight: '5px' }} />
                        <label>Full Tax Exempt</label>
                    </div>
                </Button>
            }
            <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            {
                <Button key='settings' className={classes.MainActionButton} onClick={() => setSettingsOpen(true)}>
                    <div style={{ fontSize: '12px', }}>
                        <FontAwesomeIcon icon={faCogs} style={{ marginRight: '5px' }} />
                        <label>Settings</label>
                    </div>
                </Button>
            }  <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            {
                <Button key='customerName' className={classes.MainActionButton}
                    disabled={!trxSlice.trx}
                    onClick={() => setCustomCustomerNameDialogOpen(true)}>
                    <div style={{ fontSize: '12px', }}>
                        <FontAwesomeIcon icon={faUser} style={{ marginRight: '5px' }} />
                        <label>Customer Name</label>
                    </div>
                </Button>
            }  <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            {
                <Button key='customerMobile' className={classes.MainActionButton}
                    disabled={!trxSlice.trx || (terminal.customer && terminal.customer.club)}
                    onClick={() => setCustomCustomerMobileDialogOpen(true)}
                    title={(terminal.customer && terminal.customer.club) ? 'Club customer scanned — mobile is locked' : undefined}>
                    <div style={{ fontSize: '12px', }}>
                        <FontAwesomeIcon icon={faMobileScreenButton} style={{ marginRight: '5px' }} />
                        <label>Customer Mobile</label>
                    </div>
                </Button>
            }  <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            {
                <Button key='referenceNumber' className={classes.MainActionButton}
                    disabled={!trxSlice.trx}
                    onClick={() => setReferenceNumberDialogOpen(true)}>
                    <div style={{ fontSize: '12px', }}>
                        <FontAwesomeIcon icon={faHashtag} style={{ marginRight: '5px' }} />
                        <label>Reference Number</label>
                    </div>
                </Button>
            }  <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            {
                <Button key='lastTrxList' className={classes.MainActionButton}
                    onClick={handleLastTrxList}>
                    <div style={{ fontSize: '12px', }}>
                        <FontAwesomeIcon icon={faList} style={{ marginRight: '5px' }} />
                        <label>Print Last TRX</label>
                    </div>
                </Button>
            }
        </React.Fragment >;
    }

    const buildSuspendedButtons = () => {
        let tmp = [];

        tmp.push(
            <div key={'title'} style={{
                textAlign: 'center',
                margin: '4px 6px 10px 6px',
                padding: '10px 12px',
                background: 'linear-gradient(135deg, #FFF7F7 0%, #FDEDEE 100%)',
                border: '1px solid rgba(225, 30, 38, 0.18)',
                borderRadius: '12px',
                color: '#B3141B'
            }}>
                <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Suspended
                </div>
                <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600, marginTop: 2 }}>
                    Tap an item to resume
                </div>
            </div>
        );

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
                        ( {config.systemCurrency === 'NIS' ? 'JD' : 'JD'} {obj.totalafterdiscount} ) <small>Restore <FontAwesomeIcon icon={faPlay} /></small>
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
                    Balance: {config.systemCurrency === 'NIS' ? 'JD' : 'JD'} {terminal.customer.employeeBalance}
                    <hr style={{ padding: '2px', margin: '2px' }} />
                    <small>
                        (Limit: {config.systemCurrency === 'NIS' ? 'JD' : 'JD'} {terminal.customer.employeeBalanceLimit})
                    </small>
                </div>
            </Button >
        )
        tmp.push(<div style={{ lineHeight: '0.6705', color: 'transparent' }} key={'empExtraSpace'} > .</div>);

        return tmp;
    }

    const buildCashBackButtons = () => {
        let tmp = [];

        const rawBalance = Number(terminal.customer ? terminal.customer.cashbackBalance : 0) || 0;
        const balance = Math.round(rawBalance * 10000) / 10000;
        const currency = config.systemCurrency === 'NIS' ? 'JD' : 'JD';

        tmp.push(
            <div key={'cashbackBalanceCard'} className={classes.CashbackBalanceCard}>
                <div className={classes.CashbackBalanceIcon}>
                    <FontAwesomeIcon icon={faStar} />
                </div>
                <div className={classes.CashbackBalanceBody}>
                    <span className={classes.CashbackBalanceLabel}>Cashback Balance</span>
                    <div className={classes.CashbackBalanceAmountRow}>
                        <small className={classes.CashbackBalanceCurrency}>{currency}</small>
                        <span className={classes.CashbackBalanceAmount}>{balance}</span>
                    </div>
                </div>
            </div>
        );
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
                            paymentMethodKey: 'Cashback',
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
                <Button key={i} className={classes.MainActionButton}
                    onClick={() => {
                        setSelectedFGroup(key);
                    }} >
                    {key}
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
        <FlexboxGrid
            className={terminal.trxMode === 'Refund' ? classes.RefundMode : ''}
            style={{
                zoom: 0.9,
                background: '#F8FAFC',
                height: 'calc(100vh / 0.9)',
                maxHeight: 'calc(100vh / 0.9)',
                overflow: 'hidden'
            }}
        >
            <FlexboxGrid.Item colspan={10} style={{
                background: '#FFFFFF',
                position: 'relative',
                height: 'calc(100vh / 0.9)',
                overflow: 'hidden',
                borderRight: '1px solid #E5E7EB'
            }}  >
                {terminal.display === 'ready' && <Invoice authQR={authQR} />}
                {terminal.display === 'payment' && <Payments />}
                {terminal.display === 'balance-setup' && <BalanceSetup />}

                <InactivityHandler setActionsMode={setActionsMode} />

                {
                    terminal.blockActions && (
                        <div className={classes.LockOverlay}>
                            <div className={classes.LockCard}>
                                <div className={classes.LockMedallionStage}>
                                    <span className={classes.LockRingOuter} />
                                    <span className={classes.LockRingInner} />
                                    <span className={classes.LockHalo} />
                                    <span className={classes.LockBadge}>
                                        <FontAwesomeIcon icon={faLock} />
                                    </span>
                                </div>
                                <div className={classes.LockTitle}>Terminal Locked</div>
                                <div className={classes.LockSubtitle}>Awaiting cashier authorization</div>
                                <div className={classes.LockDots}>
                                    <span /><span /><span />
                                </div>
                                <div className={classes.LockActions}>
                                    <button
                                        type="button"
                                        className={`${classes.LockActionBtn} ${classes.LockActionPrimary}`}
                                        onClick={handleUnlockTill}
                                    >
                                        <FontAwesomeIcon icon={faQrcode} className={classes.LockActionIcon} />
                                        Unlock Till
                                    </button>
                                    <button
                                        type="button"
                                        className={`${classes.LockActionBtn} ${classes.LockActionGhost}`}
                                        onClick={handleLogout}
                                    >
                                        <FontAwesomeIcon icon={faArrowRightFromBracket} className={classes.LockActionIcon} />
                                        Sign Out
                                    </button>
                                </div>
                                <div className={classes.LockFootnote}>
                                    <FontAwesomeIcon icon={faShieldHalved} className={classes.LockFootnoteIcon} />
                                    Secured session · Shini POS
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    (trxSlice.qrAuthState === 'pending') && authQR && (() => {
                        const sourceLabels = {
                            VoidLine: 'Void Line',
                            VoidPayment: 'Void Payment',
                            VoidTrx: 'Void Transaction',
                            PriceChange: 'Price Change',
                            Refund: 'Refund Mode',
                            TaxExempt: 'Tax Exempt',
                            Suspend: 'Suspend Transaction',
                            'QTY-Multiplier': 'Quantity Multiplier',
                            ManagerMode: 'Manager Mode'
                        };
                        const friendlySource = sourceLabels[authQR.source] || authQR.source;
                        const showQR = authQR.source !== 'ManagerMode' &&
                            ((authQR.source !== 'PriceChange') || (authQR.source === 'PriceChange' && trxSlice.priceChangeReason));
                        const isPriceChangeAwaitingReason =
                            authQR.source === 'PriceChange' && !trxSlice.priceChangeReason;

                        return (
                            <div style={{
                                position: 'fixed',
                                zIndex: 10050,
                                inset: 0,
                                background: 'radial-gradient(ellipse at center, rgba(17,24,39,0.65) 0%, rgba(17,24,39,0.85) 100%)',
                                backdropFilter: 'blur(6px)',
                                WebkitBackdropFilter: 'blur(6px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '24px',
                                fontFamily: '"Inter", "Segoe UI", sans-serif'
                            }}>
                                <div style={{
                                    background: '#FFFFFF',
                                    width: 460,
                                    maxWidth: '94vw',
                                    borderRadius: 20,
                                    boxShadow: '0 30px 60px rgba(0,0,0,0.40), 0 10px 20px rgba(0,0,0,0.20)',
                                    overflow: 'hidden',
                                    border: '1px solid rgba(255,255,255,0.08)'
                                }}>
                                    {/* Header */}
                                    <div style={{
                                        background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
                                        color: '#FFFFFF',
                                        padding: '18px 22px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 14,
                                        borderBottom: '4px solid #E11E26'
                                    }}>
                                        <div style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 12,
                                            background: 'rgba(225, 30, 38, 0.18)',
                                            border: '1px solid rgba(225, 30, 38, 0.40)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#FCA5A5',
                                            fontSize: 20,
                                            flexShrink: 0
                                        }}>
                                            <FontAwesomeIcon icon={faLock} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontSize: 17,
                                                fontWeight: 800,
                                                letterSpacing: 0.3,
                                                textTransform: 'uppercase',
                                                lineHeight: 1.2
                                            }}>
                                                Manager Authorization
                                            </div>
                                            <div style={{
                                                fontSize: 11,
                                                fontWeight: 600,
                                                color: 'rgba(255,255,255,0.65)',
                                                marginTop: 3,
                                                letterSpacing: 0.5,
                                                textTransform: 'uppercase'
                                            }}>
                                                {authQR.source === 'ManagerMode' ? 'Enter access code to continue' : 'Scan QR with manager device'}
                                            </div>
                                        </div>
                                        <span style={{
                                            fontSize: 10,
                                            fontWeight: 700,
                                            letterSpacing: 0.8,
                                            textTransform: 'uppercase',
                                            background: 'rgba(225, 30, 38, 0.18)',
                                            color: '#FCA5A5',
                                            border: '1px solid rgba(225, 30, 38, 0.40)',
                                            padding: '4px 10px',
                                            borderRadius: 999,
                                            flexShrink: 0
                                        }}>
                                            {friendlySource}
                                        </span>
                                    </div>

                                    {/* Body */}
                                    <div style={{ padding: '22px' }}>
                                        {/* PriceChange: need reason first */}
                                        {authQR.source === 'PriceChange' && (() => {
                                            const reasonOptions = [
                                                { value: '1', label: 'Offer (Wrong Sign)',        icon: faTag },
                                                { value: '2', label: 'Offer (Facebook & No Cash)', icon: faBullhorn },
                                                { value: '3', label: 'Nearly Expired',             icon: faHourglassHalf },
                                                { value: '4', label: 'Corrupted Item',             icon: faBoxOpen }
                                            ];
                                            return (
                                                <div style={{ marginBottom: 18 }}>
                                                    <div style={{
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        color: '#6B7280',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: 0.4,
                                                        marginBottom: 10
                                                    }}>
                                                        Price Change Reason
                                                    </div>
                                                    <div
                                                        role="radiogroup"
                                                        aria-label="Price change reason"
                                                        style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: '1fr 1fr',
                                                            gap: 10
                                                        }}
                                                    >
                                                        {reasonOptions.map((opt) => {
                                                            const selected = trxSlice.priceChangeReason === opt.value;
                                                            return (
                                                                <button
                                                                    key={opt.value}
                                                                    type="button"
                                                                    role="radio"
                                                                    aria-checked={selected}
                                                                    onClick={() => dispatch(setPriceChangeReason(opt.value))}
                                                                    style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: 10,
                                                                        padding: '10px 12px',
                                                                        borderRadius: 12,
                                                                        border: selected
                                                                            ? '1px solid #E11E26'
                                                                            : '1px solid #E5E7EB',
                                                                        background: selected
                                                                            ? 'linear-gradient(135deg, rgba(225, 30, 38, 0.08) 0%, rgba(179, 20, 27, 0.04) 100%)'
                                                                            : '#FFFFFF',
                                                                        color: selected ? '#B3141B' : '#111827',
                                                                        boxShadow: selected
                                                                            ? '0 6px 14px rgba(225, 30, 38, 0.15), inset 0 0 0 1px rgba(225, 30, 38, 0.25)'
                                                                            : '0 1px 2px rgba(17, 24, 39, 0.04)',
                                                                        cursor: 'pointer',
                                                                        textAlign: 'left',
                                                                        transition: 'all 150ms ease',
                                                                        fontFamily: 'inherit'
                                                                    }}
                                                                >
                                                                    <span style={{
                                                                        width: 22,
                                                                        height: 22,
                                                                        borderRadius: '50%',
                                                                        border: selected ? '6px solid #E11E26' : '2px solid #CBD5E1',
                                                                        background: '#FFFFFF',
                                                                        flexShrink: 0,
                                                                        transition: 'border 150ms ease'
                                                                    }} />
                                                                    <FontAwesomeIcon
                                                                        icon={opt.icon}
                                                                        style={{
                                                                            color: selected ? '#B3141B' : '#6B7280',
                                                                            fontSize: 14,
                                                                            flexShrink: 0
                                                                        }}
                                                                    />
                                                                    <span style={{
                                                                        fontSize: 13,
                                                                        fontWeight: 700,
                                                                        letterSpacing: 0.2,
                                                                        lineHeight: 1.25
                                                                    }}>
                                                                        {opt.label}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* QR code */}
                                        {showQR && (
                                            <div style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: 14,
                                                padding: '20px',
                                                background: '#F8FAFC',
                                                border: '1px solid #E5E7EB',
                                                borderRadius: 14
                                            }}>
                                                <div style={{
                                                    background: '#FFFFFF',
                                                    padding: 14,
                                                    borderRadius: 12,
                                                    border: '1px solid #E5E7EB',
                                                    boxShadow: '0 4px 10px rgba(17, 24, 39, 0.06)'
                                                }}>
                                                    <QRCode value={JSON.stringify(authQR)} size={180} />
                                                </div>
                                                <div style={{
                                                    textAlign: 'center',
                                                    color: '#374151',
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                    lineHeight: 1.45
                                                }}>
                                                    Ask a manager to scan this code<br />
                                                    <span style={{ color: '#6B7280', fontWeight: 500, fontSize: 12 }}>
                                                        Waiting for authorization&hellip;
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* ManagerMode: password entry */}
                                        {authQR.source === 'ManagerMode' && (
                                            <div>
                                                <div style={{
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    color: '#6B7280',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: 0.4,
                                                    marginBottom: 8
                                                }}>
                                                    Manager Access Code
                                                </div>
                                                <Input
                                                    autoFocus
                                                    value={terminal.managerUser}
                                                    onChange={(e) => { dispatch(setManagerUser(e)) }}
                                                    type='password'
                                                    placeholder='Enter code (min 10 characters)'
                                                    style={{
                                                        width: '100%',
                                                        height: 52,
                                                        fontSize: 18,
                                                        fontWeight: 700,
                                                        letterSpacing: 4,
                                                        textAlign: 'center',
                                                        borderRadius: 12,
                                                        border: '1px solid #E5E7EB',
                                                        background: '#F8FAFC'
                                                    }}
                                                />
                                                <Button
                                                    block
                                                    appearance="primary"
                                                    disabled={!terminal.managerUser || terminal.managerUser.length < 10}
                                                    onClick={() => dispatch(verifyManagerMode())}
                                                    style={{
                                                        marginTop: 12,
                                                        height: 52,
                                                        borderRadius: 12,
                                                        fontSize: 15,
                                                        fontWeight: 800,
                                                        letterSpacing: 0.4,
                                                        textTransform: 'uppercase',
                                                        background: 'linear-gradient(135deg, #16A34A 0%, #128A3F 100%)',
                                                        border: 'none',
                                                        boxShadow: '0 10px 22px rgba(22, 163, 74, 0.30)'
                                                    }}
                                                >
                                                    <FontAwesomeIcon icon={faKey} style={{ marginRight: 8 }} />
                                                    Verify Access
                                                </Button>
                                            </div>
                                        )}

                                        {/* Placeholder while reason not picked */}
                                        {isPriceChangeAwaitingReason && (
                                            <div style={{
                                                marginTop: 4,
                                                padding: '14px 16px',
                                                background: 'rgba(250, 137, 0, 0.08)',
                                                border: '1px solid rgba(250, 137, 0, 0.30)',
                                                borderRadius: 10,
                                                color: '#B45309',
                                                fontSize: 13,
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8
                                            }}>
                                                <FontAwesomeIcon icon={faExclamationTriangle} />
                                                Select a reason first to generate the authorization QR.
                                            </div>
                                        )}
                                    </div>

                                    {/* Footer */}
                                    <div style={{
                                        padding: '0 22px 22px 22px',
                                        display: 'flex',
                                        justifyContent: 'center'
                                    }}>
                                        <Button
                                            block
                                            onClick={() => dispatch(holdQrAuthCheck())}
                                            style={{
                                                height: 52,
                                                borderRadius: 12,
                                                fontSize: 14,
                                                fontWeight: 700,
                                                letterSpacing: 0.4,
                                                textTransform: 'uppercase',
                                                border: '1px solid #E5E7EB',
                                                background: '#FFFFFF',
                                                color: '#374151',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 8
                                            }}
                                        >
                                            <FontAwesomeIcon icon={faBan} />
                                            Back to Transaction
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()
                }
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={10} style={{
                position: 'relative',
                height: 'calc(100vh / 0.9)',
                background: '#F8FAFC',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                <div style={{
                    background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
                    color: 'white',
                    height: '5vh',
                    width: '100%',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 16px',
                    boxShadow: '0 2px 6px rgba(17, 24, 39, 0.12)',
                    borderLeft: '1px solid #E5E7EB'
                }}>
                    <h6 style={{
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '13px',
                        fontWeight: 600,
                        letterSpacing: '0.3px',
                        fontFamily: '"Inter", "Segoe UI", sans-serif'
                    }}>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '7px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                            <FontAwesomeIcon icon={faUser} style={{ fontSize: '11px', opacity: 0.85 }} />
                            {terminal.loggedInUser ?
                                (terminal.loggedInUser.employeeNumber ? terminal.loggedInUser.employeeNumber.concat(' · ') : '').concat(terminal.loggedInUser.username) : 'No User'}
                        </span>
                        <span style={{
                            color: 'rgba(255, 255, 255, 0.7)',
                            fontSize: '12px',
                            fontFamily: '"Inter", "Segoe UI", sans-serif',
                            fontWeight: 700,
                            letterSpacing: '0.5px'
                        }}>
                            {terminal.till && terminal.till.workDay ? terminal.till.workDay.businessDateAsString : 'No Work Day'}
                        </span>
                    </h6>
                </div>

                <div id='rightPosPanel' style={{
                    background: '#FFFFFF',
                    padding: '10px 12px',
                    borderBottom: '1px solid #E5E7EB',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: '#F8FAFC',
                            border: '1px solid #E5E7EB',
                            padding: '6px 12px',
                            borderRadius: '999px',
                            color: '#111827',
                            fontSize: '15px',
                            fontFamily: 'Janna, "Inter", sans-serif',
                            fontWeight: 600
                        }}>
                            <FontAwesomeIcon icon={faIdCard} style={{ color: '#6B7280', fontSize: '14px' }} />
                            {terminal.customer ? terminal.customer.customerName : 'No Customer'}
                        </span>

                        {terminal.customer && terminal.customer.club && (
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(250, 137, 0, 0.10)',
                                border: '1px solid rgba(250, 137, 0, 0.28)',
                                padding: '5px 12px',
                                borderRadius: '999px',
                                color: '#B45309',
                                fontSize: '12px',
                                fontWeight: 700,
                                letterSpacing: '0.3px',
                                textTransform: 'uppercase'
                            }}>
                                <FontAwesomeIcon icon={faStar} />
                                Club
                                {terminal.customer && terminal.customer.employee && (
                                    <b style={{ color: '#E11E26', marginLeft: 2 }}>(E)</b>
                                )}
                                {terminal.customer.cashbackBalance && (
                                    <b style={{ marginLeft: 4, color: '#111827' }}>
                                        <span style={{ fontFamily: '"DSDIGI", monospace' }}>{Math.round(Number(terminal.customer.cashbackBalance) * 10000) / 10000}</span>
                                        <small style={{ color: '#6B7280', fontFamily: '"Inter", "Segoe UI", sans-serif', marginLeft: 3 }}>
                                            {config.systemCurrency === 'NIS' ? 'JD' : 'JD'}
                                        </small>
                                    </b>
                                )}
                            </span>
                        )}

                        {terminal.managerMode && (
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(225, 30, 38, 0.10)',
                                border: '1px solid rgba(225, 30, 38, 0.28)',
                                padding: '5px 12px',
                                borderRadius: '999px',
                                color: '#B3141B',
                                fontSize: '12px',
                                fontWeight: 700,
                                letterSpacing: '0.3px',
                                textTransform: 'uppercase'
                            }}>
                                <FontAwesomeIcon icon={faShieldHalved} />
                                Manager
                            </span>
                        )}

                        {!hasEshiniConnection && (
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(217, 119, 6, 0.10)',
                                border: '1px solid rgba(217, 119, 6, 0.28)',
                                padding: '5px 12px',
                                borderRadius: '999px',
                                color: '#B45309',
                                fontSize: '11px',
                                fontWeight: 700,
                                letterSpacing: '0.3px',
                                textTransform: 'uppercase'
                            }}>
                                <FontAwesomeIcon icon={faExclamationTriangle} />
                                No E-Shini Connection
                            </span>
                        )}
                    </div>
                    
                    {terminal.paymentMode && trxSlice.trx && trxSlice.trx.affectedByPlusTax && trxSlice.trx.totalPlusTaxAmt > 0 && (
                        <div style={{
                            marginTop: '10px',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#991B1B',
                            background: 'rgba(220, 38, 38, 0.06)',
                            border: '1px solid rgba(220, 38, 38, 0.2)',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            textAlign: 'center'
                        }}>
                            * Required Plus Tax = {config.systemCurrency === 'NIS' ? 'JD' : 'JD'} <span style={{ fontFamily: '"DSDIGI", monospace' }}>{trxSlice.trx.totalPlusTaxAmt}</span>
                        </div>
                    )}

                    {
                        trxSlice.lastTrxPayment &&
                        <div style={{
                            border: '1px solid #E5E7EB',
                            borderRadius: '12px',
                            padding: '10px 14px',
                            margin: '12px auto',
                            background: '#F8FAFC',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px'
                        }}>
                            <div>
                                <div style={{ fontSize: '10px', color: '#6B7280', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Last Paid</div>
                                <label id='Total' style={{
                                    fontSize: '20px',
                                    fontWeight: 800,
                                    color: '#111827',
                                    fontFamily: '"DSDIGI", monospace'
                                }}>
                                    {(Math.round(trxSlice.lastTrxPayment.paid * 100) / 100).toFixed(config.systemCurrency === 'NIS' ? 2 : 3)}
                                </label>
                            </div>
                            <div style={{ width: 1, alignSelf: 'stretch', background: '#E5E7EB' }} />
                            <div>
                                <div style={{ fontSize: '10px', color: '#6B7280', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Change</div>
                                <label id='Total' style={{
                                    fontSize: '20px',
                                    fontWeight: 800,
                                    color: trxSlice.lastTrxPayment.change < 0 ? '#B91C1C' : '#047857',
                                    fontFamily: '"DSDIGI", monospace'
                                }}>
                                    {(Math.round(trxSlice.lastTrxPayment.change * 100) / 100).toFixed(config.systemCurrency === 'NIS' ? 2 : 3)}
                                </label>
                            </div>
                        </div>
                    }
                </div>

                {/* Mode Buttons — top row 3 TALL (Payment / Scale / Fast),
                    bottom row 3 NORMAL (Suspended / Void / Change Price).
                    Operations has been moved into the footer. */}
                <div className={classes.ModeButtons}>
                    {/* Top row — tall, 2× the height of a normal button */}
                    <div className={classes.ModeButtonsRow}>
                        <Button className={`${classes.POSButton} ${classes.ModeButton} ${classes.ModeButtonTall} ${actionsMode !== 'payment' ? classes.ModeButtonPayment : ''}`}
                            appearance={actionsMode === 'payment' ? 'primary' : 'default'}
                            color='red'
                            onClick={() => { setActionsMode('payment') }} >
                            <FontAwesomeIcon icon={faSackDollar} />
                            <div>Payment</div>
                        </Button>

                        <Button className={`${classes.POSButton} ${classes.ModeButton} ${classes.ModeButtonTall}`}
                            disabled={terminal.paymentMode || !config.scale || !scaleConnected}
                            onClick={() => setScaleItemsOpen(true)} >
                            <FontAwesomeIcon icon={faScaleBalanced} />
                            <div>Scale Items</div>
                        </Button>

                        <Button className={`${classes.POSButton} ${classes.ModeButton} ${classes.ModeButtonTall}`}
                            disabled={terminal.paymentMode}
                            appearance={actionsMode === 'fastItems' ? 'primary' : 'default'}
                            color='green'
                            onClick={() => setActionsMode('fastItems')} >
                            <FontAwesomeIcon icon={faCarrot} />
                            <div>Fast Items</div>
                        </Button>
                    </div>

                    {/* Bottom row — normal height, 3 buttons */}
                    <div className={classes.ModeButtonsRow}>
                        <Button className={`${classes.POSButton} ${classes.ModeButton}`}
                            disabled={terminal.paymentMode}
                            appearance={actionsMode === 'suspended' ? 'primary' : 'default'}
                            color='green'
                            onClick={() => setActionsMode('suspended')} >
                            <FontAwesomeIcon icon={faHistory} />
                            <div>Suspended</div>
                        </Button>

                        {terminal.paymentMode ? (
                            <Button className={`${classes.POSButton} ${classes.ModeButton}`}
                                onClick={handleVoidLine}
                                disabled={!trxSlice.selectedPayment || !trxSlice.selectedPayment.key}
                                appearance='primary' color='blue'>
                                <FontAwesomeIcon icon={faEraser} />
                                <div>Void Payment</div>
                            </Button>
                        ) : (
                            <Button className={`${classes.POSButton} ${classes.ModeButton}`}
                                onClick={handleVoidLine}
                                disabled={!trxSlice.selectedLine || !trxSlice.selectedLine.key}
                                appearance='primary' color='blue'>
                                <FontAwesomeIcon icon={faEraser} />
                                <div>Void Line</div>
                            </Button>
                        )}

                        {terminal.paymentMode ? (
                            <Button className={`${classes.POSButton} ${classes.ModeButton}`}
                                onClick={handleAbort}
                                appearance='primary' color='red'>
                                <FontAwesomeIcon icon={faBan} />
                                <div>
                                    {(actionsMode === 'payment' && terminal.paymentType === 'none') ? 'Cancel'
                                        : (actionsMode === 'payment' && terminal.paymentType !== 'none') ? 'Back'
                                            : 'Abort'}
                                </div>
                            </Button>
                        ) : (
                            <Button className={`${classes.POSButton} ${classes.ModeButton}`}
                                disabled={!trxSlice.selectedLine || !trxSlice.selectedLine.key}
                                onClick={handlePriceChange}
                                appearance='primary' color={trxSlice.priceChangeMode ? 'orange' : 'blue'}>
                                <FontAwesomeIcon icon={faTags} />
                                <div>{trxSlice.priceChangeMode ? 'Cancel' : 'Change Price'}</div>
                            </Button>
                        )}
                    </div>
                </div>

                <div style={{
                    background: 'white',
                    padding: '8px 10px 10px 10px',
                    marginTop: 'auto',
                    flexShrink: 0
                }}>
                    <Numpad setAuthQR={setAuthQR} incrementTrxCount={incrementTrxCount} />
                </div>

                {/* Transaction Summary — sits UNDER the numpad inside the middle
                    column. Shows Grand Total, Paid / Change / Due in payment mode,
                    and a pills row with item count + cashback + tax. */}
                <div className={classes.TrxSummaryPanel}>
                    <div className={classes.TrxSummaryRow}>
                        {/* Grand Total (always visible) */}
                        <div
                            key={`gt-${trxSlice.trx ? trxSlice.trx.totalafterdiscount : 0}`}
                            className={`${classes.FooterCell} ${classes.FooterCellTotal}`}
                            style={{ alignItems: 'flex-start' }}
                        >
                            <span className={`${classes.FooterLabel} ${terminal.trxMode === 'Refund' ? classes.FooterLabelRed : classes.FooterLabelAccent}`}>
                                {terminal.trxMode === 'Refund' ? 'Refund Total' : 'Grand Total'}
                            </span>
                            <div className={classes.FooterAmountRow}>
                                <small className={classes.FooterCurrency}>
                                    {config.systemCurrency === 'NIS' ? 'JD' : 'JD'}
                                </small>
                                <label id='Total' className={`${classes.FooterAmount} ${classes.FooterAmountGrand} ${terminal.trxMode === 'Refund' ? classes.FooterAmountRed : ''}`}>
                                    {trxSlice.trx ? ((trxSlice.trx.totalafterdiscount * 100) / 100).toFixed(config.systemCurrency === 'NIS' ? 2 : 3) : '0.00'}
                                </label>
                            </div>
                        </div>

                        {/* Payment-mode only: Paid stacked on top of Change/Due
                            inside a single column so the pills on the right stay
                            visible instead of getting clipped. */}
                        {terminal.paymentMode && (
                            <div className={classes.FooterCellPaidDue}>
                                <div className={`${classes.FooterCell} ${classes.FooterCellPaid}`}>
                                    <span className={classes.FooterLabel}>Paid</span>
                                    <div className={classes.FooterAmountRow}>
                                        <small className={classes.FooterCurrency}>
                                            {config.systemCurrency === 'NIS' ? 'JD' : 'JD'}
                                        </small>
                                        <label id='PaidAmt' className={classes.FooterAmount}>
                                            {(Math.round(trxSlice.trxPaid * 100) / 100).toFixed(config.systemCurrency === 'NIS' ? 2 : 3)}
                                        </label>
                                    </div>
                                </div>
                                <div
                                    key={`cd-${trxSlice.trxChange}`}
                                    className={`${classes.FooterCell} ${trxSlice.trxChange < 0 ? classes.FooterCellDue : classes.FooterCellChange}`}
                                >
                                    <span className={`${classes.FooterLabel} ${trxSlice.trxChange < 0 ? classes.FooterLabelRed : classes.FooterLabelGreen}`}>
                                        {trxSlice.trxChange > 0 ? 'Change' : 'Due'}
                                    </span>
                                    <div className={classes.FooterAmountRow}>
                                        <small className={classes.FooterCurrency} style={{ color: trxSlice.trxChange < 0 ? '#B91C1C' : '#047857' }}>
                                            {config.systemCurrency === 'NIS' ? 'JD' : 'JD'}
                                        </small>
                                        <label className={`${classes.FooterAmount} ${trxSlice.trxChange < 0 ? classes.FooterAmountRed : classes.FooterAmountGreen}`}>
                                            {(Math.round(trxSlice.trxChange * 100) / 100).toFixed(config.systemCurrency === 'NIS' ? 2 : 3)}
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Pills (items / cashback / tax) — pinned to the right
                            of the same row so everything fits in one card. */}
                        <div className={classes.TrxSummaryPills}>
                            <div className={classes.FooterPills}>
                                <span className={`${classes.FooterPill} ${classes.FooterPillItems}`}>
                                    <FontAwesomeIcon icon={faList} style={{ fontSize: 10, opacity: 0.7 }} />
                                    <b>{trxSlice.scannedItems ? trxSlice.scannedItems.length : 0}</b>
                                    Items
                                </span>
                                {trxSlice.trx && trxSlice.trx.totalcashbackamt > 0 && (
                                    <span className={`${classes.FooterPill} ${classes.FooterPillCashback}`}>
                                        <FontAwesomeIcon icon={faStar} style={{ fontSize: 10 }} />
                                        Cashback
                                        <b>{((trxSlice.trx.totalcashbackamt * 100) / 100).toFixed(config.systemCurrency === 'NIS' ? 2 : 3)}</b>
                                    </span>
                                )}
                                <span className={`${classes.FooterPill} ${trxSlice.trx && trxSlice.trx.isTaxExempt ? classes.FooterPillTaxExempt : classes.FooterPillTax}`}>
                                    <FontAwesomeIcon icon={faTag} style={{ fontSize: 10 }} />
                                    Tax
                                    <b>{trxSlice.trx ? (((trxSlice.trx.totalTaxAmt) * 100) / 100).toFixed(config.systemCurrency === 'NIS' ? 2 : 3) : (0).toFixed(config.systemCurrency === 'NIS' ? 2 : 3)}</b>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={4} style={{
                position: 'relative',
                background: '#F8FAFC',
                height: 'calc(100vh / 0.9)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                borderLeft: '1px solid #E5E7EB'
            }}>
                <div style={{
                    background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
                    color: 'white',
                    height: '5vh',
                    width: '100%',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 8px',
                    boxShadow: '0 2px 6px rgba(17, 24, 39, 0.12)',
                    overflow: 'hidden'
                }}>
                    <img
                        src={Logo}
                        onClick={handleLogoTap}
                        alt="Shini Extra Jordan"
                        style={{
                            maxHeight: 'calc(5vh - 8px)',
                            maxWidth: '100%',
                            objectFit: 'contain',
                            cursor: 'pointer',
                            display: 'block'
                        }}
                    />
                </div>
                <div style={{ marginTop: 8, flex: 1, overflow: 'hidden' }}>
                    <FlexboxGrid justify='space-between' className={`${classes.RailScroll} ${classes.RailScrollPadded}`} style={{
                        height: "100%",
                        overflowY: "auto",
                        overflowX: "hidden",
                        width: "100%"
                    }}>

                        <FlexboxGrid.Item colspan={24} style={{ overflow: 'hidden' }}>
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
                                actionsMode === 'payment' && terminal.paymentType === 'mobiCash' &&
                                buildMobiCashButtons()
                            }

                            {
                                actionsMode === 'payment' && terminal.paymentType === 'talabat' &&
                                buildMobiCashButtons()
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

                            {/* {
                                actionsMode === 'payment' && terminal.trxMode !== 'Refund' && terminal.paymentType === 'cashBack' &&
                                buildCashBackCouponButtons()
                            } */}

                            {
                                actionsMode === 'payment' && terminal.trxMode !== 'Refund' && terminal.paymentType === 'cashBack' &&
                                buildCashBackButtons()
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

                {/* Operations button docked to the bottom of the right rail.
                    Sits inside its own backdrop panel so any actions behind
                    it are visually hidden; RailScrollPadded adds matching
                    bottom padding to the scroll area so those hidden actions
                    can be scrolled up into view. */}
                <div className={classes.FooterOpsBackdrop}>
                    <Button
                        className={`${classes.FooterOpsButton} ${classes.FooterOpsButtonFloating} ${actionsMode === 'operations' ? classes.FooterOpsButtonActive : ''}`}
                        disabled={terminal.paymentMode}
                        onClick={() => setActionsMode('operations')}
                    >
                        <FontAwesomeIcon icon={faShieldHalved} />
                        <span>Operations</span>
                    </Button>
                </div>
            </FlexboxGrid.Item>

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
                                    {filteredProduceItems.map((item) => {
                                        const imgSrc = images[`${item.barcode}.png`] || images[`PLU_${item.barcode}.jpg`] || images['nophoto.jpg'];

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

                            </ButtonToolbar>
                        </Col>
                        <Col xs={5}>
                        </Col>
                        <Col xs={12}>
                            <ButtonToolbar style={{ textAlign: 'right' }} >
                                <IconButton
                                    style={{
                                        width: '120px',
                                        backgroundColor: selectedScaleCategory === 'all' ? '#34c759' : 'transparent',
                                        color: selectedScaleCategory === 'all' ? 'white' : '#007acc',
                                        border: selectedScaleCategory === 'all' ? '2px solid #34c759' : '2px solid #007acc',
                                        fontWeight: selectedScaleCategory === 'all' ? 'bold' : 'normal'
                                    }}
                                    icon={<Global />}
                                    appearance={selectedScaleCategory === 'all' ? 'primary' : 'ghost'}
                                    onClick={() => { setSelectedScaleCategory('all') }} >
                                    All Items
                                </IconButton>
                                <IconButton
                                    style={{
                                        width: '120px',
                                        backgroundColor: selectedScaleCategory === 'fruit' ? '#ff9500' : 'transparent',
                                        color: selectedScaleCategory === 'fruit' ? 'white' : '#ff9500',
                                        border: selectedScaleCategory === 'fruit' ? '2px solid #ff9500' : '2px solid #ff9500',
                                        fontWeight: selectedScaleCategory === 'fruit' ? 'bold' : 'normal'
                                    }}
                                    icon={<IOs />}
                                    appearance={selectedScaleCategory === 'fruit' ? 'primary' : 'ghost'}
                                    onClick={() => { setSelectedScaleCategory('fruit') }} >
                                    Fruits
                                </IconButton>
                                <IconButton
                                    style={{
                                        width: '120px',
                                        backgroundColor: selectedScaleCategory === 'vegetable' ? '#30d158' : 'transparent',
                                        color: selectedScaleCategory === 'vegetable' ? 'white' : '#30d158',
                                        border: selectedScaleCategory === 'vegetable' ? '2px solid #30d158' : '2px solid #30d158',
                                        fontWeight: selectedScaleCategory === 'vegetable' ? 'bold' : 'normal'
                                    }}
                                    icon={<Funnel />}
                                    appearance={selectedScaleCategory === 'vegetable' ? 'primary' : 'ghost'}
                                    onClick={() => { setSelectedScaleCategory('vegetable') }}>
                                    Vegetables
                                </IconButton>
                            </ButtonToolbar>
                        </Col>
                    </Row>
                </Grid>
            </Drawer>

            <Modal open={settingsOpen} onClose={() => { setSettingsOpen(false) }}  >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '14px'
                }}>
                    <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, #E11E26 0%, #B3141B 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 6px 14px rgba(225, 30, 38, 0.25)'
                    }}>
                        <FontAwesomeIcon icon={faCogs} style={{ color: '#fff', fontSize: '17px' }} />
                    </div>
                    <div>
                        <h4 style={{ margin: 0, fontWeight: 800, color: '#111827', letterSpacing: '0.2px' }}>
                            POS Settings
                        </h4>
                        <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>
                            Device, scale, and maintenance
                        </div>
                    </div>
                </div>
                <Divider style={{ margin: '6px 0 12px 0' }} />
                <Panel bordered header='Integrated Scale' style={{ margin: '10px 0', borderRadius: 12, background: '#F8FAFC' }}>
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
                <Panel bordered header='General' style={{ margin: '10px 0', borderRadius: 12, background: '#F8FAFC' }}>
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
                        {/* <Button appearance='primary' onClick={() => {
                            dispatch(printTrx(trxSlice.trx.key));
                        }} >
                            Print
                        </Button> */}

                    </ButtonToolbar>
                    <br />
                    {/* <Input type='password' key='adminPasskey' placeholder='Admin Passkey'
                        style={{ width: 150, display: 'inline-block', marginRight: 5 }}
                        value={passkey}
                        onChange={(e) => { setPasskey(e) }} >
                    </Input> */}
                    <VirtualKeyboardInput key='adminPasskey' input={passkey} setInput={setPasskey} />
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

            <Modal open={lastTrxOpen} onClose={() => { setLastTrxOpen(false) }}  >
                <h4 style={{ padding: '0px', margin: '0px' }}>
                    Print Last 10 Transactions
                </h4>
                <Divider style={{ margin: '5px' }} />
                <Panel bordered style={{ margin: '10px' }}>
                    {lastTrxList && <ButtonToolbar >
                        {lastTrxList.map((trx, i) => {
                            return (<Button
                                style={{
                                    display: 'inline-block', margin: 7, width: '45%'
                                }}
                                appearance='ghost' color='cyan' onClick={() => {
                                    dispatch(showLoading())
                                    dispatch(printTrxNoDrawer(trx.key));
                                    setLastTrxOpen(false);
                                }} >
                                <p style={{ textAlign: 'left' }}>
                                    #{(i + 1)}  PRINT ( {trx.totalafterdiscount} {config.systemCurrency} )
                                </p>
                            </Button>)
                        })}
                    </ButtonToolbar>}
                </Panel>
            </Modal>

            {/* CashDro Payment Modal */}
            <Modal open={cashDroModalOpen} backdrop="static" keyboard={false} size="sm">
                <Modal.Header closeButton={false}>
                    <Modal.Title>
                        <FontAwesomeIcon icon={faMoneyBill} style={{ marginRight: '10px', color: '#2e7d32' }} />
                        CashDro Payment
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ textAlign: 'center', padding: '30px' }}>
                    <div style={{ fontSize: '18px', marginBottom: '20px' }}>
                        {cashDroStatus.message}
                    </div>
                    {cashDroStatus.state === 'PENDING' && (
                        <div style={{ 
                            fontSize: '28px', 
                            fontWeight: 'bold', 
                            color: '#2e7d32',
                            marginBottom: '20px' 
                        }}>
                            Inserted: {cashDroStatus.totalIn.toFixed(2)} {config.systemCurrency}
                        </div>
                    )}
                    {cashDroStatus.state === 'PENDING' && (
                        <div style={{ color: '#666', fontSize: '14px' }}>
                            Waiting for customer to complete payment...
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button 
                        onClick={handleCancelCashDro} 
                        appearance="primary" 
                        color="red"
                        style={{ width: '100%' }}
                    >
                        <FontAwesomeIcon icon={faBan} style={{ marginRight: '5px' }} />
                        Cancel Payment
                    </Button>
                </Modal.Footer>
            </Modal>

            <RefundReferenceDialog
                open={refundReferenceDialogOpen}
                onClose={handleRefundReferenceDialogClose}
                onValidated={handleRefundReferenceValidated}
            />

            <CustomCustomerNameDialog
                open={customCustomerNameDialogOpen}
                onClose={() => setCustomCustomerNameDialogOpen(false)}
            />
            <CustomCustomerMobileDialog
                open={customCustomerMobileDialogOpen}
                onClose={() => setCustomCustomerMobileDialogOpen(false)}
            />
            <ReferenceNumberDialog
                open={referenceNumberDialogOpen}
                onClose={() => setReferenceNumberDialogOpen(false)}
            />

        </FlexboxGrid >
    );
}

export default Terminal;