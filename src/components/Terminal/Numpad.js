import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux'
import { Button, Input, FlexboxGrid, Panel, Divider, Whisper, Popover } from 'rsuite';
import { IconButton } from 'rsuite';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    fa1, fa2, fa3, fa4, fa5, fa6, fa7, fa8, fa9, faTimes, faAnglesLeft, faC, faHandHoldingDollar, faHashtag, faUser
} from '@fortawesome/free-solid-svg-icons'
import styles from './Numpad.module.css';
import classes from './Terminal.module.css';

import { handleNumberInputChange } from '../../store/trxSlice';
import { notify } from '../../store/uiSlice';

import { clearNumberInput, handleNumberInputEntry, reverseNumberInputEntry, prepareScanMultiplier, closeTrxPayment } from '../../store/trxSlice';
import FlexboxGridItem from 'rsuite/esm/FlexboxGrid/FlexboxGridItem';

const Numpad = (props) => {
    const trxSlice = useSelector((state) => state.trx);
    const terminal = useSelector((state) => state.terminal);

    const dispatch = useDispatch();

    const onInputChange = (e) => {


        dispatch(handleNumberInputChange(e));
    }

    const handleOk = () => {
        if (terminal.paymentMode) {
            let paymentComplete = false;

            if (trxSlice.trx) {
                const change = trxSlice.trx.customerchange;
                if (change >= 0) {
                    paymentComplete = true;
                    dispatch(closeTrxPayment(trxSlice.trx.key));
                    return;
                }
            }

            if (terminal.paymentInput === 'numpad') {

            }

        } else {

        }
    }

    return (

        <FlexboxGrid dir='column' style={{ background: 'white !important' }} >
            <FlexboxGridItem colspan={24}>
                <Panel className={classes.Panel} >
                    <Input onChange={onInputChange} value={trxSlice.numberInputValue.concat(trxSlice.numberInputMode === 'multiplier' ? ' X ' : '')}
                        placeholder={terminal.paymentMode && terminal.paymentInput === 'numpad' ? 'Insert Payment Amount' : 'Search'}
                        style={{ borderRadius: 0, boxShadow: 'none', borderColor: 'rgb(123,123,123)' }} />
                </Panel>
            </FlexboxGridItem>
            <FlexboxGrid.Item colspan={18}>
                <FlexboxGrid dir='column' >
                    <FlexboxGrid.Item colspan={8}>
                        <IconButton disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}
                            onClick={() => dispatch(handleNumberInputEntry('1'))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa1} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}
                            onClick={() => dispatch(handleNumberInputEntry('2'))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa2} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}
                            onClick={() => dispatch(handleNumberInputEntry('3'))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa3} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}
                            onClick={() => dispatch(handleNumberInputEntry('4'))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa4} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}
                            onClick={() => dispatch(handleNumberInputEntry('5'))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa5} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}
                            onClick={() => dispatch(handleNumberInputEntry('6'))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa6} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}
                            onClick={() => dispatch(handleNumberInputEntry('7'))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa7} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}
                            onClick={() => dispatch(handleNumberInputEntry('8'))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa8} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}
                            onClick={() => dispatch(handleNumberInputEntry('9'))} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={fa9} />} />
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <Button disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}
                            onClick={() => dispatch(handleNumberInputEntry('0'))} className={styles.NumpadButton} >
                            <span style={{ fontSize: '20px' }}>0</span>
                        </Button>
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <Button disabled={(!terminal.paymentMode) || (terminal.paymentMode && terminal.paymentInput !== 'numpad')}
                            onClick={() => dispatch(handleNumberInputEntry('.'))} className={styles.NumpadButton} >
                            <span style={{ fontSize: '40px', position: 'relative', bottom: 11 }}>.</span>
                        </Button>
                    </FlexboxGrid.Item>

                    <FlexboxGrid.Item colspan={8}>
                        <IconButton disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}
                            onClick={() => dispatch(clearNumberInput())} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={faC} />} appearance='primary' color='red' />
                    </FlexboxGrid.Item>

                </FlexboxGrid>
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={6}>
                <FlexboxGrid >
                    <FlexboxGrid.Item colspan={24}>
                        <IconButton disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}
                            onClick={() => dispatch(reverseNumberInputEntry())} className={styles.NumpadButton} icon={<FontAwesomeIcon icon={faAnglesLeft} />}
                            appearance='primary' color='orange' />
                    </FlexboxGrid.Item>
                    <FlexboxGrid.Item colspan={24}>
                        <IconButton onClick={() => dispatch(prepareScanMultiplier())} className={styles.NumpadButton}
                            disabled={terminal.paymentMode && terminal.paymentInput !== 'numpad'}
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