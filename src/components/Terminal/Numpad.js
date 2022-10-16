import React from 'react';
import { useDispatch, useSelector } from 'react-redux'
import { Button, Input, FlexboxGrid, Panel } from 'rsuite';
import { IconButton } from 'rsuite';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    fa1, fa2, fa3, fa4, fa5, fa6, fa7, fa8, fa9, faTimes, faAnglesLeft, faC
} from '@fortawesome/free-solid-svg-icons'
import styles from './Numpad.module.css';
import classes from './Terminal.module.css';

import { changePrice, clearLastPaymentHistory, handleNumberInputChange, scanBarcode, scanNewTransaction, submitPayment } from '../../store/trxSlice';
import { notify } from '../../store/uiSlice';

import { clearNumberInput, handleNumberInputEntry, reverseNumberInputEntry, prepareScanMultiplier, closeTrxPayment } from '../../store/trxSlice';
import { submitOpeningBalance } from '../../store/terminalSlice';
import FlexboxGridItem from 'rsuite/esm/FlexboxGrid/FlexboxGridItem';

const Numpad = (props) => {
    const trxSlice = useSelector((state) => state.trx);
    const terminal = useSelector((state) => state.terminal);

    const dispatch = useDispatch();

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
        if (terminal.till && terminal.till.isInitialized) {
            if (terminal.paymentMode) {
                if (trxSlice.trx) {
                    const change = trxSlice.trx.customerchange;
                    if (change >= 0) {
                        dispatch(closeTrxPayment({
                            key: trxSlice.trx.key,
                            sendToNumber: '597267949'
                        }));
                        window.setTimeout(() => {
                            dispatch(clearLastPaymentHistory());
                        }, 6000)

                        return;
                    }
                }

                if (terminal.paymentInput === 'numpad') {
                    if (!trxSlice.selectedCurrency) {
                        dispatch(notify({
                            msg: 'Please select currency',
                            sev: 'error'
                        }))
                        return;
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
                        currency: trxSlice.selectedCurrency,
                        amount: trxSlice.numberInputValue,
                        sourceKey: ''
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
                            multiplier: trxSlice.multiplier ? trxSlice.multiplier : '1'
                        }))
                    } else {

                        dispatch(scanNewTransaction({
                            customerKey: terminal.customer ? terminal.customer.key : null,
                            barcode: trxSlice.numberInputValue,
                            trxKey: null,
                            trxMode: terminal.trxMode,
                            tillKey: terminal.till ? terminal.till.key : null,
                            multiplier: trxSlice.multiplier ? trxSlice.multiplier : '1'
                        }))
                    }

                }

            }
        } else if (terminal.till && trxSlice.numberInputValue) {
            dispatch(submitOpeningBalance(trxSlice.numberInputValue));
            dispatch(clearNumberInput());

        } else {
            dispatch(notify({
                msg: 'Invalid Opening Balance Value',
                sev: 'error'
            }))
        }
    }

    return (

        <FlexboxGrid dir='column' style={{ background: 'white !important' }} >
            <FlexboxGridItem colspan={24}>
                <Panel className={classes.Panel} >
                    <FlexboxGrid>
                        {
                            // (!terminal.paymentMode) &&
                            <FlexboxGridItem colspan={5}>
                                {
                                    !trxSlice.priceChangeMode &&
                                    <Input value={trxSlice.multiplier ? ('' + trxSlice.multiplier).concat(' X') : '-'}
                                        disabled
                                        placeholder={'X'}
                                        style={{ borderRadius: 0, boxShadow: 'none', textAlign: 'center', color: '#404040' }} />
                                }
                                {
                                    trxSlice.priceChangeMode &&
                                    <Input value={'₪ ' + (trxSlice.selectedLine ? (trxSlice.selectedLine.finalprice / trxSlice.selectedLine.qty) : '-') + ' -> '}
                                        disabled
                                        placeholder={'Old Price'}
                                        style={{ borderRadius: 0, boxShadow: 'none', textAlign: 'center', color: '#404040' }} />
                                }
                            </FlexboxGridItem>
                        }
                        <FlexboxGridItem colspan={terminal.paymentMode ?
                            (terminal.exchangeRates[trxSlice.selectedCurrency] && terminal.exchangeRates[trxSlice.selectedCurrency] > 1 && terminal.paymentInput === 'numpad') ? 19 : 19

                            : 19}>
                            <Input onChange={onInputChange} value={trxSlice.numberInputValue}
                                disabled={terminal.paymentMode && terminal.paymentInput === 'fixed'}
                                placeholder={terminal.paymentMode && terminal.paymentInput === 'numpad'
                                    ? 'Insert Payment Amount (' + trxSlice.selectedCurrency + ' x ' + terminal.exchangeRates[trxSlice.selectedCurrency] + ')' :
                                    terminal.paymentMode && terminal.paymentInput === 'fixed' ? '-' : trxSlice.priceChangeMode ? 'Insert New Price (Per Item)' : 'Search'}
                                style={{ borderRadius: 0, boxShadow: 'none', borderColor: 'rgb(123,123,123)' }} />
                        </FlexboxGridItem>
                        {
                            (terminal.paymentMode &&
                                terminal.paymentInput === 'numpad' &&
                                (terminal.exchangeRates[trxSlice.selectedCurrency] && terminal.exchangeRates[trxSlice.selectedCurrency] > 1)) &&
                            <FlexboxGridItem colspan={4}>
                                <Input value={terminal.exchangeRates[trxSlice.selectedCurrency] * (trxSlice.numberInputValue ? trxSlice.numberInputValue : 0)}
                                    disabled
                                    placeholder={'Rate'}
                                    style={{ borderRadius: 0, boxShadow: 'none', textAlign: 'center', color: '#404040' }} />
                            </FlexboxGridItem>
                        }
                    </FlexboxGrid>
                </Panel>
            </FlexboxGridItem>
            <FlexboxGrid.Item colspan={18}>
                <FlexboxGrid dir='column' >
                    <FlexboxGrid.Item colspan={8}>
                        <IconButton /*disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}*/
                            onClick={() => dispatch(handleNumberInputEntry({ value: '1', paymentMode: terminal.paymentMode }))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa1} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton /*disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}*/
                            onClick={() => dispatch(handleNumberInputEntry({ value: '2', paymentMode: terminal.paymentMode }))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa2} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton /*disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}*/
                            onClick={() => dispatch(handleNumberInputEntry({ value: '3', paymentMode: terminal.paymentMode }))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa3} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton /*disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}*/   
                            onClick={() => dispatch(handleNumberInputEntry({ value: '4', paymentMode: terminal.paymentMode }))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa4} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton /*disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}*/
                            onClick={() => dispatch(handleNumberInputEntry({ value: '5', paymentMode: terminal.paymentMode }))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa5} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton /*disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}*/
                            onClick={() => dispatch(handleNumberInputEntry({ value: '6', paymentMode: terminal.paymentMode }))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa6} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton /*disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}*/
                            onClick={() => dispatch(handleNumberInputEntry({ value: '7', paymentMode: terminal.paymentMode }))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa7} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton /*disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}*/
                            onClick={() => dispatch(handleNumberInputEntry({ value: '8', paymentMode: terminal.paymentMode }))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa8} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton /*disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}*/
                            onClick={() => dispatch(handleNumberInputEntry({ value: '9', paymentMode: terminal.paymentMode }))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa9} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <Button /*disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}*/
                            onClick={() => dispatch(handleNumberInputEntry({ value: '0', paymentMode: terminal.paymentMode }))} className={styles.NumpadButton} >
                            <span style={{ fontSize: '20px' }}>0</span>
                        </Button>
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <Button /*disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}*/
                            onClick={() => dispatch(handleNumberInputEntry({ value: '.', paymentMode: terminal.paymentMode }))} className={styles.NumpadButton} >
                            <span style={{ fontSize: '40px', position: 'relative', bottom: 11 }}>.</span>
                        </Button>
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton /*disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}*/
                            onClick={() => dispatch(clearNumberInput())} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={faC} />} appearance='primary' color='red' />
                    </FlexboxGrid.Item>

                </FlexboxGrid>
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <FlexboxGrid >
                    <FlexboxGrid.Item colspan={24}>
                        <IconButton /*disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}*/
                            onClick={() => dispatch(reverseNumberInputEntry())} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={faAnglesLeft} />}
                            appearance='primary' color='orange' />
                    </FlexboxGrid.Item>
                    <FlexboxGrid.Item colspan={24}>
                        <IconButton onClick={() => dispatch(prepareScanMultiplier())} className={styles.NumpadButton}
                            disabled={(terminal.paymentMode && terminal.paymentInput !== 'fixed' ) || trxSlice.priceChangeMode}
                            icon={<FontAwesomeIcon icon={faTimes} />}
                            appearance='primary' color='blue' />
                    </FlexboxGrid.Item>
                    <FlexboxGrid.Item colspan={24} id='OkButton'>
                        <Button color='green' appearance='primary' className={[styles.NumpadButton, styles.OK]}
                            onClick={handleOk} >
                            OK
                        </Button>
                    </FlexboxGrid.Item>
                </FlexboxGrid>
            </FlexboxGrid.Item>
        </FlexboxGrid>
    );
}

export default Numpad;