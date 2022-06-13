import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux'

import { Button, Input, FlexboxGrid, Panel, Divider, } from 'rsuite';
import classes from './Terminal.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSackDollar, faBroom,
    faAddressCard, faSearch, faCarrot, faToolbox, faShieldHalved
} from '@fortawesome/free-solid-svg-icons'
import Numpad from './Numpad';
import Invoice from './Invoice';
import BalanceSetup from './BalanceSetup';
import buildActions from '../../models/trx-actions';


const Terminal = (props) => {

    const terminal = useSelector((state) => state.terminal);

    const [actionButtons, setActionButtons] = useState([]);
    const [actionsMode, setActionsMode] = useState('payment');

    useEffect(() => {
        setActionButtons(buildActions(actionsMode));
    }, [])


    useEffect(() => {
        setActionButtons(buildActions(actionsMode));
    }, [actionsMode])






    return (
        <FlexboxGrid >
            <FlexboxGrid.Item colspan={24} style={{ height: '1vh' }} />
            <FlexboxGrid.Item colspan={11} style={{background: 'white'}} >
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
                            <Panel className={classes.Panel} bordered >
                                <Input readOnly placeholder='2 X <SCAN>' style={{borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none', boxShadow: 'none'}} />
                            </Panel>
                            <br />
                            <Numpad />

                        </FlexboxGrid.Item>

                        <FlexboxGrid.Item colspan={1} />

                        <FlexboxGrid.Item colspan={7}>
                            <FlexboxGrid>
                                {
                                    actionButtons.map((obj) =>
                                        <FlexboxGrid.Item key={obj.label} colspan={24} style={{ marginBottom: '5px' }}>
                                            <Button appearance="default" className={classes.ActionButton} >
                                                <FontAwesomeIcon icon={obj.icon} style={{ marginRight: '5px' }} />
                                                <label>{obj.label}</label>
                                            </Button>
                                        </FlexboxGrid.Item>
                                    )
                                }
                            </FlexboxGrid>
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