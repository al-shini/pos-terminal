import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux'

import { FlexboxGrid, IconButton, Button } from 'rsuite';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    fa1, fa2, fa3, fa4, fa5, fa6, fa7, fa8, fa9, faTimes, faAnglesLeft, faC
} from '@fortawesome/free-solid-svg-icons'
import styles from './Numpad.module.css';

import { clearNumberInput, handleNumberInputEntry, reverseNumberInputEntry, prepareScanMultiplier, submitPayment } from '../../store/trxSlice';

const Numpad = (props) => {
    const trxSlice = useSelector((state) => state.trx);
    const terminal = useSelector((state) => state.terminal);

    const dispatch = useDispatch();


    const keyListener = (event) => {
        // var eventKey = event.key;
        // if (terminal.paymentMode) {
        //     if (eventKey == '0' || eventKey == '1' || eventKey == '2'
        //         || eventKey == '3' || eventKey == '4' || eventKey == '5'
        //         || eventKey == '6' || eventKey == '7' || eventKey == '8'
        //         || eventKey == '9') {
        //         dispatch(handleNumberInputEntry(eventKey))
        //     } else if (eventKey === 'Enter') {
        //         event.preventDefault();
        //     }
        //     else if (eventKey === 'Backspace') {
        //         dispatch(reverseNumberInputEntry())
        //     }
        // }
    }


    return (

        <FlexboxGrid dir='column' >
            <FlexboxGrid.Item colspan={6}>
                <IconButton onClick={() => dispatch(handleNumberInputEntry('1'))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa1} />} />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton onClick={() => dispatch(handleNumberInputEntry('2'))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa2} />} />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton onClick={() => dispatch(handleNumberInputEntry('3'))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa3} />} />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton onClick={() => dispatch(reverseNumberInputEntry())} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={faAnglesLeft} />}
                    appearance='primary' color='orange' />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton onClick={() => dispatch(handleNumberInputEntry('4'))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa4} />} />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton onClick={() => dispatch(handleNumberInputEntry('5'))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa5} />} />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton onClick={() => dispatch(handleNumberInputEntry('6'))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa6} />} />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton onClick={() => dispatch(prepareScanMultiplier())} className={styles.NumpadButton}
                    disabled={terminal.paymentMode}
                    icon={<FontAwesomeIcon icon={faTimes} />}
                    appearance='primary' color='blue' />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton onClick={() => dispatch(handleNumberInputEntry('7'))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa7} />} />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton onClick={() => dispatch(handleNumberInputEntry('8'))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa8} />} />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton onClick={() => dispatch(handleNumberInputEntry('9'))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa9} />} />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <Button onClick={() => dispatch(handleNumberInputEntry('0'))} className={styles.NumpadButton} >
                    <span style={{ fontSize: '20px' }}>0</span>
                </Button>
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <Button onClick={() => dispatch(handleNumberInputEntry('.'))} className={styles.NumpadButton} >
                    <span style={{ fontSize: '40px', position: 'relative', bottom: 11 }}>.</span>
                </Button>
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <IconButton onClick={() => dispatch(clearNumberInput())} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={faC} />} appearance='primary' color='red' />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <Button color='green' appearance='primary' className={[styles.NumpadButton, styles.OK]}
                    onClick={(e) => {
                        dispatch(submitPayment({
                            tillKey: terminal.till ? terminal.till.key : null,
                            trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                            paymentMethodKey: trxSlice.selectedPaymentMethod ? trxSlice.selectedPaymentMethod.key : null,
                            currency: trxSlice.selectedCurrency,
                            amount: parseFloat(trxSlice.numberInputValue)
                        }))
                    }}
                >
                    OK
                </Button>
            </FlexboxGrid.Item>
        </FlexboxGrid>
    );
}

export default Numpad;