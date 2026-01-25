import React from 'react';
import { useDispatch } from 'react-redux'

import { Panel, Button } from 'rsuite';
import { submitOpeningBalance } from '../../store/terminalSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons'

const BalanceSetup = (props) => {
    const dispatch = useDispatch();
    const submitTillInitialization = () => {
        dispatch(submitOpeningBalance({ 
            balance: 1000 // Fixed opening balance
        }));
    }

    return (
        <React.Fragment>
            <div style={{ background: '#303030', color: 'white', height: '5vh' }}>
                <h4 style={{ lineHeight: '5vh', paddingLeft: '5px' }}>
                    Till Initialization
                </h4>
            </div>
            <Panel header={
                <h5 style={{ textAlign: 'center' }}>Start the till session</h5>
            }>
            </Panel>

            <Button 
                style={{ padding: 10, margin: '20px auto', width: '70%', display: 'block', lineHeight: 2, fontSize: 'larger' }}
                appearance="primary" 
                color="green" 
                onClick={submitTillInitialization}
            >
                Start Till Session
                <FontAwesomeIcon style={{ marginLeft: 10 }} icon={faPaperPlane} />
            </Button>
        </React.Fragment>
    );
}

export default BalanceSetup;
