import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux'

import { Stack, FlexboxGrid, List, IconButton } from 'rsuite';
import classes from './Terminal.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp, faIls, faHandPointRight } from '@fortawesome/free-solid-svg-icons'
import Typography from '@mui/material/Typography';
import BarcodeReader from 'react-barcode-reader';
import { scanBarcode } from '../../store/trxSlice';

import axios from '../../axios';
import { resumeTrx, selectLine } from '../../store/trxSlice';
import { showLoading, hideLoading, notify } from '../../store/uiSlice';

const Invoice = (props) => {


    const terminal = useSelector((state) => state.terminal);
    const trxSlice = useSelector((state) => state.trx);

    const dispatch = useDispatch();

    useEffect(() => {
        return axios({
            method: 'post',
            url: '/trx/checkOpenTrx',
            data: {
                tillKey: terminal.till ? terminal.till.key : null
            }
        }).then((response) => {
            if (response && response.data) {
                dispatch(hideLoading());
                dispatch(notify('Resuming Open TRX...'));
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
        dispatch(scanBarcode({
            tillKey: terminal.till.key,
            trxKey: trxSlice.trx ? trxSlice.trx.key : null,
            barcode: scannedValue,
            multiplier: 1
        }))
    }

    const handleScanError = (err) => {
        console.error(err)
    }

    const handleItemClick = (obj) => {
        dispatch(selectLine(obj))
    }

    const isEven = (number) => number % 2 == 0;


    return (
        <React.Fragment>
            <BarcodeReader
                onError={handleScanError}
                onScan={handleScan}
            />

            <div style={{ background: '#303030', color: 'white', height: '5vh' }}>
                <h4 style={{ lineHeight: '5vh', paddingLeft: '5px' }}>
                    <small style={{ color: '#e1e1e1' }} >Transaction Mode - </small>{terminal.trxMode}
                </h4>
            </div>

            <List hover id='invoiceList' style={{ height: '74.5vh' }} autoScroll={false}>
                {trxSlice.scannedItems ? trxSlice.scannedItems.map((obj, i) => {
                    return <List.Item onClick={(e) => handleItemClick(obj)}
                        className={(isEven(i + 1) ? classes.EvenRow : classes.OddRow)}
                        key={obj.key} style={{ minHeight: '50px' }}>
                        <FlexboxGrid>
                            <FlexboxGrid.Item colspan={1}>

                            </FlexboxGrid.Item>
                            <FlexboxGrid.Item colspan={2}>
                                <Typography variant='subtitle1'>
                                    {obj.qty}
                                </Typography>
                            </FlexboxGrid.Item>
                            <FlexboxGrid.Item colspan={18}>
                                <Typography variant='subtitle1' className={(obj.key === trxSlice.selectedLine.key) ? classes.SelectedRow : null}>
                                    {(obj.key === trxSlice.selectedLine.key) ?
                                        <FontAwesomeIcon style={{marginRight: '5px'}} icon={faHandPointRight} />
                                        : null}
                                    {obj.description}
                                </Typography>
                            </FlexboxGrid.Item>
                            <FlexboxGrid.Item colspan={3}>
                                <Typography variant='subtitle1'>
                                    {obj.totalprice}
                                </Typography>
                            </FlexboxGrid.Item>
                        </FlexboxGrid>
                    </List.Item>
                }) : null
                }
            </List>


            <FlexboxGrid style={{ height: '10vh', color: 'white', background: '#404040', justifyContent: 'flex-end' }}>

                <FlexboxGrid.Item colspan={10} style={{ position: 'relative', top: '4vh', left: '20px' }}>
                    <Typography variant='subtitle1' fontSize={11}>
                        Items Count <b>{trxSlice.scannedItems ? trxSlice.scannedItems.length : 0}</b>
                    </Typography>
                    <label style={{ fontSize: '30px', marginRight: '7px' }}>
                        <b style={{ marginLeft: '3px' }}><FontAwesomeIcon icon={faIls} /> {trxSlice.trx ? trxSlice.trx.total : '-'}</b>
                    </label>

                </FlexboxGrid.Item>

                <FlexboxGrid.Item colspan={4} />

                <FlexboxGrid.Item colspan={10} >
                    <FlexboxGrid style={{ marginTop: '1vh', color: 'white', background: '#404040', justifyContent: 'flex-end' }}>
                        <FlexboxGrid.Item colspan={11} >
                            <IconButton onClick={scrollUp} icon={<FontAwesomeIcon size='2x' icon={faChevronUp} />} className={classes.ScrollButton} />
                        </FlexboxGrid.Item>
                        <FlexboxGrid.Item colspan={2} />
                        <FlexboxGrid.Item colspan={11} >
                            <IconButton onClick={scrollDown} icon={<FontAwesomeIcon size='2x' icon={faChevronDown} />} className={classes.ScrollButton} />
                        </FlexboxGrid.Item>
                    </FlexboxGrid>
                </FlexboxGrid.Item>
            </FlexboxGrid>
        </React.Fragment>
    );
}

export default Invoice;