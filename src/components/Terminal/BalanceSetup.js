import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux'

import { FlexboxGrid, PanelGroup, Panel, InputNumber, Button } from 'rsuite';
import { updateBalance, submitOpeningBalance } from '../../store/terminalSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons'
const BalanceSetup = (props) => {

    const terminal = useSelector((state) => state.terminal);
    const dispatch = useDispatch();

    const handleChange = (e, i) => {
        dispatch(updateBalance({ i: i, balance: e }));
    }

    const submitTillOpeningBalance = () => {
        dispatch(submitOpeningBalance());
    }


    return (
        <React.Fragment >
            <div style={{ background: '#303030', color: 'white', height: '5vh' }}>
                <h4 style={{ lineHeight: '5vh', paddingLeft: '5px' }}>
                    <small style={{ color: '#e1e1e1' }} >Till Balance Variance - </small>Opening Balance
                </h4>
            </div>
            <PanelGroup accordion bordered defaultActiveKey={1}>
                {
                    terminal.balanceVariance.map((bv, i) => {
                        return <Panel eventKey={bv.viewOrder} key={bv.key} header={bv.currency.concat(' (' + bv.openingBalance + ')')}>
                            <label>
                                Terminal Cash Openinig Balance For Till = 
                            </label>
                            <br />
                            <br/>
                            <InputNumber prefix={bv.currency} value={bv.openingBalance} onChange={(e) => handleChange(e, i)} />
                        </Panel>
                    })
                }
            </PanelGroup>
            <Button style={{padding: 10,margin: '20px auto', width: '70%',display:'block', lineHeight: 2, fontSize: 'larger'}} 
            appearance="primary" color="blue" onClick={submitTillOpeningBalance}>
                Submit Balance Variance - Open Till 
                <FontAwesomeIcon style={{marginLeft: 10}} icon={faPaperPlane} />
            </Button>
        </React.Fragment>
    );
}

export default BalanceSetup;