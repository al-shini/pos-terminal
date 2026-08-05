import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux'
import axios from '../../axios';
import { Button, FlexboxGrid, Divider, Input, SelectPicker, Drawer, ButtonGroup, IconButton, ButtonToolbar, Grid, Row, Col, Panel, Modal } from 'rsuite';
import classes from './Terminal.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSackDollar, faMoneyBillTransfer, faRepeat, faUser, faScaleBalanced, faTag, faChevronUp, faChevronDown, faCogs,
    faCarrot, faShieldHalved, faMoneyBill, faIdCard, faTimes, faEraser, faBan, faPause, faRotateLeft, faDollarSign, faLock, faUnlock, faSearch, faStar, faChain, faHistory, faPlay, faPlusSquare, faTags, faKey, faExclamationTriangle, faList, faCheck, faArrowRightFromBracket, faQrcode, faMobileScreenButton, faHashtag, faMotorcycle, faBullhorn, faHourglassHalf, faBoxOpen, faAppleWhole, faLeaf, faPlug, faTriangleExclamation, faWeightScale
} from '@fortawesome/free-solid-svg-icons'
import Numpad from './Numpad';
import Invoice from './Invoice';
import Payments from './Payments';
import BalanceSetup from './BalanceSetup';
import terminalSlice, {
    beginPayment, uploadCurrencies, abort, endPaymentMode, exitNumpadEntry, reset,
    uploadCashButtons, setPaymentType, uploadForeignButtons, uploadPaymentMethods, uploadFastItems, setTrxMode, lockTill, unlockTill, uploadExchangeRates, setCustomer, setManagerMode, setTerminal, fetchSuspendedForTill, setManagerUser, verifyManagerMode,
    logout
} from '../../store/terminalSlice';
import {
    selectCurrency, submitPayment, clearNumberInput, scanBarcode, scanNewTransaction, setTrx,
    selectPaymentMethod, suspendTrx, enablePriceChange, disablePriceChange,
    checkOperationQrAuth, startQrAuthCheck, holdQrAuthCheck, voidTrx, voidPayment, voidLine, rescanTrx, closeTrxPayment, clearLastPaymentHistory, setPriceChangeReason, prepareScanMultiplierPreDefined,
    fullTrxTaxExempt,
    printTrx, clearOriginalTrxReference, setOriginalTrxReference, setCustomCustomerName,
    printTrxNoDrawer, selectLine
} from '../../store/trxSlice';
import { hideLoading, notify, showHardNotification, showLoading } from '../../store/uiSlice';
import FlexboxGridItem from 'rsuite/esm/FlexboxGrid/FlexboxGridItem';
import confirm, { AR_CONFIRM_OPTS } from '../UI/ConfirmDlg';
import config from '../../config';
import SS_AR from './SelfService/i18n';
import { roundToCashDro, reconcileCashDro } from '../../utils/cashRounding';
import { settleCollection, createOnceGate } from '../../utils/cashDroSettlement';
import { arabicize } from '../../utils/arabicMessages';
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
import InactivityHandler from '../InactivityHandler';
import VirtualKeyboardInput from '../UI/VirtualKeyboardInput';
import RefundReferenceDialog from './RefundReferenceDialog';
import CustomCustomerNameDialog from './CustomCustomerNameDialog';
import CustomCustomerMobileDialog from './CustomCustomerMobileDialog';
import ReferenceNumberDialog from './ReferenceNumberDialog';
import SelfServiceView from './SelfService/SelfServiceView';
// Browser-safe Electron access: in dev/browser (no Electron runtime) the two
// ipcRenderer uses (dev-tools & update-check buttons) become harmless no-ops.
const { ipcRenderer } = (typeof window !== 'undefined' && window.require)
    ? window.require('electron')
    : { ipcRenderer: { send: () => { }, on: () => { } } };


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
        // 'others' lives in its own array (otherScaleItems) and is matched by
        // sub_segment rather than category; the produce filter never sees it.
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
    // Self-checkout card-reader sale in flight: { status, message, chargeAmount }
    // where status is 'prompting' | 'declined' | 'unknown'. Null when idle.
    const [bopSale, setBopSale] = useState(null);
    const [passkey, setPasskey] = useState('');
    const [play] = useSound(errorBeep);
    const [groupedFastItems, setGroupedFastItems] = useState({});
    const [selectedFGroup, setSelectedFGroup] = useState(null);
    const [scaleItemsOpen, setScaleItemsOpen] = useState(false);
    const [scaleConnected, setScaleConnected] = useState(false);
    // 'all' | 'fruit' | 'vegetable' | 'others'
    const [selectedScaleCategory, setSelectedScaleCategory] = useState('all');
    const [produceItems, setProduceItems] = useState([]);
    // "Others" = anything weighable that isn't fruit/vegetable, sourced from
    // the dedicated pos_other_scale_items table at HO via the local store
    // backend. Tenant-gated via config.features.otherScaleItems — Palestine
    // pos-backend doesn't expose the endpoint yet, so we don't even fetch
    // there.
    const [otherScaleItems, setOtherScaleItems] = useState([]);
    // Active sub-segment chip when the "Others" category is selected (e.g.
    // "Cheese", "Dates"). `null` means show every sub-segment. The chip list
    // itself is rendered dynamically from the distinct sub_segments in
    // otherScaleItems, so HO can add new sub-segments without a code change.
    const [selectedOtherSubSegment, setSelectedOtherSubSegment] = useState(null);
    // Top 16 most-scanned scale barcodes at this store over the past 7 days.
    // Fetched once on terminal init (see useEffect below) so the "History"
    // filter in the scale-items drawer is instant and doesn't re-query the
    // store DB every time the cashier opens the drawer.
    const [topScaleBarcodes, setTopScaleBarcodes] = useState([]);
    // Filter mode inside the scale-items drawer:
    //  - 'history': show only items from topScaleBarcodes (default)
    //  - 'alpha'  : show items whose Arabic name starts with `alphabtet`
    const [scaleFilterMode, setScaleFilterMode] = useState('history');
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
    // Timers live in refs, not state: the poll loop and the walk-away timeout
    // both need to see the CURRENT session, and a state variable captured when
    // the session started is stale by the time they run.
    const cashDroPollRef = useRef(null);
    const cashDroTimeoutRef = useRef(null);
    const cashDroBusyRef = useRef(false);
    // Latch for the current CashDro session: whoever takes it owns the outcome.
    const cashDroOutcomeRef = useRef(null);
    // Set when CashDro has taken cash that could not be turned into a payment.
    // Blocks the lane until staff clear it: { amount, cashdroId, reason, detail }
    const [cashDroRecovery, setCashDroRecovery] = useState(null);
    // Self-checkout: show the "payment complete / take receipt" screen after
    // CashDro + closeTrxPayment succeed. Cleared by SelfServiceView after a few seconds.
    const [selfServiceShowReceipt, setSelfServiceShowReceipt] = useState(false);
    
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

    // One-shot fetch of the "Others" scale items. Gated by the tenant
    // feature flag because the Palestine pos-backend doesn't expose
    // /barcode/otherScaleItems yet — calling it there would log a 404 on
    // every till boot.
    useEffect(() => {
        if (!config.scale) return;
        if (!config.features.otherScaleItems) return;
        if (otherScaleItems.length > 0) return;
        axios({
            method: 'get',
            url: '/barcode/otherScaleItems',
        }).then((response) => {
            if (response && Array.isArray(response.data)) {
                setOtherScaleItems(response.data);
            }
        }).catch((error) => {
            // Non-fatal: the drawer keeps working for F&V even if this fails.
            // We surface a single soft warning rather than blocking till
            // startup, since "Others" is an additive section.
            dispatch(notify({ msg: 'otherScaleItems fetch failed: ' + error.message, sev: 'warning' }));
        });
    }, [])

    // One-shot fetch of the top-16 most-scanned scale barcodes for the current
    // store over the past 7 days. We intentionally run this only on till
    // initialization — the list is small, bounded, and changes slowly, so
    // re-querying on every drawer open would be needless DB traffic.
    useEffect(() => {
        if (!config.scale) return;
        axios({
            method: 'get',
            url: '/barcode/topScaleItems',
        }).then((response) => {
            if (response && Array.isArray(response.data)) {
                setTopScaleBarcodes(response.data);
            }
        }).catch(() => {
            // Non-fatal: if the history lookup fails, the cashier can still
            // use the Arabic letter filter. We swallow the error silently
            // because the drawer is a tertiary UI and we don't want to spam
            // notifications during till startup.
        });
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

    // Memoized filtered produce items to ensure fresh filtering on each
    // alphabet / category / mode change.
    //
    // Two filter modes are supported:
    //   - 'history' : narrow to the 16 most-scanned scale barcodes at this
    //                 store over the past 7 days (fetched once on init), then
    //                 sort alphabetically by Arabic description — requested so
    //                 cashiers don't have to guess the first letter for items
    //                 they weigh dozens of times a day.
    //   - 'alpha'   : classic "starts-with" filter on Arabic description.
    // Category pills (All / Fruit / Vegetable) apply in both modes.
    const filteredProduceItems = useMemo(() => {
        if (!produceItems || produceItems.length === 0) {
            return [];
        }

        let filtered;
        if (scaleFilterMode === 'history') {
            if (!topScaleBarcodes || topScaleBarcodes.length === 0) {
                filtered = [];
            } else {
                const barcodeSet = new Set(topScaleBarcodes.map(String));
                filtered = produceItems.filter((item) =>
                    barcodeSet.has(String(item.barcode)) &&
                    matchProduceCategory(selectedScaleCategory, item.category)
                );
            }
        } else if (scaleFilterMode === 'all') {
            // No history/alpha narrowing — only the category pill applies.
            // Useful when the cashier knows what they're looking for but
            // the item isn't a "top scanned" one and they don't want to
            // guess the first letter.
            filtered = produceItems.filter((item) =>
                matchProduceCategory(selectedScaleCategory, item.category)
            );
        } else {
            const normalizedAlphabet = alphabtet.toString().trim();
            filtered = produceItems.filter((item) => {
                const itemDescAr = item.descriptionAr || '';
                const normalizedItemDesc = itemDescAr.toString().trim();
                return normalizedItemDesc &&
                    normalizedItemDesc.startsWith(normalizedAlphabet) &&
                    matchProduceCategory(selectedScaleCategory, item.category);
            });
        }

        // Remove duplicates by barcode to prevent React key conflicts.
        const uniqueItems = filtered.reduce((acc, current) => {
            const existingItem = acc.find(item => item.barcode === current.barcode);
            if (!existingItem) {
                acc.push(current);
            }
            return acc;
        }, []);

        // History and All views are always alphabetical — ranking by scan
        // count would confuse cashiers who already know where each item
        // lives visually.
        if (scaleFilterMode === 'history' || scaleFilterMode === 'all') {
            uniqueItems.sort((a, b) => {
                const an = (a.descriptionAr || '').toString();
                const bn = (b.descriptionAr || '').toString();
                return an.localeCompare(bn, 'ar');
            });
        }

        return uniqueItems;
    }, [produceItems, alphabtet, selectedScaleCategory, scaleFilterMode, topScaleBarcodes]);

    // Distinct sub-segments from the loaded "Others" rows. Used to render the
    // dynamic chip row below the main category pills when the cashier picks
    // the "Others" tab — HO can add a brand-new sub-segment by inserting a
    // row in pos_other_scale_items with that label and it will show up here
    // without a code change.
    const otherSubSegments = useMemo(() => {
        if (!otherScaleItems || otherScaleItems.length === 0) return [];
        const set = new Set();
        for (const it of otherScaleItems) {
            const s = (it && it.subSegment) ? String(it.subSegment).trim() : '';
            if (s) set.add(s);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
    }, [otherScaleItems]);

    // Same filter pattern as filteredProduceItems but sourced from the
    // separate otherScaleItems array and gated by sub-segment instead of the
    // fruit/vegetable category regex. History mode still narrows by
    // topScaleBarcodes — so the cashier's "most weighed this week" includes
    // popular Others items too.
    const filteredOtherScaleItems = useMemo(() => {
        if (!config.features.otherScaleItems) return [];
        if (!otherScaleItems || otherScaleItems.length === 0) return [];

        let filtered;
        if (scaleFilterMode === 'history') {
            if (!topScaleBarcodes || topScaleBarcodes.length === 0) {
                filtered = [];
            } else {
                const barcodeSet = new Set(topScaleBarcodes.map(String));
                filtered = otherScaleItems.filter((item) =>
                    barcodeSet.has(String(item.barcode))
                );
            }
        } else if (scaleFilterMode === 'all') {
            filtered = otherScaleItems.slice();
        } else {
            const normalizedAlphabet = alphabtet.toString().trim();
            filtered = otherScaleItems.filter((item) => {
                const itemDescAr = item.descriptionAr || '';
                const normalizedItemDesc = itemDescAr.toString().trim();
                return normalizedItemDesc &&
                    normalizedItemDesc.startsWith(normalizedAlphabet);
            });
        }

        // Apply the sub-segment chip if one is selected (null = show all).
        if (selectedOtherSubSegment) {
            const wanted = selectedOtherSubSegment.toString().trim();
            filtered = filtered.filter((item) => {
                const s = (item.subSegment || '').toString().trim();
                return s === wanted;
            });
        }

        const uniqueItems = filtered.reduce((acc, current) => {
            const exists = acc.find((item) => item.barcode === current.barcode);
            if (!exists) acc.push(current);
            return acc;
        }, []);

        if (scaleFilterMode === 'history' || scaleFilterMode === 'all') {
            uniqueItems.sort((a, b) => {
                const an = (a.descriptionAr || '').toString();
                const bn = (b.descriptionAr || '').toString();
                return an.localeCompare(bn, 'ar');
            });
        }

        return uniqueItems;
    }, [otherScaleItems, alphabtet, scaleFilterMode, topScaleBarcodes, selectedOtherSubSegment]);

    // Single source of truth for whichever list the drawer is currently
    // rendering. Keeping this consolidated avoids sprinkling `selectedScaleCategory === 'others'`
    // ternaries across every count/empty-state/grid render below.
    const drawerItems = selectedScaleCategory === 'others'
        ? filteredOtherScaleItems
        : filteredProduceItems;

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
        // The drawer is openable even without a connected scale (manager
        // preview, onboarding, etc.). Weighing is blocked here — a single
        // guard rather than scattered UI-level disabled states — and we tell
        // the cashier why nothing happened.
        if (!scaleConnected) {
            dispatch(notify({
                msg: 'Scale is not connected. Preview only — connect the scale to weigh items.',
                sev: 'warning'
            }));
            return;
        }
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
    }


    /**
     * The customer-facing line for a CashDro collection that did not settle.
     *
     * 'not-closed' is called out separately on purpose: the payment is on the
     * sale, only the receipt is missing, and telling that customer their money
     * went unrecorded is both false and alarming.
     */
    const cashDroOutcomeMessage = (settlement, expectedAmount) => {
        if (settlement.outcome === 'mismatch') {
            return SS_AR.cashDroAmountMismatch(
                settlement.amount.toFixed(2),
                expectedAmount.toFixed(2)
            );
        }
        if (settlement.outcome === 'not-closed') {
            return SS_AR.cashPaidNotClosedHint;
        }
        return SS_AR.cashHeldHint;
    };

    /**
     * Convert an amount held in the system currency into what a BOP sale needs.
     *
     * The reader is told an ISO 4217 numeric currency and an amount in that
     * currency's minor units — hundredths for ILS and USD, thousandths for JOD.
     * Rounding once, here, is deliberate: multiplying a float by 100 in steps
     * yields values like 10.000000000000002, which is not a whole number of
     * minor units and is rejected before it ever reaches the reader.
     *
     * `value` comes back as the same figure in major units, already rounded the
     * identical way, so the payment recorded against the sale can never drift
     * from the amount actually charged on the card.
     */
    const toBopCharge = (amountInSystemCurrency, currency, exchangeRates) => {
        const codes = { NIS: 376, ILS: 376, JOD: 400, USD: 840 };
        const factor = currency === 'JOD' ? 1000 : 100;
        const rate = currency === config.systemCurrency ? 1 : ((exchangeRates || {})[currency] || 1);
        const minorUnits = Math.round((Math.abs(Number(amountInSystemCurrency)) / rate) * factor);

        return { amt: minorUnits, cur: codes[currency], value: minorUnits / factor };
    };

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

        if (trxSlice.trx && Math.abs(trxSlice.trxChange) > 0) {

            const { amt, cur, value: transactionAmount } = toBopCharge(
                trxSlice.trxChange,
                trxSlice.selectedCurrency,
                terminal.exchangeRates
            );

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
                        dispatch(notify({ msg: visaResponse.error_msg || 'Payment was not approved', sev: 'error' }));
                    }
                }
                dispatch(hideLoading());
            }).catch((error) => {
                const data = error.response && error.response.data;
                // An unknown outcome means the request reached the reader but
                // no answer came back — the card may already be charged, so the
                // cashier has to check the reader before trying again.
                dispatch(notify({
                    msg: (data && data.outcomeUnknown)
                        ? `Card reader did not answer — CHECK THE READER before retrying (ref ${data.rcpt || ''}). ${data.error || ''}`
                        : ((data && data.error) || error.message),
                    sev: 'error'
                }));
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
                    amt = (Math.round(Math.abs(trxSlice.trxChange / terminal.exchangeRates[trxSlice.selectedCurrency]) * 100) / 100).toFixed(config.decimals);
                    break;
                }
            }

            let integerPart = Math.floor(amt);
            let decimalPart = amt - integerPart;
            decimalPart = decimalPart.toFixed(config.decimals);

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

    // A poll loop that outlives the component keeps hitting the server and can
    // submit a payment against a basket that no longer exists on screen.
    useEffect(() => () => {
        if (cashDroPollRef.current) clearInterval(cashDroPollRef.current);
        if (cashDroTimeoutRef.current) clearTimeout(cashDroTimeoutRef.current);
    }, []);

    /** Tear down whatever timers a CashDro session left running. */
    const stopCashDroTimers = () => {
        if (cashDroPollRef.current) {
            clearInterval(cashDroPollRef.current);
            cashDroPollRef.current = null;
        }
        if (cashDroTimeoutRef.current) {
            clearTimeout(cashDroTimeoutRef.current);
            cashDroTimeoutRef.current = null;
        }
    };

    /** Dependencies settleCollection needs to talk to the server. */
    const cashDroSettlementDeps = {
        submitPayment: (payload) => dispatch(submitPayment(payload)).unwrap(),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    };

    /**
     * Collect cash for the WHOLE remaining balance through CashDro.
     *
     * Self-service is deliberately single-tender: a sale is settled entirely by
     * cash or entirely by card, never a mix. The machine is therefore always
     * asked for the full outstanding amount. The previous partial-amount path
     * is what let a 70.00 sale ask the machine for only part of the total, so a
     * customer inserting 100.00 got most of it straight back as "change" while
     * the sale stayed open for the rest.
     */
    const handleCashDroPayment = async () => {
        if (!trxSlice.trx) {
            dispatch(notify({ msg: config.selfService ? SS_AR.noTrxOpen : 'No transaction open', sev: 'warning' }));
            return;
        }

        if (terminal.trxMode === 'Refund') {
            dispatch(notify({ msg: 'CashDro does not support refunds', sev: 'warning' }));
            return;
        }

        if (config.selfService && !(terminal.terminal && terminal.terminal.cashDroIp)) {
            dispatch(notify({
                msg: SS_AR.cashMachineNotConfigured,
                sev: 'error'
            }));
            return;
        }

        // A second session while one is live would open a second operation on
        // the same machine and produce two payment rows for one basket.
        if (cashDroBusyRef.current) {
            return;
        }
        cashDroBusyRef.current = true;

        // Enter payment mode if not already in it
        if (!terminal.paymentMode) {
            dispatch(clearNumberInput());
            dispatch(beginPayment());
            dispatch(setPaymentType({ type: 'cash', inputType: 'fixed' }));
        }

        const trxKeyForSale = trxSlice.trx.key;
        const totalDue = trxSlice.trx.totalafterdiscount || 0;
        const totalPaid = trxSlice.trxPaid || 0;
        const targetAmount = totalDue - totalPaid;

        if (targetAmount <= 0) {
            cashDroBusyRef.current = false;
            dispatch(notify({ msg: config.selfService ? SS_AR.noRemainingAmount : 'No remaining amount to pay', sev: 'warning' }));
            return;
        }

        setCashDroStatus({ message: 'Starting CashDro...', state: 'STARTING', totalIn: 0, changeNotAvailable: 0, targetAmount });
        setCashDroModalOpen(true);

        try {
            // No amount header: the server works out the balance from the live
            // payment rows and collects all of it. Sending a figure derived from
            // this component's cached trxPaid would let a stale cache quietly
            // shrink what the machine asks for, and the customer would get the
            // difference back as change on a sale that never got fully paid.
            const linkResponse = await axios({
                method: 'post',
                url: '/trx/linkTrxToCashDro',
                headers: { trxKey: trxKeyForSale }
            });

            if (!linkResponse.data || !linkResponse.data.cashdroId) {
                throw new Error('Failed to start CashDro operation');
            }

            const cashdroId = linkResponse.data.cashdroId;
            // Reconcile against what the server actually told the machine, taken
            // from the trx it just returned, rounded the same way it rounds. The
            // machine only handles 0.50 steps.
            const linkedTrx = linkResponse.data;
            // The server rebuilds paidamt from the live payment rows when it
            // links, so this is the moment any drift in our cached figures gets
            // corrected on screen.
            dispatch(setTrx(linkedTrx));
            const expectedAmount = roundToCashDro(
                (linkedTrx.totalafterdiscount || 0) - (linkedTrx.paidamt || 0)
            );

            setCashDroStatus({
                message: `Insert ${expectedAmount.toFixed(2)} ${config.systemCurrency} into CashDro machine...`,
                state: 'PENDING',
                totalIn: 0,
                changeNotAvailable: 0,
                // The customer-facing screen must show the figure the machine is
                // actually waiting for, not this component's own estimate.
                targetAmount: expectedAmount
            });

            let consecutivePollErrors = 0;
            // Exactly one thing may end this session: a tick that settles the
            // collection, a tick that gives up on the machine, or a cancel.
            // Deliberately a local, so a tick left in flight from this session
            // can never claim the outcome of a later one.
            const claimOutcome = createOnceGate();
            cashDroOutcomeRef.current = claimOutcome;

            cashDroPollRef.current = setInterval(async () => {
                let droState;
                try {
                    const statusResponse = await axios({
                        method: 'post',
                        url: '/trx/checkTrxCashDroStatus',
                        headers: { trxKey: trxKeyForSale }
                    });
                    droState = statusResponse.data;
                    if (!droState || !droState.state) {
                        throw new Error('Empty CashDro status');
                    }
                    consecutivePollErrors = 0;
                } catch (pollError) {
                    consecutivePollErrors++;
                    console.error('CashDro poll error:', pollError);
                    // Losing the machine for a poll or two is normal. Losing it
                    // for ~30s means we no longer know whether cash is going in,
                    // and silently polling forever is what left a lane frozen.
                    if (consecutivePollErrors >= 15 && claimOutcome()) {
                        dispatch(notify({
                            msg: config.selfService ? SS_AR.cashDroUnreachable : 'Lost contact with CashDro — check the machine before continuing',
                            sev: 'error'
                        }));
                        // The customer may already have money in the machine, so
                        // go through the normal cancel: it tells CashDro to give
                        // the cash back and clears the operation, which is also
                        // what lets this sale be retried later.
                        handleCancelCashDro().finally(() => {
                            if (config.selfService) {
                                dispatch(abort());
                                dispatch(endPaymentMode());
                            }
                        });
                    }
                    return;
                }

                if (droState.state !== 'F') {
                    setCashDroStatus((prev) => ({
                        ...prev,
                        totalIn: droState.totalIn / 100,
                        message: `Waiting for customer... Inserted: ${(droState.totalIn / 100).toFixed(2)} ${config.systemCurrency}`
                    }));
                    return;
                }

                // Finished — from here the cash is inside the machine. A slow
                // status reply can leave two ticks in flight, and both would
                // settle this same collection; the latch keeps that to one.
                if (!claimOutcome()) {
                    return;
                }

                // Hold the screen on a non-cancellable "finalizing" state rather
                // than dropping the customer back on the cart while the payment
                // is still being recorded (and possibly retried).
                stopCashDroTimers();
                setCashDroStatus((prev) => ({ ...prev, state: 'FINALIZING', message: 'Recording payment...' }));

                const reconciliation = reconcileCashDro({
                    totalInCents: droState.totalIn,
                    totalOutCents: droState.totalOut,
                    changeNotAvailableCents: droState.changeNotAvailable,
                    expected: expectedAmount
                });
                const { received: cashReceived, dispensed: changeDispensed, changeOwed } = reconciliation;

                dispatch(notify({
                    msg: config.selfService
                        ? SS_AR.receivedChange(cashReceived.toFixed(2), changeDispensed.toFixed(2))
                        : `CashDro: Received ${cashReceived.toFixed(2)}, Change ${changeDispensed.toFixed(2)}`,
                    sev: 'info'
                }));

                if (changeOwed > 0) {
                    dispatch(notify({
                        msg: config.selfService
                            ? SS_AR.manualChangeNeeded(changeOwed.toFixed(2), config.systemCurrency)
                            : `Manual change needed: ${changeOwed.toFixed(2)} ${config.systemCurrency}`,
                        sev: 'warning'
                    }));
                }

                const settlement = await settleCollection({
                    reconciliation,
                    expectedAmount,
                    cashdroId,
                    buildPayload: (amount) => ({
                        tillKey: terminal.till ? terminal.till.key : null,
                        trxKey: trxKeyForSale,
                        paymentMethodKey: 'Cash',
                        currency: config.systemCurrency,
                        // The gross amount inserted: the server derives the
                        // customer's change from it, and CashDro's own 0.50-step
                        // rounding means the net kept can sit just under the sale
                        // total on amounts that are not a round half unit.
                        amount,
                        sourceKey: 'CASHDRO-' + cashdroId,
                        visaPayment: null
                    }),
                    // A cashier finishes the sale on the numpad OK button and may
                    // legitimately be taking only part of the balance in cash, so
                    // neither auto-closing nor the shortfall check applies to them.
                    closeSale: config.selfService
                        ? () => dispatch(closeTrxPayment({ key: trxKeyForSale })).unwrap()
                        : null,
                    requireFullSettlement: config.selfService,
                    ...cashDroSettlementDeps
                });

                cashDroBusyRef.current = false;
                setCashDroModalOpen(false);

                if (settlement.outcome === 'settled') {
                    setSelfServiceShowReceipt(true);
                    return;
                }
                if (settlement.outcome === 'recorded') {
                    return;
                }

                console.error('CashDro settlement needs attention', settlement);
                dispatch(notify({
                    msg: config.selfService
                        ? cashDroOutcomeMessage(settlement, expectedAmount)
                        : `CashDro op ${cashdroId}: ${settlement.outcome} — ${settlement.detail}.`
                            + ` Machine settled ${settlement.amount.toFixed(2)}. Do not re-run it; reconcile manually.`,
                    sev: 'error'
                }));

                // The kiosk has no staff standing at it, so anything unresolved
                // has to hold the lane. A cashier is already looking at the
                // notification above and can act on their own screen.
                if (config.selfService) {
                    setCashDroRecovery(settlement);
                }
            }, 2000);

            // Walk-away timeout. Uses a ref so it can actually see the live
            // session — the old version tested a state variable captured before
            // polling started, so it never fired and a stalled lane polled
            // forever with the modal up.
            cashDroTimeoutRef.current = setTimeout(() => {
                if (!cashDroPollRef.current) {
                    return;
                }
                dispatch(notify({ msg: config.selfService ? SS_AR.cashDroTimeout : 'CashDro timeout - payment not completed', sev: 'error' }));
                handleCancelCashDro().finally(() => {
                    if (config.selfService) {
                        dispatch(abort());
                        dispatch(endPaymentMode());
                    }
                });
            }, 5 * 60 * 1000);

        } catch (error) {
            // Failure before the machine started collecting: no cash at risk.
            stopCashDroTimers();
            cashDroBusyRef.current = false;
            setCashDroModalOpen(false);
            setCashDroStatus({ message: '', state: null, totalIn: 0, changeNotAvailable: 0 });
            dispatch(notify({
                msg: config.selfService
                    ? SS_AR.cashDroError
                    : 'CashDro error: ' + (error.response?.data || error.message),
                sev: 'error'
            }));
            if (config.selfService) {
                dispatch(abort());
                dispatch(endPaymentMode());
            }
        }
    };

    /**
     * Cancel an in-progress CashDro operation — cashier "Cancel Payment"
     * button AND the self-service Cancel flow both funnel through here.
     *
     * Money safety: if the customer already inserted part of the amount
     * (e.g. 5 of 10 due) before cancelling, CashDro must physically return
     * it — it must NOT just stop accepting more while keeping what's in the
     * machine. CashDro's own "cancel" verb IS the return instruction (see
     * /trx/cancelTrxCashDro on the backend), so hitting that endpoint is
     * both necessary and sufficient; we deliberately use the narrow
     * cancelTrxCashDro endpoint here (not /trx/abortPayment) so this can
     * never void a cashier's other, already-applied split-tender payments.
     *
     * Returns the axios promise so callers (self-service) can chain the
     * payment-mode exit only after the machine has actually been told to
     * give the cash back.
     */
    const handleCancelCashDro = () => {
        // Once the machine has committed the cash there is nothing to cancel,
        // and asking it to return money it has already banked would leave the
        // sale and the drawer disagreeing.
        if (cashDroStatus.state === 'FINALIZING') {
            return Promise.resolve();
        }
        // Claim this session's outcome before asking the machine to give the
        // cash back. clearInterval cannot stop a tick that is already awaiting
        // the machine, and such a tick arriving with "Finished" after the cash
        // has been returned would record a payment for money the customer is
        // holding in their hand.
        if (cashDroOutcomeRef.current) {
            cashDroOutcomeRef.current();
        }
        stopCashDroTimers();
        cashDroBusyRef.current = false;
        setCashDroModalOpen(false);
        setCashDroStatus({ message: '', state: null, totalIn: 0, changeNotAvailable: 0 });

        const trxKey = trxSlice.trx ? trxSlice.trx.key : null;
        if (!trxKey) {
            dispatch(notify({ msg: config.selfService ? SS_AR.cashDroCancelled : 'CashDro payment cancelled', sev: 'warning' }));
            return Promise.resolve();
        }

        return axios({
            method: 'post',
            url: '/trx/cancelTrxCashDro',
            headers: { trxKey }
        }).then((response) => {
            if (response && response.data) {
                dispatch(setTrx(response.data));
            }
            dispatch(notify({ msg: config.selfService ? SS_AR.cashDroCancelled : 'CashDro payment cancelled', sev: 'warning' }));
        }).catch((error) => {
            // The modal is already closed above so the lane isn't blocked,
            // but the cash may genuinely still be sitting in the machine —
            // this must be loud, not a quiet warning toast.
            console.error('CashDro cancel/return failed', error);
            dispatch(notify({
                msg: config.selfService
                    ? SS_AR.cashDroReturnFailed
                    : 'CashDro cancel failed — could not confirm the machine returned the inserted cash. Check the machine before the customer/cashier walks away.',
                sev: 'error'
            }));
        });
    };

    /**
     * Self-checkout card payment on the BOP reader linked to this station.
     *
     * Runs the charge first, then follows the same submit → close → receipt
     * sequence as the other self-service tenders. The customer never sees a
     * retry button on an indeterminate result: if the reader stops answering
     * mid-sale the card may already have been charged, so that case parks on a
     * "wait for staff" screen instead.
     */
    const runSelfServiceBopSale = (chargeAmount) => {
        const trxKeyForClose = trxSlice.trx.key;
        const trxId = trxSlice.trx.nanoId.replace('-', '');
        const { amt, cur, value } = toBopCharge(chargeAmount, config.systemCurrency, terminal.exchangeRates);

        setBopSale({ status: 'prompting', message: null, chargeAmount: value });

        axios({
            method: 'post',
            url: `http://127.0.0.1:${config.expressPort ? config.expressPort : '3001'}/bopVisaSale`,
            data: { trxId, amt, cur, terminal: terminal.terminal },
            // Hard ceiling above every layer below it (300s reader timeout +
            // 60s electron backstop + margin). Without one, any reply that
            // never arrives left the kiosk on the "waiting for the reader"
            // screen until someone killed the app.
            timeout: 390 * 1000
        }).then((response) => {
            const visaResponse = (response && response.data) || {};

            // Some firmware sends the code as a string; reading "0" as a
            // decline would send a customer away from a card that was charged.
            if (Number(visaResponse.resp_code) !== 0) {
                setBopSale({
                    status: 'declined',
                    message: visaResponse.error_msg || null,
                    chargeAmount: value
                });
                return null;
            }

            return dispatch(submitPayment({
                tillKey: terminal.till ? terminal.till.key : null,
                trxKey: trxKeyForClose,
                // config.visa is the same payment_method.key the cashier Visa
                // button uses, so reports and receipts resolve a real
                // description rather than a literal string.
                paymentMethodKey: config.visa,
                currency: config.systemCurrency,
                amount: value,
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
                .unwrap()
                .then((result) => {
                    const paid = result && result.trx ? (result.trx.paidamt || 0) : null;
                    const total = result && result.trx ? (result.trx.totalafterdiscount || 0) : null;
                    // closeTrx is the server's own verdict and is authoritative;
                    // the totals are a cross-check for the case where it is
                    // absent. The epsilon keeps a cent of float noise from
                    // holding up a sale that is paid in full.
                    const fullyPaid = result && (
                        result.closeTrx
                        || (result.trx && result.trx.customerchange != null && result.trx.customerchange >= 0)
                        || (paid != null && total != null && paid + 0.0001 >= total)
                    );

                    if (fullyPaid && trxKeyForClose) {
                        setBopSale(null);
                        return dispatch(closeTrxPayment({ key: trxKeyForClose }))
                            .unwrap()
                            .then(() => setSelfServiceShowReceipt(true));
                    }

                    // Everything that mattered succeeded: the card was charged
                    // and the payment is recorded against the sale. Only the
                    // balance is wrong, which is a reconciliation question for
                    // staff and NOT the indeterminate "we don't know what the
                    // reader did" case — so log the evidence loudly rather than
                    // leaving the next person to guess from a screenshot.
                    const stillDue = paid != null && total != null
                        ? Math.max(0, total - paid)
                        : null;
                    console.error('BOP sale recorded but the sale is not settled', {
                        trxId,
                        authCode: visaResponse.auth_code,
                        charged: value,
                        closeTrx: result ? result.closeTrx : null,
                        paidamt: paid,
                        totalafterdiscount: total,
                        customerchange: result && result.trx ? result.trx.customerchange : null,
                        payments: result ? result.payments : null
                    });
                    setBopSale({
                        status: 'unknown',
                        message: `auth ${visaResponse.auth_code || '-'} / ref ${trxId}`
                            + (stillDue != null ? ` — remaining ${stillDue.toFixed(2)}` : ''),
                        chargeAmount: value
                    });
                    return null;
                })
                .catch((error) => {
                    // The card WAS charged but recording it failed. Never retry
                    // from here — a staff member has to reconcile it.
                    setBopSale({
                        status: 'unknown',
                        message: `auth ${visaResponse.auth_code || '-'} / ref ${trxId} — ${error.message || error}`,
                        chargeAmount: value
                    });
                });
        }).catch((error) => {
            const data = error.response && error.response.data;
            if (data && data.outcomeUnknown) {
                // Whatever the reader did, we could not read the answer, so the
                // card may be charged. Park it for staff with everything they
                // need to find the transaction on the reader itself.
                const parts = [`ref ${data.rcpt || trxId}`];
                if (data.authCode) parts.push(`auth ${data.authCode}`);
                if (data.terminalMessage) parts.push(data.terminalMessage);
                if (data.amountMismatch) parts.push(data.error);
                setBopSale({ status: 'unknown', message: parts.join(' / '), chargeAmount: value });
                return;
            }
            // Our own deadline fired with the request already accepted by the
            // station. The card may well have been charged in the meantime, so
            // this is the unknown-outcome path too — never "safe to retry".
            // (A refused connection is different: nothing ever reached the
            // reader, and it falls through to the plain failure below.)
            if (error.code === 'ECONNABORTED') {
                console.error('BOP sale gave no answer in time', error);
                setBopSale({ status: 'unknown', message: `ref ${trxId} — no answer from the station`, chargeAmount: value });
                return;
            }
            // Nothing reached the card: a station that is not linked, a reader
            // already busy, or keys that failed their pre-flight check. Safe to
            // send the customer back to the cart.
            setBopSale({
                status: 'declined',
                message: (data && data.error) || error.message,
                chargeAmount: value
            });
        });
    };

    /**
     * Self-checkout Visa tender.
     *
     * With a BOP reader linked to this station the customer pays on the reader
     * directly (runSelfServiceBopSale). Without one there is no card-terminal
     * integration, so a supervisor/head cashier charges the card on their own
     * physical terminal — but only after scanning an authorized QR shown on the
     * self-checkout screen, exactly the same role-gated QR used for normal-POS
     * voids / price changes (see auth/validateQR on the backend). Once scanned,
     * trxSlice.checkOperationQrAuth's 'SelfServiceVisa' case submits the
     * payment and closes the sale for us.
     */
    // Always charges the entire outstanding balance: self-service is
    // single-tender, so a card sale settles the whole basket or nothing. On the
    // supervisor-QR path the amount rides along on the authQR object as
    // `chargeAmount`, since submitPayment only happens once the manager's phone
    // scan is detected (see trxSlice's checkOperationQrAuth 'SelfServiceVisa').
    const handleSelfServiceVisaPayment = () => {
        if (!trxSlice.trx) {
            dispatch(notify({ msg: SS_AR.noTrxOpen, sev: 'warning' }));
            return;
        }
        if (terminal.trxMode === 'Refund') {
            dispatch(notify({ msg: 'Visa payment does not support refunds', sev: 'warning' }));
            return;
        }

        const totalDue = trxSlice.trx.totalafterdiscount || 0;
        // [stale-paid fix] Price the charge off the sale's own paidamt, which
        // the server sends with every scan and every payment, rather than the
        // trxPaid cache that only the payment paths keep current. Getting this
        // wrong charges a real card the wrong amount, so it is worth saying
        // loudly when the two disagree.
        const totalPaid = trxSlice.trx.paidamt || 0;
        if (Math.abs(totalPaid - (trxSlice.trxPaid || 0)) > 0.0001) {
            console.warn('Paid-amount cache disagrees with the sale; charging off the sale', {
                trxKey: trxSlice.trx.key,
                trxPaidamt: totalPaid,
                cachedTrxPaid: trxSlice.trxPaid
            });
        }
        const remainingAmount = totalDue - totalPaid;
        if (remainingAmount <= 0) {
            dispatch(notify({ msg: SS_AR.noRemainingAmount, sev: 'warning' }));
            return;
        }

        const chargeAmount = remainingAmount;

        if (!terminal.paymentMode) {
            dispatch(clearNumberInput());
            dispatch(beginPayment());
            dispatch(setPaymentType({ type: 'visa', inputType: 'fixed' }));
        }

        // A linked reader charges the card here and now; everything below is
        // the supervisor-approval fallback for stations without one.
        if (terminal.terminal && terminal.terminal.bopVisaIp && terminal.terminal.bopVisaPublicRsa) {
            runSelfServiceBopSale(chargeAmount);
            return;
        }

        // [QR robustness] Reset the poll state FIRST. If a previous Visa
        // attempt's poll loop is still (or was) 'pending' when a new QR is
        // requested — e.g. cancel-and-retry — qrAuthState going 'pending' ->
        // 'pending' again is a Redux no-op, so the effect that kicks off
        // checkOperationQrAuth for the NEW qrAuthKey never fires and the
        // screen silently polls nothing (or the old, now-dead key). Forcing
        // 'idle' here guarantees the later startQrAuthCheck() is a real
        // 'idle' -> 'pending' transition once the fresh QR is set below.
        dispatch(holdQrAuthCheck());

        // Clear any stale QR (e.g. from a previous Visa attempt) so the
        // screen shows a spinner instead of a leftover/used code while the
        // new one is generated.
        setAuthQR({});

        axios({
            method: 'post',
            url: '/utilities/generateQR',
            data: {
                hardwareId: config.deviceId,
                source: 'SelfServiceVisa',
                sourceKey: trxSlice.trx.key,
                creator: terminal.loggedInUser ? terminal.loggedInUser.key : null
            }
        }).then((response) => {
            if (response && response.data) {
                setAuthQR({
                    ...response.data,
                    source: 'SelfServiceVisa',
                    chargeAmount
                });
            } else {
                dispatch(notify({ msg: SS_AR.couldNotVerify, sev: 'error' }));
                dispatch(abort());
                dispatch(endPaymentMode());
            }
        }).catch((error) => {
            dispatch(abort());
            dispatch(endPaymentMode());
            if (error.response) {
                dispatch(notify({ msg: error.response.data || SS_AR.couldNotVerify, sev: 'error' }));
            } else {
                dispatch(notify({ msg: error.message, sev: 'error' }));
            }
        });
    };

    /**
     * Self-checkout only: cancel a pending Visa QR approval and fully leave
     * payment mode (mirrors handleSelfServiceCancelPayment's CashDro path).
     */
    const handleCancelSelfServiceVisaPayment = () => {
        // An indeterminate reader result must not be dismissable by the
        // customer — that screen stays up until staff intervene.
        if (bopSale && bopSale.status === 'unknown') {
            return;
        }
        setBopSale(null);
        dispatch(holdQrAuthCheck());
        dispatch(abort());
        dispatch(endPaymentMode());
        dispatch(notify({ msg: SS_AR.visaCancelled, sev: 'warning' }));
    };

    /**
     * Self-checkout only: void a cart line with no manager QR / manager mode.
     * Backend voidLine does not enforce manager approval — that gate lives in
     * the cashier UI (handleVoidLine). Do not call this from cashier mode.
     */
    const handleSelfServiceDeleteLine = (line) => {
        if (!line || !line.key) {
            dispatch(notify({ msg: SS_AR.noItemSelected, sev: 'warning' }));
            return;
        }
        confirm(SS_AR.confirmRemoveItemTitle, line.description || '', () => {
            dispatch(selectLine(line));
            dispatch(voidLine(line.key));
        }, 'danger', {
            confirmText: SS_AR.confirm,
            cancelText: SS_AR.cancel,
            subtitle: SS_AR.confirmSubtitle,
            dir: 'rtl'
        });
    };

    /**
     * Self-checkout only: cancel the whole open transaction with no manager QR.
     */
    const handleSelfServiceCancelOrder = () => {
        if (!trxSlice.trx) {
            dispatch(notify({ msg: SS_AR.noOrderToCancel, sev: 'warning' }));
            return;
        }
        confirm(SS_AR.confirmCancelOrderTitle, SS_AR.confirmCancelOrderMsg, () => {
            dispatch(voidTrx(trxSlice.trx.key));
        }, 'danger', {
            confirmText: SS_AR.confirm,
            cancelText: SS_AR.cancel,
            subtitle: SS_AR.confirmSubtitle,
            dir: 'rtl'
        });
    };

    /**
     * Self-checkout only: back out of the CashDro screen while keeping the
     * cart. handleCancelCashDro() (above) does the actual machine
     * cancel-and-return call — this just waits for that to settle, then
     * fully exits payment mode either way (customer must be able to keep
     * scanning even if the machine call errored, though that error is
     * already surfaced loudly by handleCancelCashDro itself).
     *
     * Important: cashier `abort()` is two-step (paymentType → none, then exit
     * paymentMode). CashDro sets paymentType to 'cash', so a single abort()
     * would leave paymentMode=true and block further scanning. Always force
     * a full exit with endPaymentMode().
     *
     * Deliberately does NOT also call /trx/abortPayment: that endpoint voids
     * every payment on the trx, which is unnecessary here (self-service never
     * has a prior recorded payment to void at this point — a payment is only
     * ever written once CashDro/Visa/Employee fully succeeds) and would
     * race with handleCancelCashDro's cancelTrxCashDro call over the same
     * cashdroId.
     */
    const handleSelfServiceCancelPayment = () => {
        const exitPaymentFully = () => {
            dispatch(abort());
            dispatch(endPaymentMode());
        };
        handleCancelCashDro().finally(exitPaymentFully);
    };

    const handleVoidLine = () => {
        if (trxSlice.trx) {
            if (terminal.paymentMode) {

                if (trxSlice.selectedPayment) {
                    confirm('إلغاء الدفعة؟', trxSlice.selectedPayment.amount + ' ' + trxSlice.selectedPayment.currency,
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
                        },
                        'danger', AR_CONFIRM_OPTS()
                    )

                } else {
                    dispatch(notify({ msg: 'No payment line selected', sev: 'warning' }));
                }
            } else {
                if (trxSlice.selectedLine) {
                    confirm('حذف السطر؟', trxSlice.selectedLine.description,
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
                        },
                        'danger', AR_CONFIRM_OPTS()
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

    // Self-checkout only: the manual-Visa QR case in trxSlice.checkOperationQrAuth
    // submits the payment and closes the sale itself (no Terminal.js .then()
    // chain to hook into, unlike the CashDro flow), so watch for the sale
    // actually closing (lastTrxPayment gets populated by closeTrxPayment.fulfilled)
    // and flip on the receipt screen from here instead.
    useEffect(() => {
        if (config.selfService && trxSlice.lastTrxPayment && authQR.source === 'SelfServiceVisa') {
            setSelfServiceShowReceipt(true);
        }
    }, [trxSlice.lastTrxPayment]);


    const handleVoidTrx = () => {
        if (trxSlice.trx) {
            confirm('إلغاء الفاتورة؟', '',
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
                },
                'danger', AR_CONFIRM_OPTS()
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
            confirm('تعليق الفاتورة؟', '',
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
                },
                'warning', AR_CONFIRM_OPTS()
            )
        } else {
            dispatch(notify({
                msg: 'No valid Transaction to suspend',
                sev: 'warning'
            }))
        }
    }

    const handleSwitchToRefund = () => {
        confirm(`وضع الإرجاع؟`, '',
            () => {
                // Jordan cashiers must scan the original receipt serial before
                // refunding (audit + duplicate-refund guard). The Palestine
                // backend doesn't expose that lookup endpoint, so we skip the
                // dialog and proceed straight to QR / manager authorization.
                if (config.features.refundReference) {
                    setRefundReferenceDialogOpen(true);
                } else {
                    handleRefundReferenceValidated(null);
                }
            },
            'info', AR_CONFIRM_OPTS()
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
                confirm('إقفال الصندوق؟', 'سيتم تحديده كجاهز للإغلاق',
                    () => { dispatch(lockTill()) },
                    'warning', AR_CONFIRM_OPTS()
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
                    confirm('تطبيق الإعفاء الضريبي؟', 'لا يمكن التراجع عن هذا الإجراء',
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
                        },
                        'danger', AR_CONFIRM_OPTS()
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
            {config.features.arabVisa && (
                <>
                    {/* Arab Bank Visa terminal — Palestine-only flow.
                        `config.visaArabi` resolves to the payment_method.key
                        `VISA_AB` (defined in pos-terminal/src/config.js), and
                        `buildVisaButtonsArabi()` / `autoVisaFlowArabi()` already
                        own the per-bank UI rendered when paymentType === 'visaArabi'. */}
                    <Button key='visaArabi' disabled={terminal.trxMode === 'Refund' || !trxSlice.trx} className={classes.MainActionButton}
                        style={{ background: '#015aab', color: 'white' }}
                        onClick={() => { startPayment('visaArabi', 'numpad') }}>
                        <FontAwesomeIcon icon={faIdCard} style={{ marginRight: '5px' }} />
                        <label>Visa (Arabi)</label>
                    </Button>
                    <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
                </>
            )}
            {config.features.mobiCash && (
                <>
                    <Button key='mobicash' disabled={terminal.trxMode === 'Refund' || !trxSlice.trx} className={classes.MainActionButton}
                        onClick={() => { startPayment('mobiCash', 'numpad') }}>
                        <FontAwesomeIcon icon={faIdCard} style={{ marginRight: '5px' }} />
                        <label>MobiCash</label>
                    </Button>
                    <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
                </>
            )}
            {config.features.talabat && (
                <>
                    <Button key='talabat' disabled={terminal.trxMode === 'Refund' || !trxSlice.trx} className={classes.MainActionButton}
                        onClick={() => { startPayment('talabat', 'numpad') }}>
                        <FontAwesomeIcon icon={faMotorcycle} style={{ marginRight: '5px' }} />
                        <label>Talabat</label>
                    </Button>
                    <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
                </>
            )}
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
            {config.features.cashback && terminal.customer && terminal.store && <Button key='cashBack'
                disabled={(terminal.trxMode === 'Refund') || (terminal.store.sapCustomerCode === terminal.customer.key) || !terminal.customer.club || !trxSlice.trx}
                className={classes.MainActionButton} onClick={() => { startPayment('cashBack', 'numpad') }}>
                <FontAwesomeIcon icon={faDollarSign} style={{ marginRight: '5px' }} />
                <label>Cash Back</label>
            </Button>}
            <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
            {config.features.employeeExtra && terminal.customer && terminal.customer.employee && terminal.store && <Button key='employeeExtra'
                disabled={(terminal.trxMode === 'Refund') || (terminal.store.sapCustomerCode === terminal.customer.key) || !terminal.customer.club || !trxSlice.trx}
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
                        <span style={{ fontFamily: '"DSDIGI", monospace' }}>{trxSlice.trx.totalafterdiscount}</span> {config.currencySymbol}
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
            {config.features.customCustomerName && (
                <>
                    <Button key='customerName' className={classes.MainActionButton}
                        disabled={!trxSlice.trx}
                        onClick={() => setCustomCustomerNameDialogOpen(true)}>
                        <div style={{ fontSize: '12px', }}>
                            <FontAwesomeIcon icon={faUser} style={{ marginRight: '5px' }} />
                            <label>Customer Name</label>
                        </div>
                    </Button>
                    <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
                </>
            )}
            {config.features.customCustomerMobile && (
                <>
                    <Button key='customerMobile' className={classes.MainActionButton}
                        disabled={!trxSlice.trx || (terminal.customer && terminal.customer.club)}
                        onClick={() => setCustomCustomerMobileDialogOpen(true)}
                        title={(terminal.customer && terminal.customer.club) ? 'Club customer scanned — mobile is locked' : undefined}>
                        <div style={{ fontSize: '12px', }}>
                            <FontAwesomeIcon icon={faMobileScreenButton} style={{ marginRight: '5px' }} />
                            <label>Customer Mobile</label>
                        </div>
                    </Button>
                    <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
                </>
            )}
            {config.features.referenceNumber && (
                <>
                    <Button key='referenceNumber' className={classes.MainActionButton}
                        disabled={!trxSlice.trx}
                        onClick={() => setReferenceNumberDialogOpen(true)}>
                        <div style={{ fontSize: '12px', }}>
                            <FontAwesomeIcon icon={faHashtag} style={{ marginRight: '5px' }} />
                            <label>Reference Number</label>
                        </div>
                    </Button>
                    <div style={{ lineHeight: '0.6705', color: 'transparent' }} > .</div>
                </>
            )}
            {config.features.printLastTrx && (
                <Button key='lastTrxList' className={classes.MainActionButton}
                    onClick={handleLastTrxList}>
                    <div style={{ fontSize: '12px', }}>
                        <FontAwesomeIcon icon={faList} style={{ marginRight: '5px' }} />
                        <label>Print Last TRX</label>
                    </div>
                </Button>
            )}
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
                        ( {config.currencySymbol} {obj.totalafterdiscount} ) <small>Restore <FontAwesomeIcon icon={faPlay} /></small>
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
                    Balance: {config.currencySymbol} {terminal.customer.employeeBalance}
                    <hr style={{ padding: '2px', margin: '2px' }} />
                    <small>
                        (Limit: {config.currencySymbol} {terminal.customer.employeeBalanceLimit})
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
        const currency = config.currencySymbol;

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

    // The stored value is the transport target: an IP for a networked reader,
    // or a COM port name for one on a serial cable.
    const initTerminalWithBopVisa = () => {
        if (!bopVisaIp) {
            dispatch(notify({ msg: 'Enter the BOP Visa IP address or COM port first', sev: 'error' }));
            return;
        }

        dispatch(showLoading('Pairing with the card reader — follow the prompts on the device...'));
        axios({
            method: 'post',
            url: `http://127.0.0.1:${config.expressPort ? config.expressPort : '3001'}/linkTerminalWithBopVisa`,
            data: {
                terminalKey: terminal.terminal.key,
                bopVisaIp: bopVisaIp.trim()
            }
        }).then((response) => {
            if (response && response.data && response.data.key) {
                dispatch(setTerminal(response.data));
                dispatch(notify({ msg: 'BOP Visa linked @ ' + bopVisaIp.trim() }));
                setBopVisaIp('');
            }
            dispatch(hideLoading());
        }).catch((error) => {
            const data = error.response && error.response.data;
            dispatch(notify({ msg: 'Could not link: ' + ((data && data.error) || error.message), sev: 'error' }));
            dispatch(hideLoading());
        })
    }

    const unlinkTerminalFromBopVisa = () => {
        dispatch(showLoading());
        axios({
            method: 'post',
            url: `http://127.0.0.1:${config.expressPort ? config.expressPort : '3001'}/unlinkTerminalFromBopVisa`,
            data: { terminalKey: terminal.terminal.key }
        }).then((response) => {
            if (response && response.data && response.data.key) {
                dispatch(setTerminal(response.data));
                dispatch(notify({ msg: 'BOP Visa unlinked' }));
            }
            dispatch(hideLoading());
        }).catch((error) => {
            const data = error.response && error.response.data;
            dispatch(notify({ msg: 'Could not unlink: ' + ((data && data.error) || error.message), sev: 'error' }));
            dispatch(hideLoading());
        })
    }


    // -----------------------------------------------------------------------
    // Self-checkout kiosk mode. All handlers / effects above still run
    // (till init, produce fetch, CashDro, etc.). Only the cashier JSX is
    // swapped for the customer-facing SelfServiceView — normal POS is
    // completely untouched when config.selfService is false.
    // -----------------------------------------------------------------------
    if (config.selfService) {
        return (
            <SelfServiceView
                produceItems={produceItems}
                otherScaleItems={otherScaleItems}
                topScaleBarcodes={topScaleBarcodes}
                images={images}
                scaleConnected={scaleConnected}
                cashDroModalOpen={cashDroModalOpen}
                cashDroStatus={cashDroStatus}
                showReceipt={selfServiceShowReceipt}
                onDeleteLine={handleSelfServiceDeleteLine}
                onCancelOrder={handleSelfServiceCancelOrder}
                onPayCash={handleCashDroPayment}
                onCancelPayment={handleSelfServiceCancelPayment}
                onPayVisa={handleSelfServiceVisaPayment}
                onCancelVisaPayment={handleCancelSelfServiceVisaPayment}
                authQR={authQR}
                cashHeld={cashDroRecovery}
                onClearCashHeld={() => {
                    // Staff have looked at the machine and the sale. Release the
                    // lane, but leave the sale OPEN so they can settle it from a
                    // cashier terminal — silently voiding a basket the store has
                    // already taken cash for is the worse failure.
                    setCashDroRecovery(null);
                    dispatch(abort());
                    dispatch(endPaymentMode());
                }}
                cardTerminal={bopSale}
                onClearCardTerminalSale={() => {
                    // Staff-verified escape from an indeterminate card sale.
                    // The sale itself is left open on purpose so whatever they
                    // found on the reader can still be settled properly.
                    setBopSale(null);
                    dispatch(abort());
                    dispatch(endPaymentMode());
                }}
                onScanWeightable={scanWeightableItem}
                onReceiptDone={() => {
                    setSelfServiceShowReceipt(false);
                    dispatch(clearLastPaymentHistory());
                }}
                onLockTill={handleLockTill}
                onLogout={handleLogout}
            />
        );
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
                                {config.features.cashback && terminal.customer.cashbackBalance && (
                                    <b style={{ marginLeft: 4, color: '#111827' }}>
                                        <span style={{ fontFamily: '"DSDIGI", monospace' }}>{Math.round(Number(terminal.customer.cashbackBalance) * 10000) / 10000}</span>
                                        <small style={{ color: '#6B7280', fontFamily: '"Inter", "Segoe UI", sans-serif', marginLeft: 3 }}>
                                            {config.currencySymbol}
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
                            * Required Plus Tax = {config.currencySymbol} <span style={{ fontFamily: '"DSDIGI", monospace' }}>{trxSlice.trx.totalPlusTaxAmt}</span>
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
                                    {(Math.round(trxSlice.lastTrxPayment.paid * 100) / 100).toFixed(config.decimals)}
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
                                    {(Math.round(trxSlice.lastTrxPayment.change * 100) / 100).toFixed(config.decimals)}
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
                            disabled={terminal.paymentMode || !config.scale}
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
                                // [stuck-mode fix] Only require a selected line to ENTER
                                // price-change mode. Once priceChangeMode is already ON,
                                // this button always reads "Cancel" and must stay
                                // clickable no matter what — voiding/suspending the trx
                                // (or otherwise losing the selected line) used to disable
                                // this button forever with priceChangeMode stuck true and
                                // no other way to turn it off short of an app restart.
                                disabled={!trxSlice.priceChangeMode && (!trxSlice.selectedLine || !trxSlice.selectedLine.key)}
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
                                    {config.currencySymbol}
                                </small>
                                <label id='Total' className={`${classes.FooterAmount} ${classes.FooterAmountGrand} ${terminal.trxMode === 'Refund' ? classes.FooterAmountRed : ''}`}>
                                    {trxSlice.trx ? ((trxSlice.trx.totalafterdiscount * 100) / 100).toFixed(config.decimals) : '0.00'}
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
                                            {config.currencySymbol}
                                        </small>
                                        <label id='PaidAmt' className={classes.FooterAmount}>
                                            {(Math.round(trxSlice.trxPaid * 100) / 100).toFixed(config.decimals)}
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
                                            {config.currencySymbol}
                                        </small>
                                        <label className={`${classes.FooterAmount} ${trxSlice.trxChange < 0 ? classes.FooterAmountRed : classes.FooterAmountGreen}`}>
                                            {(Math.round(trxSlice.trxChange * 100) / 100).toFixed(config.decimals)}
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
                                {config.features.cashback && trxSlice.trx && trxSlice.trx.totalcashbackamt > 0 && (
                                    <span className={`${classes.FooterPill} ${classes.FooterPillCashback}`}>
                                        <FontAwesomeIcon icon={faStar} style={{ fontSize: 10 }} />
                                        Cashback
                                        <b>{((trxSlice.trx.totalcashbackamt * 100) / 100).toFixed(config.decimals)}</b>
                                    </span>
                                )}
                                <span className={`${classes.FooterPill} ${trxSlice.trx && trxSlice.trx.isTaxExempt ? classes.FooterPillTaxExempt : classes.FooterPillTax}`}>
                                    <FontAwesomeIcon icon={faTag} style={{ fontSize: 10 }} />
                                    Tax
                                    <b>{trxSlice.trx ? (((trxSlice.trx.totalTaxAmt) * 100) / 100).toFixed(config.decimals) : (0).toFixed(config.decimals)}</b>
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

                            {
                                actionsMode === 'payment' && terminal.trxMode !== 'Refund' && terminal.paymentType === 'cashBack' &&
                                buildCashBackButtons()
                            }

                            {
                                config.features.employeeExtra && actionsMode === 'payment' && terminal.trxMode !== 'Refund' && terminal.paymentType === 'employeeExtra' &&
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

            <Drawer className={classes.ScaleDrawer} position='right' open={scaleItemsOpen} onClose={() => setScaleItemsOpen(false)}>
                <div className={classes.ScaleShell}>
                    {/* Header: title + category pills + status chip */}
                    <div className={classes.ScaleHeader}>
                        <div className={classes.ScaleHeaderTitleWrap}>
                            <div className={classes.ScaleHeaderIcon}>
                                <FontAwesomeIcon icon={faWeightScale} />
                            </div>
                            <div className={classes.ScaleHeaderTitle}>
                                <h3>Scale Items</h3>
                                <span>{drawerItems.length} {drawerItems.length === 1 ? 'item' : 'items'} shown</span>
                            </div>
                        </div>

                        <div className={classes.ScaleCategoryPills}>
                            <button
                                className={`${classes.ScaleCategoryPill} ${selectedScaleCategory === 'all' ? classes.ScaleCategoryPillActive : ''}`}
                                onClick={() => { setSelectedScaleCategory('all'); setSelectedOtherSubSegment(null); }}
                            >
                                <FontAwesomeIcon icon={faList} />
                                <span>All Items</span>
                            </button>
                            <button
                                className={`${classes.ScaleCategoryPill} ${selectedScaleCategory === 'fruit' ? classes.ScaleCategoryPillActive : ''}`}
                                onClick={() => { setSelectedScaleCategory('fruit'); setSelectedOtherSubSegment(null); }}
                            >
                                <FontAwesomeIcon icon={faAppleWhole} />
                                <span>Fruits</span>
                            </button>
                            <button
                                className={`${classes.ScaleCategoryPill} ${selectedScaleCategory === 'vegetable' ? classes.ScaleCategoryPillActive : ''}`}
                                onClick={() => { setSelectedScaleCategory('vegetable'); setSelectedOtherSubSegment(null); }}
                            >
                                <FontAwesomeIcon icon={faLeaf} />
                                <span>Vegetables</span>
                            </button>
                            {/* Tenant-gated. Only Jordan today; PS pos-backend
                                doesn't expose /barcode/otherScaleItems. */}
                            {config.features.otherScaleItems && (
                                <button
                                    className={`${classes.ScaleCategoryPill} ${selectedScaleCategory === 'others' ? classes.ScaleCategoryPillActive : ''}`}
                                    onClick={() => { setSelectedScaleCategory('others'); setSelectedOtherSubSegment(null); }}
                                >
                                    <FontAwesomeIcon icon={faBoxOpen} />
                                    <span>Others</span>
                                </button>
                            )}
                        </div>

                        <div className={classes.ScaleStatusChip}>
                            <span className={`${classes.ScaleStatusDot} ${!scaleConnected ? classes.ScaleStatusDotOffline : ''}`} />
                            <FontAwesomeIcon icon={faPlug} style={{ fontSize: 12 }} />
                            <span>{scaleConnected ? 'Scale Connected' : 'Preview Mode'}</span>
                        </div>
                    </div>

                    {/* Preview banner — shown whenever the drawer is opened
                        without a connected scale. Weighing is blocked
                        internally by `scanWeightableItem`. */}
                    {!scaleConnected && (
                        <div className={classes.ScalePreviewBanner}>
                            <div className={classes.ScalePreviewBannerIcon}>
                                <FontAwesomeIcon icon={faTriangleExclamation} />
                            </div>
                            <div>
                                <strong>Scale not connected.</strong>&nbsp;
                                You can browse items, but weighing is disabled until the scale is reconnected.
                            </div>
                        </div>
                    )}

                    {/* Filter strip: History pill first (most-scanned items from
                        the past week, pre-fetched on till init), followed by
                        Arabic alphabet buttons for "starts-with" filtering. */}
                    <div className={classes.ScaleAlphabetStrip}>
                        <button
                            className={`${classes.ScaleAlphaBtn} ${classes.ScaleAlphaBtnHistory} ${scaleFilterMode === 'history' ? classes.ScaleAlphaBtnActive : ''}`}
                            onClick={() => setScaleFilterMode('history')}
                            title="Most scanned in the past 7 days"
                        >
                            <FontAwesomeIcon icon={faHistory} />
                        </button>
                        {/* "All" — show the full catalog for the current
                            category (and sub-segment, when Others is
                            active) without any history or alphabet
                            narrowing. Sits right after History so the
                            cashier can fall back to "show me everything"
                            in one tap. */}
                        <button
                            className={`${classes.ScaleAlphaBtn} ${classes.ScaleSubSegmentBtn} ${scaleFilterMode === 'all' ? classes.ScaleAlphaBtnActive : ''}`}
                            onClick={() => setScaleFilterMode('all')}
                            title="Show every item in the current category"
                        >
                            All
                        </button>
                        {['ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ر', 'ذ', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي'].map((c) => (
                            <button
                                key={c}
                                className={`${classes.ScaleAlphaBtn} ${(scaleFilterMode === 'alpha' && c === alphabtet) ? classes.ScaleAlphaBtnActive : ''}`}
                                onClick={() => { setScaleFilterMode('alpha'); setAlphabet(c); }}
                            >
                                {c}
                            </button>
                        ))}
                    </div>

                    {/* Dynamic sub-segment chips — only when Others is the
                        active category. The list is derived from the
                        distinct sub_segments returned by the backend, so
                        new sub-segments added at HO appear automatically. */}
                    {selectedScaleCategory === 'others' && otherSubSegments.length > 0 && (
                        <div className={classes.ScaleAlphabetStrip} style={{ paddingTop: 4 }}>
                            <button
                                className={`${classes.ScaleAlphaBtn} ${classes.ScaleSubSegmentBtn} ${!selectedOtherSubSegment ? classes.ScaleAlphaBtnActive : ''}`}
                                onClick={() => setSelectedOtherSubSegment(null)}
                                title="Show every Others sub-segment"
                            >
                                All
                            </button>
                            {otherSubSegments.map((s) => (
                                <button
                                    key={s}
                                    className={`${classes.ScaleAlphaBtn} ${classes.ScaleSubSegmentBtn} ${selectedOtherSubSegment === s ? classes.ScaleAlphaBtnActive : ''}`}
                                    onClick={() => setSelectedOtherSubSegment(s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Item grid */}
                    <div className={classes.ScaleGridWrap}>
                        <div className={classes.ScaleGrid}>
                            {drawerItems.length === 0 ? (
                                <div className={classes.ScaleEmptyState}>
                                    <div className={classes.ScaleEmptyIcon}>
                                        <FontAwesomeIcon icon={scaleFilterMode === 'history' ? faHistory : faBoxOpen} />
                                    </div>
                                    <p className={classes.ScaleEmptyTitle}>
                                        {scaleFilterMode === 'history'
                                            ? 'No recent scale sales yet'
                                            : scaleFilterMode === 'all'
                                                ? 'No items in this category'
                                                : 'No items match the current filter'}
                                    </p>
                                    <p className={classes.ScaleEmptySub}>
                                        {scaleFilterMode === 'history'
                                            ? 'Once items are weighed, the 16 most-scanned will appear here.'
                                            : scaleFilterMode === 'all'
                                                ? 'Try a different category or sub-segment.'
                                                : 'Try a different letter or switch the category.'}
                                    </p>
                                </div>
                            ) : drawerItems.map((item) => {
                                const imgSrc = images[`${item.barcode}.png`] || images[`PLU_${item.barcode}.jpg`] || images['nophoto.jpg'];
                                const isPiece = Boolean(item.isScalePiece);
                                return (
                                    <div
                                        key={item.barcode}
                                        className={`${classes.ScaleItemCard} ${!scaleConnected ? classes.ScaleItemCardDisabled : ''}`}
                                        onClick={() => { scanWeightableItem(item); }}
                                        title={!scaleConnected ? 'Scale not connected — weighing disabled' : ''}
                                    >
                                        {!scaleConnected && (
                                            <div className={classes.ScaleItemLock}>
                                                <FontAwesomeIcon icon={faLock} />
                                            </div>
                                        )}
                                        <div className={classes.ScaleItemImgFrame}>
                                            <img
                                                src={imgSrc}
                                                onError={(e) => { e.target.src = images['nophoto.jpg']; }}
                                                alt={item.descriptionAr}
                                            />
                                        </div>
                                        <div className={classes.ScaleItemName}>{item.descriptionAr}</div>
                                        <span className={`${classes.ScaleItemBadge} ${isPiece ? classes.ScaleItemBadgePiece : classes.ScaleItemBadgeWeight}`}>
                                            <FontAwesomeIcon icon={isPiece ? faTag : faWeightScale} />
                                            {isPiece ? 'Piece' : 'Weight'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className={classes.ScaleFooter}>
                        <div className={classes.ScaleFooterLeft}>
                            <div className={classes.ScaleFooterCount}>
                                <b>{drawerItems.length}</b>
                                {drawerItems.length === 1 ? 'item' : 'items'}
                                {scaleFilterMode === 'history' ? (
                                    <>&nbsp;&middot;&nbsp;<b style={{ color: '#111827' }}>most scanned this week</b></>
                                ) : scaleFilterMode === 'all' ? (
                                    <>&nbsp;&middot;&nbsp;<b style={{ color: '#111827' }}>all items</b></>
                                ) : alphabtet ? (
                                    <>&nbsp;&middot;&nbsp;starting with <b style={{ color: '#111827' }}>{alphabtet}</b></>
                                ) : null}
                                {selectedScaleCategory === 'others' && selectedOtherSubSegment ? (
                                    <>&nbsp;&middot;&nbsp;<b style={{ color: '#111827' }}>{selectedOtherSubSegment}</b></>
                                ) : null}
                            </div>
                        </div>
                        <button className={classes.ScaleBackBtn} onClick={() => setScaleItemsOpen(false)}>
                            <FontAwesomeIcon icon={faArrowRightFromBracket} style={{ transform: 'rotate(180deg)' }} />
                            Go Back
                        </button>
                    </div>
                </div>
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
                    {!terminal.terminal.bopVisaIp && <Input key='bopvisasetupIp' placeholder='IP or COM port'
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
                        <div>
                            <FontAwesomeIcon icon={faCheck} /> Already Linked @ {terminal.terminal.bopVisaIp}
                        </div>
                        <Button key='bopvisaunlink' appearance='ghost' color='red'
                            style={{ marginTop: 8 }}
                            onClick={unlinkTerminalFromBopVisa} >
                            Unlink
                        </Button>
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

            {config.features.refundReference && (
                <RefundReferenceDialog
                    open={refundReferenceDialogOpen}
                    onClose={handleRefundReferenceDialogClose}
                    onValidated={handleRefundReferenceValidated}
                />
            )}

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