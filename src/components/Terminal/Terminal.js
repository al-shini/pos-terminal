import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux'
import axios from '../../axios';
import { Button, Input, FlexboxGrid, Panel, Divider, Whisper, Popover } from 'rsuite';
import classes from './Terminal.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSackDollar, faBroom, faMoneyBillTransfer,
    faAddressCard, faCarrot, faToolbox, faShieldHalved, faMoneyBill, faIdCard, faTimes, faBullhorn, faEraser, faBan
} from '@fortawesome/free-solid-svg-icons'
import Numpad from './Numpad';
import Invoice from './Invoice';
import Payments from './Payments';
import BalanceSetup from './BalanceSetup';
import {
    beginPayment, uploadCurrencies, abort,logout,
    uploadCashButtons, setPaymentType, uploadForeignButtons, uploadPaymentMethods, uploadFastItems
} from '../../store/terminalSlice';
import { selectCurrency, voidPayment, submitPayment, clearNumberInput, voidLine, scanBarcode, setTrx } from '../../store/trxSlice';
import { notify, hideLoading } from '../../store/uiSlice';
import FlexboxGridItem from 'rsuite/esm/FlexboxGrid/FlexboxGridItem';
import Alert from "@mui/material/Alert";
import confirm from '../UI/ConfirmDlg';

