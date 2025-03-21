import React from 'react';
import { useDispatch, useSelector } from 'react-redux'
import { Button, FlexboxGrid, Divider } from 'rsuite';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faUser, faIdCard, faLock, faStar
} from '@fortawesome/free-solid-svg-icons'

import Invoice from './Invoice';
import 'react-slideshow-image/dist/styles.css'

import Logo from '../../assets/full-logo.png';
import Lock from '../../assets/lock.png';
import Ad from '../../assets/ad.png'
import config from '../../config';
import ImageSlider from './ImageSlider';



const Terminal = (props) => {
    const terminal = useSelector((state) => state.terminal);
    const trxSlice = useSelector((state) => state.trx);

    return (
        <FlexboxGrid  >
            <FlexboxGrid.Item colspan={11} style={{ background: 'white', position: 'relative', left: '6px', width: '48.83333333%', height: '95vh' }}  >
                <Invoice />
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={1} style={{ width: '1.166667%' }}>

                {
                    terminal.blockActions && <div style={{
                        position: 'fixed',
                        zIndex: '999',
                        backgroundColor: 'rgba(0,0,0,0.6)', height: '100%', width: '100%', top: '0%', left: '0%'
                    }}>
                        <img src={Lock} style={{ margin: 'auto', display: 'block', top: '30%', position: 'relative' }} width='15%' />
                        <div style={{ textAlign: 'center', color: 'white', top: '30%', position: 'relative', fontSize: '25px' }} >
                            Terminal Locked
                        </div>
                    </div>
                }
            </FlexboxGrid.Item>

            <FlexboxGrid.Item colspan={12} style={{ position: 'relative', left: '6px', height: '95vh' }}>
                <div style={{ background: '#303030', color: 'white', height: '5vh', position: 'relative', width: '120%', right: '12px' }}>
                    <h6 style={{ lineHeight: '5vh', textAlign: 'left' }}>
                        <span> <FontAwesomeIcon icon={faUser} style={{ marginLeft: '20px', marginRight: '7px' }} /> {terminal.loggedInUser ? terminal.loggedInUser.username : 'No User'}</span>
                        <span style={{ marginRight: '10px', marginLeft: '10px' }}>/</span>
                        <span>{terminal.till && terminal.till.workDay ? terminal.till.workDay.businessDateAsString : 'No Work Day'}</span>
                    </h6>
                    <img src={Logo} style={{ position: 'fixed', right: '1vw', top: '0', zIndex: 1000, height: 'inherit' }} />
                </div>

                <div id='rightPosPanel' style={{ background: 'white', padding: '10px', position: 'absolute', top: '5vh', width: '96.5%', height: '90vh' }}>
                    <span>
                        <FontAwesomeIcon icon={faIdCard} style={{
                            marginLeft: '7px', marginRight: '7px', fontSize: '18px'
                        }} />
                        <span style={{
                            marginRight: '7px', fontFamily: 'Janna',
                            fontSize: '18px'
                        }}>
                            {terminal.customer ? terminal.customer.customerName : 'No Customer'}
                        </span>
                    </span>

                    {terminal.customer && terminal.customer.club && <Divider vertical /> &&
                        <span style={{ color: '#fa8900' }}>
                            <FontAwesomeIcon icon={faStar} style={{ marginLeft: '7px', marginRight: '7px' }} /> Club
                        </span>}

                    <Divider style={{ margin: '7px' }} />
                    {
                        terminal.paymentMode &&
                        <FlexboxGrid>
                            <FlexboxGrid.Item colspan={24} >
                                <div style={{ border: '1px solid #e1e1e1', padding: '3px', minWidth: '60%', margin: 'auto' }}>
                                    <small style={{ fontSize: '20px', marginRight: '5px' }}>
                                        Paid =
                                    </small>
                                    <b>
                                        <label id='Total' style={{ fontSize: '25px' }}>
                                            {(Math.round(trxSlice.trxPaid * 100) / 100).toFixed(config.systemCurrency === 'NIS'  ?  2 : 3)}
                                        </label>
                                    </b>
                                </div>
                            </FlexboxGrid.Item>
                            <FlexboxGrid.Item colspan={24}>
                                <br />
                            </FlexboxGrid.Item>
                            <FlexboxGrid.Item colspan={24}>
                                <div style={{ border: '1px solid #e1e1e1', padding: '3px', minwidth: '60%', margin: 'auto' }}>
                                    <small style={{ fontSize: '20px', marginRight: '5px' }}>
                                        Change =
                                    </small>
                                    <b> <label id='Total' style={{ fontSize: '25px', color: trxSlice.trxChange < 0 ? 'red' : 'green' }} >
                                        {(Math.round(trxSlice.trxChange * 100) / 100).toFixed(config.systemCurrency === 'NIS'  ?  2 : 3)}
                                    </label>
                                    </b>
                                    {
                                        terminal.paymentInput === 'numpad' && trxSlice.selectedCurrency !== 'NIS' &&
                                        <small style={{ fontSize: '15px', marginLeft: '5px' }}>
                                            ( {(Math.round(Math.abs(trxSlice.trxChange / terminal.exchangeRates[trxSlice.selectedCurrency]) * 100) / 100).toFixed(config.systemCurrency === 'NIS'  ?  2 : 3)} {trxSlice.selectedCurrency} )
                                        </small>
                                    }
                                </div>
                            </FlexboxGrid.Item>
                        </FlexboxGrid>
                    }
                    <br />
                    <div className="slide-container">
                        <ImageSlider config={config} />
                    </div>
                </div>
            </FlexboxGrid.Item>
        </FlexboxGrid >
    );
}

export default Terminal;