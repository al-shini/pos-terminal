import React from 'react';
import { useDispatch, useSelector } from 'react-redux'
import { Button, Input, FlexboxGrid, Panel } from 'rsuite';
import { IconButton } from 'rsuite';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    fa1, fa2, fa3, fa4, fa5, fa6, fa7, fa8, fa9, faTimes, faAnglesLeft, faC, faScaleBalanced
} from '@fortawesome/free-solid-svg-icons'
import styles from './Numpad.module.css';
import classes from './Terminal.module.css';

import { changePrice, clearLastPaymentHistory, handleNumberInputChange, prepareScanMultiplierPreDefined, scanBarcode, scanNewTransaction, selectCurrency, submitPayment } from '../../store/trxSlice';
import { notify, showLoading } from '../../store/uiSlice';

import { clearNumberInput, handleNumberInputEntry, reverseNumberInputEntry, prepareScanMultiplier, closeTrxPayment } from '../../store/trxSlice';
import { fetchSuspendedForTill, setManagerMode } from '../../store/terminalSlice';
import FlexboxGridItem from 'rsuite/esm/FlexboxGrid/FlexboxGridItem';

import axios from '../../axios';
import config from '../../config';


const Numpad = (props) => {
    const trxSlice = useSelector((state) => state.trx);
    const terminal = useSelector((state) => state.terminal);

    const dispatch = useDispatch();

    const isRefundMode = terminal.trxMode === 'Refund';
    const btnClass = isRefundMode
        ? `${styles.NumpadButton} ${styles.Refund}`
        : styles.NumpadButton;
    const okClass = isRefundMode
        ? `${styles.NumpadButton} ${styles.OK} ${styles.Refund}`
        : `${styles.NumpadButton} ${styles.OK}`;

    const onInputChange = (e) => {
        let regex = /^[a-zA-Z!@#$%^&*)(+=_-]+$/g;

        if (!terminal.paymentMode && e.includes('.')) {
            return;
        }

        if (regex.test(e)) {
            return;
        }

        dispatch(handleNumberInputChange({
            value: e,
            paymentMode: terminal.paymentMode
        }));
    }

    const handleOk = () => {
        if (trxSlice.closingTrx) {
            return;
        }
        if (terminal.till && terminal.till.isInitialized) {
            if (terminal.paymentMode) {
                if (trxSlice.trx) {
                    console.log("INSIDE TRX")
                    const change = trxSlice.trx.customerchange;
                    if (change >= 0) {
                        dispatch(closeTrxPayment({
                            key: trxSlice.trx.key
                        }));
                        dispatch(fetchSuspendedForTill())
                        window.setTimeout(() => {
                            dispatch(clearLastPaymentHistory());
                        }, 6000)

                        window.setTimeout(() => {
                            props.incrementTrxCount();
                        }, 3000)

                        return;
                    }
                }


                if (terminal.paymentInput === 'numpad') {
                    console.log("INSIDE numpad")

                    if (!trxSlice.selectedCurrency) {
                        dispatch(selectCurrency(config.systemCurrency))
                    }

                    if (!trxSlice.numberInputValue) {
                        dispatch(notify({
                            msg: 'Please specify valid amount',
                            sev: 'error'
                        }))
                        return;

                    }

                    dispatch(submitPayment({
                        tillKey: terminal.till ? terminal.till.key : null,
                        trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                        paymentMethodKey: trxSlice.selectedPaymentMethod,
                        currency: trxSlice.selectedCurrency ? trxSlice.selectedCurrency : config.systemCurrency,
                        amount: trxSlice.numberInputValue,
                        sourceKey: '',
                        visaPayment: null
                    }))
                }

            } else if (trxSlice.priceChangeMode) {
                dispatch(changePrice());
            } else {
                if (trxSlice.numberInputValue) {

                    if (trxSlice.trx && trxSlice.trx.key) {
                        dispatch(scanBarcode({
                            customerKey: terminal.customer ? terminal.customer.key : null,
                            barcode: trxSlice.numberInputValue,
                            trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                            trxMode: terminal.trxMode,
                            tillKey: terminal.till ? terminal.till.key : null,
                            multiplier: trxSlice.multiplier ? trxSlice.multiplier : '1',
                            manualEntry: true
                        }))
                    } else {

                        dispatch(scanNewTransaction({
                            customerKey: terminal.customer ? terminal.customer.key : null,
                            barcode: trxSlice.numberInputValue,
                            trxKey: null,
                            trxMode: terminal.trxMode,
                            tillKey: terminal.till ? terminal.till.key : null,
                            multiplier: trxSlice.multiplier ? trxSlice.multiplier : '1',
                            manualEntry: true
                        }))
                    }

                }

            }
        } else {
            // Till not initialized - BalanceSetup component handles initialization
            dispatch(notify({
                msg: 'Please initialize the till first',
                sev: 'warning'
            }))
        }
    }

    const handlePrepareMultiplier = () => {
        axios({
            method: 'post',
            url: '/utilities/generateQR',
            data: {
                hardwareId: config.deviceId,
                source: 'QTY-Multiplier',
                sourceKey: terminal.terminal.tillKey,
                creator: terminal.loggedInUser.key
            }
        }).then((response) => {
            if (response && response.data) {
                props.setAuthQR({
                    ...response.data,
                    source: 'QTY-Multiplier'
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


    return (

        <FlexboxGrid dir='column' style={{ background: 'transparent' }} >
            <FlexboxGridItem colspan={24}>
                <Panel className={classes.Panel} >
                    <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                        {!trxSlice.priceChangeMode &&
                            <Input value={trxSlice.multiplier ? ('' + trxSlice.multiplier).concat(' X') : '-'}
                                placeholder={'X'}
                                style={{
                                    width: 72,
                                    flexShrink: 0,
                                    height: 38,
                                    borderRadius: 10,
                                    boxShadow: 'none',
                                    textAlign: 'center',
                                    color: '#111827',
                                    fontFamily: '"DSDIGI", monospace',
                                    fontSize: 16,
                                    fontWeight: 700,
                                    border: '1px solid #E5E7EB',
                                    background: '#FFFFFF',
                                    padding: '0 6px'
                                }} />
                        }
                        {trxSlice.priceChangeMode &&
                            <Input value={config.currencySymbol + ' ' + (trxSlice.selectedLine ? (trxSlice.selectedLine.finalprice / trxSlice.selectedLine.qty) : '-') + ' -> '}
                                disabled
                                placeholder={'Old Price'}
                                style={{
                                    width: 110,
                                    flexShrink: 0,
                                    height: 38,
                                    borderRadius: 10,
                                    boxShadow: 'none',
                                    textAlign: 'center',
                                    color: '#6B7280',
                                    fontFamily: '"DSDIGI", monospace',
                                    fontSize: 14,
                                    fontWeight: 700,
                                    border: '1px solid #E5E7EB',
                                    background: '#F8FAFC',
                                    padding: '0 6px'
                                }} />
                        }
                        <Input onChange={onInputChange} value={trxSlice.numberInputValue}
                            disabled={terminal.paymentMode && terminal.paymentInput === 'fixed'}
                            placeholder={terminal.paymentMode && terminal.paymentInput === 'numpad'
                                ? trxSlice.selectedPaymentMethod === 'Voucher' ? 'Insert Voucher/Coupon Key' :
                                    'Rate (' + trxSlice.selectedCurrency + ' x ' + (trxSlice.selectedCurrency === config.systemCurrency ? '1' : terminal.exchangeRates[trxSlice.selectedCurrency]) + ')' :
                                terminal.paymentMode && terminal.paymentInput === 'fixed' ? '-' : trxSlice.priceChangeMode ? 'Insert New Price (Per Item)' : 'Search'}
                            style={{
                                flex: 1,
                                minWidth: 0,
                                height: 38,
                                borderRadius: 10,
                                boxShadow: 'none',
                                border: '1px solid #D1D5DB',
                                background: '#FFFFFF',
                                fontSize: 16,
                                fontWeight: 700,
                                fontFamily: '"DSDIGI", monospace',
                                color: '#111827',
                                paddingLeft: 12,
                                paddingRight: 12
                            }} />
                        {(terminal.paymentMode &&
                            terminal.paymentInput === 'numpad' &&
                            (terminal.exchangeRates[trxSlice.selectedCurrency] && terminal.exchangeRates[trxSlice.selectedCurrency] > 1)) &&
                            <Input value={terminal.exchangeRates[trxSlice.selectedCurrency] * (trxSlice.numberInputValue ? trxSlice.numberInputValue : 0)}
                                disabled
                                placeholder={'Rate'}
                                style={{
                                    width: 78,
                                    flexShrink: 0,
                                    height: 38,
                                    borderRadius: 10,
                                    boxShadow: 'none',
                                    textAlign: 'center',
                                    color: '#6B7280',
                                    fontFamily: '"DSDIGI", monospace',
                                    fontSize: 14,
                                    fontWeight: 700,
                                    border: '1px solid #E5E7EB',
                                    background: '#F8FAFC',
                                    padding: '0 6px'
                                }} />
                        }
                    </div>
                </Panel>
            </FlexboxGridItem>
            <FlexboxGrid.Item colspan={18}>
                <FlexboxGrid dir='column' >
                    <FlexboxGrid.Item colspan={8}>
                        <IconButton disabled={terminal.paymentMode && terminal.paymentInput === 'fixed'}
                            onClick={() => dispatch(handleNumberInputEntry({ value: '1', paymentMode: terminal.paymentMode }))} className={btnClass} icon={<FontAwesomeIcon icon={fa1} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton
                            disabled={terminal.paymentMode && terminal.paymentInput === 'fixed'}
                            onClick={() => dispatch(handleNumberInputEntry({ value: '2', paymentMode: terminal.paymentMode }))} className={btnClass} icon={<FontAwesomeIcon icon={fa2} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton
                            disabled={terminal.paymentMode && terminal.paymentInput === 'fixed'}
                            onClick={() => dispatch(handleNumberInputEntry({ value: '3', paymentMode: terminal.paymentMode }))} className={btnClass} icon={<FontAwesomeIcon icon={fa3} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton
                            disabled={terminal.paymentMode && terminal.paymentInput === 'fixed'}
                            onClick={() => dispatch(handleNumberInputEntry({ value: '4', paymentMode: terminal.paymentMode }))} className={btnClass} icon={<FontAwesomeIcon icon={fa4} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton
                            disabled={terminal.paymentMode && terminal.paymentInput === 'fixed'}
                            onClick={() => dispatch(handleNumberInputEntry({ value: '5', paymentMode: terminal.paymentMode }))} className={btnClass} icon={<FontAwesomeIcon icon={fa5} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton
                            disabled={terminal.paymentMode && terminal.paymentInput === 'fixed'}
                            onClick={() => dispatch(handleNumberInputEntry({ value: '6', paymentMode: terminal.paymentMode }))} className={btnClass} icon={<FontAwesomeIcon icon={fa6} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton
                            disabled={terminal.paymentMode && terminal.paymentInput === 'fixed'}
                            onClick={() => dispatch(handleNumberInputEntry({ value: '7', paymentMode: terminal.paymentMode }))} className={btnClass} icon={<FontAwesomeIcon icon={fa7} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton
                            disabled={terminal.paymentMode && terminal.paymentInput === 'fixed'}
                            onClick={() => dispatch(handleNumberInputEntry({ value: '8', paymentMode: terminal.paymentMode }))} className={btnClass} icon={<FontAwesomeIcon icon={fa8} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton
                            disabled={terminal.paymentMode && terminal.paymentInput === 'fixed'}
                            onClick={() => dispatch(handleNumberInputEntry({ value: '9', paymentMode: terminal.paymentMode }))} className={btnClass} icon={<FontAwesomeIcon icon={fa9} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <Button
                            disabled={terminal.paymentMode && terminal.paymentInput === 'fixed'}
                            onClick={() => dispatch(handleNumberInputEntry({ value: '0', paymentMode: terminal.paymentMode }))} className={btnClass} >
                            <span style={{ fontSize: '20.01px' }}>0</span>
                        </Button>
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <Button
                            disabled={terminal.paymentMode && terminal.paymentInput === 'fixed'}
                            onClick={() => dispatch(handleNumberInputEntry({ value: '.', paymentMode: terminal.paymentMode }))} className={btnClass} >
                            <span style={{ fontSize: '40px', position: 'relative', bottom: 11 }}>.</span>
                        </Button>
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton
                            disabled={terminal.paymentMode && terminal.paymentInput === 'fixed'}
                            onClick={() => dispatch(clearNumberInput())} className={btnClass} icon={<FontAwesomeIcon icon={faC} />} appearance='primary' color='red' />
                    </FlexboxGrid.Item>

                </FlexboxGrid>
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <FlexboxGrid >
                    <FlexboxGrid.Item colspan={24}>
                        <IconButton
                            onClick={() => dispatch(reverseNumberInputEntry())} className={btnClass} icon={<FontAwesomeIcon icon={faAnglesLeft} />}
                            appearance='primary' color='orange' />
                    </FlexboxGrid.Item>
                    <FlexboxGrid.Item colspan={24}>
                        <IconButton onClick={() => {dispatch(prepareScanMultiplier())}} className={btnClass}
                            disabled={trxSlice.priceChangeMode}
                            icon={<FontAwesomeIcon icon={faTimes} />}
                            appearance='primary' color='blue' />
                    </FlexboxGrid.Item>
                    <FlexboxGrid.Item colspan={24} id='OkButton'>
                        <Button color={isRefundMode ? 'red' : 'green'} appearance='primary' className={okClass}
                            disabled={trxSlice.closingTrx}
                            onClick={handleOk} >
                            {trxSlice.closingTrx ? '...' : 'OK'}
                        </Button>
                    </FlexboxGrid.Item>
                </FlexboxGrid>
            </FlexboxGrid.Item>
        </FlexboxGrid>
    );
}

export default Numpad;