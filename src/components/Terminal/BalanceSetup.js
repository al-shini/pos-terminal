import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux'

import { FlexboxGrid, PanelGroup, Panel, InputNumber, Button, Divider } from 'rsuite';
import { updateBalance, submitOpeningBalance } from '../../store/terminalSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons'
const BalanceSetup = (props) => {

    const terminal = useSelector((state) => state.terminal);
    const trxSlice = useSelector((state) => state.trx);
    const dispatch = useDispatch();


    const submitTillOpeningBalance = () => {
        dispatch(submitOpeningBalance(trxSlice.numberInputValue));
    }


    return (
        <React.Fragment >
            <div style={{ background: '#303030', color: 'white', height: '5vh' }}>
                <h4 style={{ lineHeight: '5vh', paddingLeft: '5px' }}>
                    <small style={{ color: '#e1e1e1' }} >Till Balance Variance - </small>Opening Balance
                </h4>
            </div>
            <Panel header={
                    <h5>Please Insert Opening Balance In <b>CASH</b></h5>
                }>
                <InputNumber readOnly={true} prefix='NIS' value={trxSlice.numberInputValue} />
            </Panel>

            <Button style={{ padding: 10, margin: '20px auto', width: '70%', display: 'block', lineHeight: 2, fontSize: 'larger' }}
                appearance="primary" color="blue" onClick={submitTillOpeningBalance}>
                Submit Balance Variance - Open Till
                <FontAwesomeIcon style={{ marginLeft: 10 }} icon={faPaperPlane} />
            </Button>
        </React.Fragment>
    );
}

export default BalanceSetup;