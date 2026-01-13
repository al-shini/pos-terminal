import React, { useState } from 'react';
import { useDispatch } from 'react-redux'

import { Panel, Button, ButtonToolbar } from 'rsuite';
import { submitOpeningBalance } from '../../store/terminalSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faShoppingBag, faDeleteLeft } from '@fortawesome/free-solid-svg-icons'

const BalanceSetup = (props) => {
    const dispatch = useDispatch();
    const [inputValue, setInputValue] = useState('200');

    const handleKeyPress = (key) => {
        if (key === 'C') {
            setInputValue('');
        } else if (key === 'DEL') {
            setInputValue(prev => prev.slice(0, -1));
        } else {
            // Max 3 digits
            if (inputValue.length < 3) {
                setInputValue(prev => prev + key);
            }
        }
    };

    const submitTillInitialization = () => {
        const bags = parseInt(inputValue) || 0;
        if (bags <= 0) {
            return;
        }
        dispatch(submitOpeningBalance({ 
            balance: 1000, // Fixed opening balance
            startingBags: bags 
        }));
    }

    const keypadButtonStyle = {
        width: '70px',
        height: '60px',
        fontSize: '24px',
        fontWeight: 'bold',
        margin: '4px',
        borderRadius: '8px'
    };

    return (
        <React.Fragment>
            <div style={{ background: '#303030', color: 'white', height: '5vh' }}>
                <h4 style={{ lineHeight: '5vh', paddingLeft: '5px' }}>
                    <FontAwesomeIcon icon={faShoppingBag} style={{ marginRight: '10px' }} />
                    Till Initialization - Starting Bags
                </h4>
            </div>
            <Panel header={
                <h5 style={{ textAlign: 'center' }}>Enter your starting bag count for this till session</h5>
            }>
                {/* Display */}
                <div style={{ 
                    textAlign: 'center', 
                    marginBottom: '20px',
                    padding: '15px',
                    background: '#f5f5f5',
                    borderRadius: '8px',
                    border: '2px solid #2e7d32'
                }}>
                    <FontAwesomeIcon icon={faShoppingBag} style={{ fontSize: '40px', color: '#2e7d32', marginBottom: '10px' }} />
                    <div style={{ 
                        fontSize: '48px', 
                        fontWeight: 'bold', 
                        color: '#2e7d32',
                        fontFamily: 'DSDIGI',
                        minHeight: '60px'
                    }}>
                        {inputValue || '0'}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>bags</div>
                </div>

                {/* Keypad */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <ButtonToolbar>
                        <Button style={keypadButtonStyle} appearance="default" onClick={() => handleKeyPress('1')}>1</Button>
                        <Button style={keypadButtonStyle} appearance="default" onClick={() => handleKeyPress('2')}>2</Button>
                        <Button style={keypadButtonStyle} appearance="default" onClick={() => handleKeyPress('3')}>3</Button>
                    </ButtonToolbar>
                    <ButtonToolbar>
                        <Button style={keypadButtonStyle} appearance="default" onClick={() => handleKeyPress('4')}>4</Button>
                        <Button style={keypadButtonStyle} appearance="default" onClick={() => handleKeyPress('5')}>5</Button>
                        <Button style={keypadButtonStyle} appearance="default" onClick={() => handleKeyPress('6')}>6</Button>
                    </ButtonToolbar>
                    <ButtonToolbar>
                        <Button style={keypadButtonStyle} appearance="default" onClick={() => handleKeyPress('7')}>7</Button>
                        <Button style={keypadButtonStyle} appearance="default" onClick={() => handleKeyPress('8')}>8</Button>
                        <Button style={keypadButtonStyle} appearance="default" onClick={() => handleKeyPress('9')}>9</Button>
                    </ButtonToolbar>
                    <ButtonToolbar>
                        <Button style={{ ...keypadButtonStyle, background: '#ff6b6b', color: 'white' }} onClick={() => handleKeyPress('C')}>C</Button>
                        <Button style={keypadButtonStyle} appearance="default" onClick={() => handleKeyPress('0')}>0</Button>
                        <Button style={{ ...keypadButtonStyle, background: '#ffa500', color: 'white' }} onClick={() => handleKeyPress('DEL')}>
                            <FontAwesomeIcon icon={faDeleteLeft} />
                        </Button>
                    </ButtonToolbar>
                </div>

                <p style={{ textAlign: 'center', marginTop: '15px', color: '#666' }}>
                    Default: 200 bags
                </p>
            </Panel>

            <Button 
                style={{ padding: 10, margin: '20px auto', width: '70%', display: 'block', lineHeight: 2, fontSize: 'larger' }}
                appearance="primary" 
                color="green" 
                onClick={submitTillInitialization}
                disabled={!inputValue || parseInt(inputValue) <= 0}
            >
                Start Till Session
                <FontAwesomeIcon style={{ marginLeft: 10 }} icon={faPaperPlane} />
            </Button>
        </React.Fragment>
    );
}

export default BalanceSetup;
