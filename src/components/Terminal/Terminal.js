import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux'
import axios from '../../axios';
import { Button, Input, FlexboxGrid, Panel, Divider, Whisper, Popover } from 'rsuite';
import classes from './Terminal.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSackDollar, faBroom,
    faAddressCard, faCarrot, faToolbox, faShieldHalved, faMoneyBill, faIdCard, faTimes, faHandHoldingDollar, faHashtag
} from '@fortawesome/free-solid-svg-icons'
import Numpad from './Numpad';
import Invoice from './Invoice';
import BalanceSetup from './BalanceSetup';
import {
    beginPayment, finishPayment, uploadCurrencies, uploadExchangeRates,
    uploadPaymentMethods, endPaymentMode
} from '../../store/terminalSlice';
import { selectCurrency, selectPaymentMethod, handleNumberInputChange, clearNumberInput } from '../../store/trxSlice';
import { notify, hideLoading } from '../../store/uiSlice';

const Terminal = (props) => {
    const triggerRef = React.useRef();
    const open = () => triggerRef.current.open();
    const close = () => triggerRef.current.close();

    const terminal = useSelector((state) => state.terminal);
    const trxSlice = useSelector((state) => state.trx);

    const [actionsMode, setActionsMode] = useState('payment');

    const dispatch = useDispatch();

    useEffect(() => {

        axios({
            method: 'get',
            url: '/payment-method/list',
            params: {
                showDeleted: 0
            }
        }).then((response) => {
            if (response && response.data) {
                dispatch(uploadPaymentMethods(response.data));
            } else {
                dispatch(notify({ msg: 'Incorrect /payment-method/list response', sev: 'error' }))
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
            url: '/exchange-rate/listOfDay',
            params: {
                tillKey: terminal.till ? terminal.till.key : ''
            }
        }).then((response) => {
            if (response && response.data) {
                let exchangeRates = {};
                response.data.map((obj) => {
                    exchangeRates[obj.currencyKey] = obj.rate
                })
                dispatch(uploadExchangeRates(exchangeRates));
            } else {
                dispatch(notify({ msg: 'Incorrect /exchange-rate/list response', sev: 'error' }))
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

    useEffect(() => {
        close();
    }, [trxSlice.selectedCurrency]);

    const handleBeginPayment = (pMethod) => {
        dispatch(clearNumberInput());
        dispatch(beginPayment());
        dispatch(selectPaymentMethod(pMethod));
    }


    const buildPaymentMethodButtons = (mode) => {
        let tmp = [];
        terminal.paymentMethods.map((obj) => {
            tmp.push(
                <Button key={obj.key} appearance={trxSlice.selectedPaymentMethod.key === obj.key ? 'primary' : 'default'} className={classes.ActionButton} onClick={(e) => handleBeginPayment(obj)} >
                    <FontAwesomeIcon icon={faMoneyBill} style={{ marginRight: '5px' }} />
                    <label>{obj.description}</label>
                </Button>)
            tmp.push(<br key={obj.key + 'br'} />);
        });

        tmp.push(
            <Button key='onaccount' disabled appearance="default" className={classes.ActionButton}   >
                <FontAwesomeIcon icon={faIdCard} style={{ marginRight: '5px' }} />
                <label>On Account</label>
            </Button>);

        return tmp;
    }

    const cancelPayment = () => {
        dispatch(endPaymentMode());
        dispatch(selectPaymentMethod({}));
        dispatch(clearNumberInput());
        dispatch(selectCurrency(terminal.currencies[0].key));
    }

    const onInputChange = (e) => {
        dispatch(handleNumberInputChange(e));
    }

    const currencyPopOverSpeaker = (
        <Popover title={<span style={{ fontSize: '20px', display: 'block', textAlign: 'center' }}>Change Currency</span>}>
            {
                terminal.currencies.map((obj) => {
                    if (obj.key === trxSlice.selectedCurrency)
                        return null;
                    return <Button appearance='ghost' color='yellow' onClick={(e) => { dispatch(selectCurrency(obj.key)) }}
                        style={{ width: '200', height: '60', display: 'block', marginBottom: 10, fontSize: '18px' }}
                        key={obj.key}>{obj.code}</Button>
                })
            }
        </Popover>
    );


    return (
        <FlexboxGrid >
            <FlexboxGrid.Item colspan={24} style={{ height: '1vh' }} />
            <FlexboxGrid.Item colspan={11} style={{ background: 'white' }} >
                {terminal.display === 'ready' && <Invoice />}
                {terminal.display === 'balance-setup' && <BalanceSetup />}

            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={13}>
                <div style={{ background: '#303030', color: 'white', height: '5vh' }}>
                    <h4 style={{ lineHeight: '5vh', paddingLeft: '5px' }}>
                    </h4>
                </div>
                <div style={{ marginLeft: '10px' }}>
                    <FlexboxGrid justify='space-between'>
                        <FlexboxGrid.Item colspan={16}>

                            <Panel className={classes.Panel} bordered header={
                                <h6>
                                    <FontAwesomeIcon icon={faAddressCard} />
                                    <Divider vertical />
                                    Customer Information
                                </h6>
                            }>
                                <p>
                                    Cash Customer / Shini Bet
                                </p>
                                <Button appearance='primary' color='cyan' className={classes.ClearCustomerButton} disabled>
                                    <FontAwesomeIcon icon={faBroom} style={{ marginRight: '5px' }} />

                                    Clear Customer
                                </Button>
                            </Panel>
                            <br />
                            <Panel className={classes.Panel}
                                // style={{marginTop: terminal.paymentMode ? 0 : 45}}
                                bordered header={
                                    <React.Fragment>
                                        {terminal.paymentMode ?
                                            <h6>
                                                <FontAwesomeIcon icon={faHandHoldingDollar} />
                                                <Divider vertical />
                                                Payment Detail
                                                <Divider vertical />
                                                <small>({trxSlice.selectedPaymentMethod.description})</small>
                                                <Button appearance='primary' color='red'
                                                    onClick={cancelPayment}
                                                    style={{ width: '40', height: '94', position: 'absolute', right: 5, top: 5, fontSize: '11px',lineHeight: '1.2' }}>
                                                   <FontAwesomeIcon icon={faTimes} />
                                                </Button>

                                                <Button appearance='ghost' color='blue' onClick={open}
                                                    style={{ width: '60', height: '94', position: 'absolute', right: 50, top: 5, fontSize: 'larger' }}>
                                                    {trxSlice.selectedCurrency}
                                                </Button>


                                            </h6>
                                            :
                                            <h6>
                                                <FontAwesomeIcon icon={faHashtag} />
                                                <Divider vertical />
                                                Scan Multiplier
                                            </h6>
                                        }
                                        <Whisper placement="bottom" trigger="none" ref={triggerRef} speaker={currencyPopOverSpeaker}>
                                            <span style={{ position: 'absolute', right: 40, top: 50 }}> </span>
                                        </Whisper>
                                    </React.Fragment>
                                }>
                                <FlexboxGrid>
                                    <FlexboxGrid.Item colspan={14} >
                                        <Input readOnly={!terminal.paymentMode} onChange={onInputChange}
                                            value={trxSlice.numberInputValue.concat(trxSlice.numberInputMode === 'multiplier' ? ' X ' : '')}
                                            placeholder={terminal.paymentMode ? 'Insert Payment Amount' : '2 X <SCAN>'} style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none', boxShadow: 'none' }} />
                                    </FlexboxGrid.Item>
                                    <FlexboxGrid.Item colspan={10} >

                                    </FlexboxGrid.Item>
                                </FlexboxGrid>
                            </Panel>
                            <br />
                            <Numpad />

                        </FlexboxGrid.Item>

                        <FlexboxGrid.Item colspan={1} />

                        <FlexboxGrid.Item colspan={7}>
                            {
                                actionsMode === 'payment' && buildPaymentMethodButtons()
                            }
                        </FlexboxGrid.Item>

                        <FlexboxGrid.Item colspan={1} />

                        <FlexboxGrid.Item colspan={24} style={{ marginTop: '4px' }}>
                            <FlexboxGrid>
                                <FlexboxGrid.Item colspan={6}>
                                    <Button className={classes.POSButton}
                                        appearance={actionsMode === 'payment' ? 'primary' : 'default'}
                                        color='violet'
                                        onClick={() => setActionsMode('payment')} >
                                        <FontAwesomeIcon icon={faSackDollar} style={{ marginRight: '5px' }} />
                                        <label>Payment</label>
                                    </Button>
                                </FlexboxGrid.Item>
                                <FlexboxGrid.Item colspan={6}>
                                    <Button className={classes.POSButton}
                                        appearance={actionsMode === 'fastItems' ? 'primary' : 'default'}
                                        color='violet'
                                        onClick={() => setActionsMode('fastItems')} >
                                        <FontAwesomeIcon icon={faCarrot} style={{ marginRight: '5px' }} />
                                        <label>Fast Items</label>
                                    </Button>
                                </FlexboxGrid.Item>
                                <FlexboxGrid.Item colspan={6}>
                                    <Button className={classes.POSButton}
                                        appearance={actionsMode === 'operations' ? 'primary' : 'default'}
                                        color='violet'
                                        onClick={() => setActionsMode('operations')} >
                                        <FontAwesomeIcon icon={faToolbox} style={{ marginRight: '5px' }} />
                                        <label>Operations</label>
                                    </Button>
                                </FlexboxGrid.Item>

                                <FlexboxGrid.Item colspan={6}>
                                    <Button color={'red'} appearance="primary" className={classes.POSButton} >
                                        <FontAwesomeIcon icon={faShieldHalved} style={{ marginRight: '5px' }} />
                                        <label>Manager</label>
                                    </Button>
                                </FlexboxGrid.Item>
                            </FlexboxGrid>

                        </FlexboxGrid.Item>
                    </FlexboxGrid>
                </div>
            </FlexboxGrid.Item>
        </FlexboxGrid >
    );
}

export default Terminal;