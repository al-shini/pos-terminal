import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux'

import { Stack, FlexboxGrid, List, IconButton, Divider } from 'rsuite';
import classes from './Terminal.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp, faIls, faHandPointRight, faFaceSmileBeam } from '@fortawesome/free-solid-svg-icons'
import Typography from '@mui/material/Typography';
import BarcodeReader from 'react-barcode-reader';
import { scanBarcode } from '../../store/trxSlice';

import axios from '../../axios';
import { resumeTrx, selectLine } from '../../store/trxSlice';
import { showLoading, hideLoading, notify } from '../../store/uiSlice';
import { textAlign } from '@mui/system';

const Invoice = (props) => {


    const terminal = useSelector((state) => state.terminal);
    const trxSlice = useSelector((state) => state.trx);

    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(showLoading());
        return axios({
            method: 'post',
            url: '/trx/checkOpenTrx',
            data: {
                tillKey: terminal.till ? terminal.till.key : null
            }
        }).then((response) => {
            if (response && response.data) {
                dispatch(hideLoading());
                dispatch(resumeTrx(response.data));
            }
        }).catch((error) => {
            if (error.response) {
                if (error.response.status === 401) {
                    dispatch(hideLoading());
                    dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                }
            } else {
                dispatch(hideLoading());
                dispatch(notify({ msg: error.message, sev: 'error' }));
            }

        });
    }, [])

    const scrollUp = () => {
        document.querySelector('#invoiceList').scroll({
            top: document.querySelector('#invoiceList').scrollTop - 100,
            behavior: 'smooth'
        });
    }

    const scrollDown = () => {
        document.querySelector('#invoiceList').scroll({
            top: document.querySelector('#invoiceList').scrollTop + 100,
            behavior: 'smooth'
        });
    }

    const handleScan = (scannedValue) => {
        if (!terminal.paymentMode) {

            dispatch(scanBarcode({
                tillKey: terminal.till.key,
                trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                barcode: scannedValue,
                multiplier: trxSlice.multiplier ? trxSlice.multiplier : '1'
            }))
        }
    }

    useEffect(() => {
        document.querySelector('#invoiceList').scroll({
            top: document.querySelector('#invoiceList').scrollHeight,
            behavior: 'smooth'
        });
    }, [trxSlice.scannedItems])

    const handleScanError = (err) => {
        // console.error(err)
    }

    const handleItemClick = (obj) => {
        dispatch(selectLine(obj))
    }

    const isEven = (number) => number % 2 == 0;


    return (
        <React.Fragment>
            {!terminal.paymentMode && <BarcodeReader
                onError={handleScanError}
                onScan={handleScan}
            />}

            <div style={{ background: '#303030', color: 'white', height: '5vh', width: '110%', right: '10px', position: 'relative' }}>
                <h4 style={{ lineHeight: '5vh', paddingLeft: '15px' }}>
                    {terminal.trxMode}
                </h4>
            </div>


            <List hover id='invoiceList' style={{ height: '67vh' }} autoScroll={false}>
                {trxSlice.scannedItems ? trxSlice.scannedItems.map((obj, i) => {
                    return <List.Item onClick={(e) => handleItemClick(obj)}
                        className={(obj.key === trxSlice.selectedLine.key) ? classes.SelectedRowBG : (isEven(i + 1) ? classes.EvenRow : classes.OddRow)}
                        key={obj.key} style={{ minHeight: '50px' }}>
                        <FlexboxGrid style={{ paddingLeft: '10px' }}>
                            <FlexboxGrid.Item colspan={1}>

                            </FlexboxGrid.Item>
                            <FlexboxGrid.Item colspan={2}>
                                <Typography variant='subtitle1'>
                                    {obj.qty}
                                </Typography>
                            </FlexboxGrid.Item>
                            <FlexboxGrid.Item colspan={18}>
                                <span className={(obj.key === trxSlice.selectedLine.key) ? classes.SelectedRow : null}>
                                    {(obj.key === trxSlice.selectedLine.key) ?
                                        <FontAwesomeIcon style={{ marginRight: '5px' }} icon={faHandPointRight} />
                                        : null}
                                    {obj.description}
                                </span>
                            </FlexboxGrid.Item>
                            <FlexboxGrid.Item colspan={3}>
                                <Typography variant='subtitle1'>
                                    {(Math.round((obj.totalprice) * 100) / 100).toFixed(2)}
                                </Typography>
                            </FlexboxGrid.Item>

                            <FlexboxGrid.Item colspan={1}>
                            </FlexboxGrid.Item>
                            <FlexboxGrid.Item colspan={20}>
                                {(obj.finalprice < obj.totalprice) &&
                                    <span style={{ color: 'rgb(225,42,42)', position: 'relative', fontSize: '16px', top: '5px' }}>
                                        <FontAwesomeIcon icon={faFaceSmileBeam} style={{ marginRight: '7px' }} />
                                        Promo
                                    </span>
                                }
                            </FlexboxGrid.Item>
                            <FlexboxGrid.Item colspan={3}>
                                <Typography variant='subtitle1'>
                                    {(obj.finalprice < obj.totalprice) &&
                                        <span style={{ color: 'rgb(225,42,42)' }}>
                                            {/* {(Math.round((obj.finalprice - obj.totalprice) * 100) / 100).toFixed(2)} */}
                                            {(Math.round((obj.finalprice) * 100) / 100).toFixed(2)}
                                        </span>
                                    }

                                </Typography>
                            </FlexboxGrid.Item>
                        </FlexboxGrid>
                    </List.Item>
                }) : null
                }
            </List>
            <FlexboxGrid style={{ height: '15.5vh', color: 'white', background: '#e1e1e1', justifyContent: 'flex-end', }}>
                <FlexboxGrid.Item colspan={24} >
                    <span style={{color: 'transparent', lineHeight: '1vh'}}>.</span>
                </FlexboxGrid.Item>
                <FlexboxGrid.Item colspan={10} >
                    <FlexboxGrid style={{ marginTop: '1vh', color: 'white', background: '#e1e1e1' }}>
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
                <FlexboxGrid.Item colspan={2} >
                </FlexboxGrid.Item>

                <FlexboxGrid.Item colspan={12} >
                    <div style={{ fontSize: '18px', position: 'relative', top: '7px', textAlign: 'right', marginRight: '8px' }}>
                        <span style={{ color: '#000000', marginRight: '10px' }}>
                            {trxSlice.scannedItems ? trxSlice.scannedItems.length : 0}
                        </span>
                        <span style={{ color: 'grey' }}>
                            Item(s) 
                        </span>
                    </div>
                    <div style={{ textAlign: 'right', marginRight: '10px' }}>
                        <small id='NISSymbol'>
                            ₪
                        </small>
                        <label id='Total' >
                            {trxSlice.trx ? (Math.round(trxSlice.trx.totalafterdiscount * 100) / 100).toFixed(2) : '0.00'}
                        </label>
                    </div>

                </FlexboxGrid.Item>
            </FlexboxGrid>
        </React.Fragment>
    );
}

export default Invoice;