const Terminal = (props) => {
    const terminal = useSelector((state) => state.terminal);
    const trxSlice = useSelector((state) => state.trx);
    const uiSlice = useSelector((state) => state.ui);

    const [actionsMode, setActionsMode] = useState('payment');

    const dispatch = useDispatch();

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
                    dispatch(hideLoading());
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
                    dispatch(hideLoading());
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
                    dispatch(hideLoading());
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
                    dispatch(hideLoading());
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
                    dispatch(hideLoading());
                    dispatch(notify({ msg: error.response.data, sev: 'error' }));
                }
            } else {
                dispatch(notify({ msg: error.message, sev: 'error' }));
            }

        });
    }, [])


    const startPayment = (type, inputType) => {
        dispatch(clearNumberInput());
        dispatch(beginPayment());
        dispatch(setPaymentType({
            type,
            inputType
        }));
    }

    const handleVoidLine = () => {
        if (trxSlice.trx) {
            if (terminal.paymentMode) {
                if (trxSlice.selectedPayment) {
                    confirm('Void Payment?', '', () => {
                        dispatch(voidPayment({
                            trxKey: trxSlice.trx.key,
                            lineKey: trxSlice.selectedPayment.key
                        }))
                    })

                } else {
                    dispatch(notify({ msg: 'No payment line selected', sev: 'warning' }));
                }
            } else {
                if (trxSlice.selectedLine) {
                    dispatch(voidLine({
                        trxKey: trxSlice.trx.key,
                        lineKey: trxSlice.selectedLine.key
                    }));
                } else {
                    dispatch(notify({ msg: 'No transaction line selected', sev: 'warning' }));
                }
            }
        } else {
            dispatch(notify({ msg: 'No open transactions', sev: 'warning' }));
        }
    }

    const handleAbort = () => {
        if (terminal.paymentMode && actionsMode === 'payment' && terminal.paymentType === 'none') {
            axios({
                method: 'get',
                url: '/trx/abortPayment',
                params: {
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
                        dispatch(hideLoading());
                        dispatch(notify({ msg: error.response.data, sev: 'error' }));
                    }
                } else {
                    dispatch(notify({ msg: error.message, sev: 'error' }));
                }

            });
        } else if (terminal.paymentMode && actionsMode === 'payment' && terminal.paymentType !== 'none') {

        }

        if(!terminal.paymentMode){
            dispatch(logout());
        }else{
            dispatch(abort());
        }

    }

    const buildPaymentTypesButtons = () => {
        return <React.Fragment>
            <Button className={classes.MainActionButton} onClick={() => { startPayment('cash', 'fixed') }}>
                <FontAwesomeIcon icon={faMoneyBill} style={{ marginRight: '5px' }} />
                <label>Cash</label>
            </Button>
            <br />
            <Button className={classes.MainActionButton} onClick={() => { startPayment('foreign', 'fixed') }}>
                <FontAwesomeIcon icon={faMoneyBillTransfer} style={{ marginRight: '5px' }} />
                <label>Currency</label>
            </Button>
            <br />
            <Button className={classes.MainActionButton} onClick={() => { startPayment('visa', 'numpad') }}>
                <FontAwesomeIcon icon={faIdCard} style={{ marginRight: '5px' }} />
                <label>Visa</label>
            </Button>
        </React.Fragment>;
    }

    const buildCashButtons = () => {
        let tmp = [];

        terminal.cashButtons.map((obj, i) => {
            tmp.push(
                <Button key={i} onClick={() => {
                    dispatch(submitPayment({
                        tillKey: terminal.till ? terminal.till.key : null,
                        trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                        paymentMethodKey: obj.paymentMethodKey,
                        currency: obj.currency,
                        amount: obj.amount
                    }))
                }} style={{ background: `url(${obj.image}) rgb(247 247 250)`, backgroundRepeat: 'no-repeat', backgroundPosition: 'center', color: 'transparent' }}
                    className={classes.ActionButton} >
                    .
                </Button>
            )
            tmp.push(<div style={{ lineHeight: '0.6705', color: 'transparent' }} key={i + 'space'} > .</div>);
        });

        tmp.push(<div style={{ lineHeight: '0.6705', color: 'transparent' }}> .</div>);

        return tmp;
    }

    const buildForeignButtons = () => {
        let tmp = [];

        terminal.foreignButtons.map((obj) => {
            tmp.push(
                <Button key={obj.uuid} onClick={() => {
                    dispatch(submitPayment({
                        tillKey: terminal.till ? terminal.till.key : null,
                        trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                        paymentMethodKey: obj.paymentMethodKey,
                        currency: obj.currency,
                        amount: obj.amount
                    }))
                }}
                    style={{ background: `url(${obj.image}) rgb(247 247 250)`, backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}
                    className={classes.ActionButton} >
                    <span style={{ color: 'transparent' }}> .</span>
                </Button>
            )
            tmp.push(<div style={{ lineHeight: '0.6705', color: 'transparent' }} key={obj.uuid + 'space'} > .</div>);
        });

        tmp.push(<div style={{ lineHeight: '0.6705', color: 'transparent' }}> .</div>);

        return tmp;
    }

    const buildVisaButtons = () => {
        let tmp = [];

        terminal.currencies.map((obj) => {
            tmp.push(
                <Button key={obj.key} className={classes.ActionButton}  >
                    <div style={{ textAlign: 'center' }}>
                        {obj.key}
                    </div>
                </Button>
            )
            tmp.push(<div style={{ lineHeight: '0.6705', color: 'transparent' }} key={obj.key + 'space'} > .</div>);
        });

        tmp.push(<div style={{ lineHeight: '0.6705', color: 'transparent' }}> .</div>);

        return tmp;
    }

    const buildFastItemButtons = () => {
        let tmp = [];

        terminal.fastItems.map((obj) => {
            tmp.push(
                <Button key={obj.key} className={classes.ActionButton}
                    onClick={() => {
                        dispatch(scanBarcode({
                            barcode: obj.barcode,
                            trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                            tillKey: terminal.till ? terminal.till.key : null,
                            multiplier: 1
                        }))
                    }} >
                    <div style={{ textAlign: 'center', fontSize: '14px', }}>
                        {obj.itemName}
                    </div>
                </Button>
            )
            tmp.push(<div style={{ lineHeight: '0.6705', color: 'transparent' }} key={obj.key + 'space'} > .</div>);
        });

        tmp.push(<div style={{ lineHeight: '0.6705', color: 'transparent' }}> .</div>);

        return tmp;
    }


    return (
        <FlexboxGrid >
            <FlexboxGrid.Item colspan={11} style={{ background: 'white', position: 'relative', left: '6px', width: '48.83333333%' }}  >
                {terminal.display === 'ready' && <Invoice />}
                {terminal.display === 'balance-setup' && <BalanceSetup />}
                {terminal.display === 'payment' && <Payments />}
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={1} style={{ width: '1.166667%' }}>
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={9} style={{ position: 'relative', left: '6px', height: '87.5vh' }}>
                <div style={{ background: '#303030', color: 'white', height: '5vh', position: 'relative', width: '120%', right: '12px' }}>
                    <h6 style={{ lineHeight: '5vh', textAlign: 'center' }}>
                        <FontAwesomeIcon icon={faAddressCard} style={{ marginRight: '7px' }} />
                        Cash Customer / Shini Bet
                    </h6>
                </div>

                <div style={{ background: 'white', padding: '10px', position: 'absolute', top: '5vh', width: '96.5%', height: '33vh' }}>
                    <div style={{ padding: '4px' }}>
                        <Alert severity={uiSlice.toastType} sx={{ width: '100%' }}>
                            {uiSlice.toastMsg}
                        </Alert>
                    </div>
                    <Divider style={{ margin: '7px' }} />
                    {
                        terminal.paymentMode &&
                        <FlexboxGrid>
                            <FlexboxGrid.Item colspan={24} >
                                <div style={{ border: '1px solid #e1e1e1', padding: '6px', minWidth: '60%', margin: 'auto' }}>
                                    <small style={{ fontSize: '25px', marginRight: '5px' }}>
                                        Paid =
                                    </small>
                                    <b>
                                        <label id='Total' style={{ fontSize: '30px' }}>
                                            {(Math.round(trxSlice.trxPaid * 100) / 100).toFixed(2)}
                                        </label>
                                    </b>
                                </div>
                            </FlexboxGrid.Item>
                            <FlexboxGrid.Item colspan={24}>
                                <br />
                            </FlexboxGrid.Item>
                            <FlexboxGrid.Item colspan={24}>
                                <div style={{ border: '1px solid #e1e1e1', padding: '6px', minwidth: '60%', margin: 'auto' }}>
                                    <small style={{ fontSize: '25px', marginRight: '5px' }}>
                                        Change =
                                    </small>
                                    <b> <label id='Total' style={{ fontSize: '30px', color: trxSlice.trxChange < 0 ? 'red' : 'green' }} >
                                        {(Math.round(trxSlice.trxChange * 100) / 100).toFixed(2)}
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
                    <FlexboxGrid justify='space-between'>

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
                                actionsMode === 'fastItems' &&
                                buildFastItemButtons()
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
                        <Button color={'orange'} appearance="primary" className={classes.POSButton} >
                            <FontAwesomeIcon icon={faShieldHalved} style={{ marginRight: '5px' }} />
                            <label>Manager</label>
                        </Button>
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={3}>
                        <Button className={classes.POSButton}
                            appearance={actionsMode === 'payment' ? 'primary' : 'default'}
                            color='green'
                            onClick={() => setActionsMode('payment')} >
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
                            onClick={handleVoidLine}
                            appearance='primary' color='blue'>
                            <FontAwesomeIcon icon={faEraser} style={{ marginRight: '5px' }} />
                            <label>Void Line</label>
                        </Button>
                    </FlexboxGrid.Item>
                    <FlexboxGrid.Item colspan={3}>
                        <Button className={classes.POSButton}
                            appearance='primary' color='blue'>
                            <FontAwesomeIcon icon={faToolbox} style={{ marginRight: '5px' }} />
                            <label>Void TRX</label>
                        </Button>
                    </FlexboxGrid.Item>
                    <FlexboxGrid.Item colspan={3}>
                        <Button className={classes.POSButton}
                            appearance='primary' color='blue'
                            disabled >
                            <FontAwesomeIcon icon={faBan} style={{ marginRight: '5px' }} />
                            <label>Empty</label>
                        </Button>
                    </FlexboxGrid.Item>
                    <FlexboxGrid.Item colspan={3}>
                        <Button className={classes.POSButton}
                            // disabled={terminal.display === 'ready'}
                            onClick={handleAbort}
                            appearance='primary' color='red'>
                            <FontAwesomeIcon icon={faTimes} style={{ marginRight: '5px' }} />
                            <label>
                                {(terminal.paymentMode && actionsMode === 'payment' && terminal.paymentType === 'none') ? 'Abort' : ''}
                                {(terminal.paymentMode && actionsMode === 'payment' && terminal.paymentType !== 'none') ? 'Back' : ''}
                                {!terminal.paymentMode ? 'Shutdown' : ''}
                            </label>
                        </Button>
                    </FlexboxGrid.Item>


                </FlexboxGrid>
            </FlexboxGridItem>
        </FlexboxGrid >
    );
}

export default Terminal;