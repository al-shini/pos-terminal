import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux'

import { FlexboxGrid, List, IconButton, Divider } from 'rsuite';
import classes from './Terminal.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'

import axios from '../../axios';
import { selectPayment, setUsedCoupons, uploadPayments } from '../../store/trxSlice';
import { notify } from '../../store/uiSlice';
import config from '../../config';


const Invoice = (props) => {


    const terminal = useSelector((state) => state.terminal);
    const trxSlice = useSelector((state) => state.trx);

    const dispatch = useDispatch();

    useEffect(() => {
        return axios({
            method: 'post',
            url: '/trx/loadTrxPayments',
            headers: {
                trxKey: trxSlice.trx ? trxSlice.trx.key : null
            }
        }).then((response) => {
            if (response && response.data) {

                dispatch(uploadPayments(response.data));

                if (response.data.payments) {
                    let usedCoupons = {};
                    response.data.payments.map((payment) => {
                        if (!payment.voided && payment.paymentMethodKey === 'CashBack') {
                            usedCoupons[payment.sourceKey] = true;
                        }
                    })
                    dispatch(setUsedCoupons(usedCoupons));
                }
            }
        }).catch((error) => {
            if (error.response) {
                if (error.response.status === 401) {
                    dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }))
                } else {

                    dispatch(notify({ msg: error.response.data, sev: 'error' }));
                }
            } else {
                dispatch(notify({ msg: error.message, sev: 'error' }));
            }

        });
    }, [])


    const scrollUp = () => {
        document.querySelector('#paymentList').scroll({
            top: document.querySelector('#paymentList').scrollTop - 100,
            behavior: 'smooth'
        });
    }

    const scrollDown = () => {
        document.querySelector('#paymentList').scroll({
            top: document.querySelector('#paymentList').scrollTop + 100,
            behavior: 'smooth'
        });
    }


    useEffect(() => {
        document.querySelector('#paymentList').scroll({
            top: document.querySelector('#paymentList').scrollHeight,
            behavior: 'smooth'
        });
    }, [trxSlice.payments])


    const handleItemClick = (obj) => {
        dispatch(selectPayment(obj))
    }

    const isEven = (number) => number % 2 === 0;


    return (
        <React.Fragment>

            <div style={{ background: '#303030', color: 'white', height: '5vh', width: '110%', right: '10px', position: 'relative' }}>
                <h4 id='paymentsHeader' style={{ lineHeight: '5vh', paddingLeft: '15px' }}>
                    {terminal.trxMode === 'Sale' && <span>Payments</span>}
                    {terminal.trxMode === 'Refund' && <span style={{ color: 'rgb(255 60 80)' }}>Payments (Refund)</span>}
                </h4>
            </div>

            <List hover id='paymentList' style={{ height: '79vh' }} autoScroll={false}>

                {
                    trxSlice.payments ? trxSlice.payments.map((obj, i) => {
                        return <List.Item onClick={(e) => handleItemClick(obj)}
                            className={(obj.key === trxSlice.selectedPayment.key) ? classes.SelectedRowBG : (isEven(i + 1) ? classes.EvenRow : classes.OddRow)}
                            key={obj.key} style={{ minHeight: '50px' }}>
                            <FlexboxGrid style={{ paddingLeft: '10px' }}>
                                <FlexboxGrid.Item colspan={1}>

                                </FlexboxGrid.Item>
                                <FlexboxGrid.Item colspan={5}>
                                    <b style={{
                                        fontSize: '20px',
                                        textDecoration: obj.voided ? 'line-through' : '',
                                        color: obj.voided ? '#db0000' : ''
                                    }}> {terminal.paymentMethods[obj.paymentMethodKey].description}</b>
                                </FlexboxGrid.Item>
                                <FlexboxGrid.Item colspan={5}>
                                    <b style={{
                                        fontSize: '20px',
                                        textDecoration: obj.voided ? 'line-through' : '',
                                        color: obj.voided ? '#db0000' : ''
                                    }}>{obj.currency}</b>
                                </FlexboxGrid.Item>
                                <FlexboxGrid.Item colspan={12}>
                                    <b style={{
                                        fontSize: '20px',
                                        textDecoration: obj.voided ? 'line-through' : '',
                                        color: obj.voided ? '#db0000' : ''
                                    }}>{obj.rate === 1 ? obj.amount : (obj.originalAmount + ' x ' + obj.rate + ' = ' + obj.amount)}</b>
                                </FlexboxGrid.Item>
                            </FlexboxGrid>
                        </List.Item>
                    }) : null
                }
            </List>
            <FlexboxGrid style={{
                height: '15.5vh', color: 'white', background: 'white', justifyContent: 'flex-end',
                borderBottom: '1px solid #e1e1e1',
                borderTop: '1px solid #e1e1e1',
                paddingBottom: 5
            }}>

                <FlexboxGrid.Item colspan={24} >
                    <span style={{ color: 'transparent', lineHeight: '1vh' }}>.</span>
                </FlexboxGrid.Item>

                <FlexboxGrid.Item colspan={10} >
                    <FlexboxGrid style={{ marginTop: '1vh', color: 'white' }}>
                        <FlexboxGrid.Item colspan={2} />
                        <FlexboxGrid.Item colspan={5} >
                            <IconButton onClick={scrollUp} icon={<FontAwesomeIcon size='2x' icon={faChevronUp} />} className={classes.ScrollButton} />
                        </FlexboxGrid.Item>
                        <FlexboxGrid.Item colspan={3} />
                        <FlexboxGrid.Item colspan={5} >
                            <IconButton onClick={scrollDown} icon={<FontAwesomeIcon size='2x' icon={faChevronDown} />} className={classes.ScrollButton} />
                        </FlexboxGrid.Item>
                    </FlexboxGrid>
                </FlexboxGrid.Item>

                <FlexboxGrid.Item colspan={14} >
                    <div style={{ fontSize: '18px', position: 'relative', top: '7px', textAlign: 'right', marginRight: '8px' }}>
                        <span style={{ color: '#000000', marginRight: '10px' }}>
                            {trxSlice.scannedItems ? trxSlice.scannedItems.length : 0}
                        </span>
                        <span style={{ color: 'grey' }}>
                            Item(s)
                        </span>
                    </div>
                    <div style={{ textAlign: 'right', marginRight: '10px' }}>
                        {/* <span style={{ color: 'grey', fontFamily: 'monospace' }}>
                            Tax:
                            <small id='NISSymbolTax'>₪</small>
                            <small id='TotalTax'>
                                {trxSlice.trx ? (Math.round((trxSlice.trx.totalafterdiscount - trxSlice.trx.totalAfterDiscountBeforeTax) * 100) / 100).toFixed(config.systemCurrency === 'NIS'  ?  2 : 3) : '0.00'}
                            </small>
                        </span>

                        <Divider vertical /> */}
                        <small id='NISSymbol'>₪</small>
                        <label id='Total'>
                            {trxSlice.trx ? (Math.round(trxSlice.trx.totalafterdiscount * 100) / 100).toFixed(config.systemCurrency === 'NIS'  ?  2 : 3) : '0.00'}
                        </label>
                    </div>

                </FlexboxGrid.Item>
            </FlexboxGrid>
        </React.Fragment>
    );
}

export default Invoice;