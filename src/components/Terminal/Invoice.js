import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux'
import { FlexboxGrid, List, IconButton, Divider } from 'rsuite';
import classes from './Terminal.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp, faGift, faFaceSmileBeam, faTag, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import Typography from '@mui/material/Typography';
import BarcodeReader from 'react-barcode-reader';
import { scanBarcode, scanNewTransaction } from '../../store/trxSlice';

import { selectLine } from '../../store/trxSlice';
import terminalSlice from '../../store/terminalSlice';
import BARCODE_SCAN from '../../assets/barcode-scan.gif';

const Invoice = (props) => {

    const terminal = useSelector((state) => state.terminal);
    const trxSlice = useSelector((state) => state.trx);

    const dispatch = useDispatch();


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
            if (trxSlice.trx && trxSlice.trx.key) {
                dispatch(scanBarcode({
                    customerKey: terminal.customer ? terminal.customer.key : null,
                    barcode: scannedValue,
                    trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                    trxMode: terminal.trxMode,
                    tillKey: terminal.till ? terminal.till.key : null,
                    multiplier: trxSlice.multiplier ? trxSlice.multiplier : '1'
                }))
            } else {

                dispatch(scanNewTransaction({
                    customerKey: terminal.customer ? terminal.customer.key : null,
                    barcode: scannedValue,
                    trxKey: null,
                    trxMode: terminal.trxMode,
                    tillKey: terminal.till ? terminal.till.key : null,
                    multiplier: trxSlice.multiplier ? trxSlice.multiplier : '1'
                }))
            }
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

    const isEven = (number) => number % 2 === 0;


    return (
        <React.Fragment>
            {!terminal.paymentMode && <BarcodeReader
                onError={handleScanError}
                onScan={handleScan}
            />}

            <div style={{ background: '#303030', color: 'white', height: '5vh', width: '110%', right: '10px', position: 'relative' }}>
                <h4 id='trxModeHeader' style={{ lineHeight: '5vh', paddingLeft: '15px' }}>
                    {terminal.trxMode === 'Sale' && <span>{terminal.trxMode}</span>}
                    {terminal.trxMode === 'Refund' && <span style={{ color: 'rgb(255 60 80)' }}>{terminal.trxMode}</span>}

                    {trxSlice.trx ? <Divider vertical /> : null}
                    {trxSlice.trx ? <span>{trxSlice.trx.nanoId}</span> : null}
                </h4>
            </div>

            <List hover id='invoiceList' style={{ height: '67vh' }} autoScroll={false}>
                {trxSlice.scannedItems ? trxSlice.scannedItems.map((obj, i) => {
                    return <List.Item onClick={(e) => handleItemClick(obj)}
                        className={(obj.key === trxSlice.selectedLine.key) ? classes.SelectedRowBG : (isEven(i + 1) ? classes.EvenRow : classes.OddRow)}
                        key={obj.key} style={{ minHeight: '50px' }}>
                        <FlexboxGrid style={{ paddingLeft: '10px' }}>

                            {/* First row */}
                            <FlexboxGrid.Item colspan={3}>
                                <Typography variant='subtitle1'>
                                    <span
                                        style={{
                                            textDecoration: obj.voided ? 'line-through' : '',
                                            color: obj.voided ? '#db0000' : '',
                                            fontSize: '18px',
                                            marginLeft: '5px',
                                            fontFamily: 'DSDIGI'
                                        }}>
                                        x <b>{obj.qty}</b>
                                    </span>
                                </Typography>
                            </FlexboxGrid.Item>
                            <FlexboxGrid.Item colspan={16}>
                                <span
                                    style={{
                                        textDecoration: obj.voided ? 'line-through' : '',
                                        color: obj.voided ? '#db0000' : '',
                                        fontSize: '18px',
                                        fontFamily: 'Janna'
                                    }}
                                    className={(obj.key === trxSlice.selectedLine.key) ? classes.SelectedRow : null}>
                                    {obj.description}
                                </span>
                            </FlexboxGrid.Item>
                            <FlexboxGrid.Item colspan={5}>
                                <Typography variant='subtitle1'>
                                    <span
                                        style={{
                                            textDecoration: obj.voided ? 'line-through' : (obj.finalprice !== obj.totalprice) ? 'line-through' : '',
                                            color: obj.voided ? '#db0000' : '',
                                            fontSize: '20px',
                                            fontFamily: 'DSDIGI'
                                        }}>
                                        <b>₪ {(Math.round((obj.totalprice) * 100) / 100).toFixed(2)}</b>
                                    </span>
                                </Typography>
                            </FlexboxGrid.Item>

                            {/* Promotion row */}

                            <FlexboxGrid.Item colspan={3} />
                            <FlexboxGrid.Item colspan={16}>
                                {(obj.finalprice !== obj.totalprice) &&
                                    <span style={{ color: 'rgb(225,42,42)', position: 'relative', fontSize: '18px', top: '5px', display: 'inline-block' }}>
                                        <FontAwesomeIcon icon={faTag} style={{ marginRight: '7px' }} />
                                        <b>عرض</b>
                                    </span>
                                }
                                {(obj.finalprice !== obj.totalprice) && obj.priceOverride &&
                                    <span style={{ color: '#fa8900', position: 'relative', fontSize: '18px', top: '5px', display: 'inline-block' }}>
                                        <FontAwesomeIcon icon={faExclamationTriangle} style={{ marginLeft: '12px', marginRight: '7px' }} />
                                        <b>خصم يدوي</b>
                                    </span>
                                }
                            </FlexboxGrid.Item>
                            <FlexboxGrid.Item colspan={5}>
                                <Typography variant='subtitle1'>
                                    {(obj.finalprice !== obj.totalprice) &&
                                        <span
                                            style={{
                                                textDecoration: obj.voided ? 'line-through' : '',
                                                color: obj.voided ? '#db0000' : 'rgb(225,42,42)',
                                                fontSize: '20px',
                                                fontFamily: 'DSDIGI'
                                            }}>
                                            <b>₪ {(Math.round((obj.finalprice) * 100) / 100).toFixed(2)}</b>
                                        </span>
                                    }
                                </Typography>
                            </FlexboxGrid.Item>

                            {/* Cashback row */}
                            <FlexboxGrid.Item colspan={3} />
                            <FlexboxGrid.Item colspan={16}>
                                {(obj.cashBackAmt > 0 && terminal.customer && terminal.customer.club) &&
                                    <span style={{ color: 'rgb(96 44 181)', position: 'relative', fontSize: '18px', top: '5px' }}>
                                        <FontAwesomeIcon icon={faGift} style={{ marginRight: '7px' }} />
                                        <b>كاش باك</b>
                                    </span>
                                }
                            </FlexboxGrid.Item>
                            <FlexboxGrid.Item colspan={5}>
                                <Typography variant='subtitle1'>
                                    {(obj.cashBackAmt > 0 && terminal.customer && terminal.customer.club) &&
                                        <span
                                            style={{
                                                textDecoration: obj.voided ? 'line-through' : '',
                                                color: obj.voided ? '#db0000' : 'rgb(96 44 181)',
                                                fontSize: '20px',
                                                fontFamily: 'DSDIGI'
                                            }}>
                                            <b>₪ {(Math.round((obj.cashBackAmt) * 100) / 100).toFixed(2)}</b>
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
                    <span style={{ color: 'transparent', lineHeight: '1vh' }}>.</span>
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
                    <div style={{ fontSize: '22px', position: 'relative', top: '7px', textAlign: 'right', marginRight: '8px' }}>
                        <span style={{ color: '#000000', marginRight: '10px', fontFamily: 'monospace' }}>
                            {trxSlice.scannedItems ? trxSlice.scannedItems.length : 0}
                        </span>
                        <span style={{ color: 'grey', fontFamily: 'monospace' }}>
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