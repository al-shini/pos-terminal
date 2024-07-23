import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FlexboxGrid, IconButton, Divider } from 'rsuite';
import { FixedSizeList as List } from 'react-window';
import classes from './Terminal.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp, faGift, faTag, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import Typography from '@mui/material/Typography';
import BarcodeReader from 'react-barcode-reader';
import { scanBarcode, scanNewTransaction, scrollUp, scrollDown, resetScrollAction, selectLine, scrollBottom } from '../../store/trxSlice';

const InvoiceItem = React.memo(({ index, style, data }) => {
    const { items, handleItemClick, selectedLine, terminal } = data;
    const obj = items[index];
    const isEven = (number) => number % 2 === 0;

    return (
        <div
            onClick={() => handleItemClick(obj)}
            className={(obj.key === selectedLine.key) ? classes.SelectedRowBG : (isEven(index + 1) ? classes.EvenRow : classes.OddRow)}
            style={{ ...style, minHeight: '50px', paddingTop: 10 }}
        >
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
                        className={(obj.key === selectedLine.key) ? classes.SelectedRow : null}>
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
        </div>
    );
});

const Invoice = (props) => {
    const terminal = useSelector((state) => state.terminal);
    const trxSlice = useSelector((state) => state.trx);
    const dispatch = useDispatch();
    const listRef = useRef();

    useEffect(() => {
        console.log(trxSlice.scrollAction);
        if (trxSlice.scrollAction === 'up' && listRef.current) {
            const currentScrollOffset = listRef.current.state.scrollOffset;
            listRef.current.scrollTo(currentScrollOffset - 100);
            dispatch(resetScrollAction());
        } else if (trxSlice.scrollAction === 'down' && listRef.current) {
            const currentScrollOffset = listRef.current.state.scrollOffset;
            listRef.current.scrollTo(currentScrollOffset + 100);
            dispatch(resetScrollAction());
        } else if (trxSlice.scrollAction === 'bottom' && listRef.current) {
            listRef.current.scrollToItem(trxSlice.scannedItems ? trxSlice.scannedItems.length - 1 : 0, 'end');
            dispatch(resetScrollAction());
        }
    }, [trxSlice.scrollAction]);

    const handleScan = (scannedValue) => {
        console.log(scannedValue);
        if (!terminal.paymentMode) {
            if (trxSlice.trx && trxSlice.trx.key) {
                dispatch(scanBarcode({
                    customerKey: terminal.customer ? terminal.customer.key : null,
                    barcode: scannedValue,
                    trxKey: trxSlice.trx ? trxSlice.trx.key : null,
                    trxMode: terminal.trxMode,
                    tillKey: terminal.till ? terminal.till.key : null,
                    multiplier: trxSlice.multiplier ? trxSlice.multiplier : '1'
                }));
            } else {
                dispatch(scanNewTransaction({
                    customerKey: terminal.customer ? terminal.customer.key : null,
                    barcode: scannedValue,
                    trxKey: null,
                    trxMode: terminal.trxMode,
                    tillKey: terminal.till ? terminal.till.key : null,
                    multiplier: trxSlice.multiplier ? trxSlice.multiplier : '1'
                }));
            }
        }
    };

    useEffect(() => {
        // dispatch(scrollBottom())
        listRef.current.scrollToItem(trxSlice.scannedItems ? trxSlice.scannedItems.length - 1 : 0, 'end');
        dispatch(resetScrollAction());
    }, [trxSlice.scannedItems]);

    const handleScanError = (err) => {
        console.error(err)
        if(err && err.startsWith('C-')){
            // custoemr barcode
            handleScan(err);
        }
    };

    const handleItemClick = (obj) => {
        dispatch(selectLine(obj));
    };

    const data = {
        items: trxSlice.scannedItems ? trxSlice.scannedItems : [],
        handleItemClick,
        selectedLine: trxSlice.selectedLine,
        terminal,
    };

    return (
        <React.Fragment>
            {!terminal.paymentMode && <BarcodeReader onError={handleScanError} onScan={handleScan} />}
            <div style={{ background: '#303030', color: 'white', height: '5vh', width: '110%', right: '10px', position: 'relative' }}>
                <h4 id='trxModeHeader' style={{ lineHeight: '5vh', paddingLeft: '15px' }}>
                    {terminal.trxMode === 'Sale' && <span>{terminal.trxMode}</span>}
                    {terminal.trxMode === 'Refund' && <span style={{ color: 'rgb(255 60 80)' }}>{terminal.trxMode}</span>}
                </h4>
            </div>

            <List 
                height={580}
                itemCount={trxSlice.scannedItems ? trxSlice.scannedItems.length : 0}
                itemSize={85}
                width={'100%'}
                itemData={data}
                ref={listRef}
                className="hide-scrollbar"
            >
                {InvoiceItem}
            </List>

            <FlexboxGrid style={{ height: '15.5vh', color: 'white', background: 'white', justifyContent: 'flex-end', 
            borderBottom: '1px solid #e1e1e1',
            borderTop: '1px solid #e1e1e1' }}>
                <FlexboxGrid.Item colspan={24}>
                    <span style={{ color: 'transparent', lineHeight: '1vh' }}>.</span>
                </FlexboxGrid.Item>
                <FlexboxGrid.Item colspan={10}>
                    <FlexboxGrid style={{ marginTop: '1vh', color: 'white' }}>
                        <FlexboxGrid.Item colspan={2} />
                        <FlexboxGrid.Item colspan={5}>
                            <IconButton onClick={() => dispatch(scrollUp())} icon={<FontAwesomeIcon size='2x' icon={faChevronUp} />} className={classes.ScrollButton} />
                        </FlexboxGrid.Item>
                        <FlexboxGrid.Item colspan={3} />
                        <FlexboxGrid.Item colspan={5}>
                            <IconButton onClick={() => dispatch(scrollDown())} icon={<FontAwesomeIcon size='2x' icon={faChevronDown} />} className={classes.ScrollButton} />
                        </FlexboxGrid.Item>
                    </FlexboxGrid>
                </FlexboxGrid.Item>
                <FlexboxGrid.Item colspan={14}>
                    <div style={{ fontSize: '22px', position: 'relative', top: '7px', textAlign: 'right', marginRight: '8px' }}>
                        <span style={{ color: '#000000', marginRight: '10px', fontFamily: 'monospace' }}>
                            {trxSlice.scannedItems ? trxSlice.scannedItems.length : 0}
                        </span>
                        <span style={{ color: 'grey', fontFamily: 'monospace' }}>
                            Item(s)
                        </span>
                    </div>
                    <div style={{ textAlign: 'right', marginRight: '10px' }}>
                        <small id='NISSymbol'>₪</small>
                        <label id='Total'>
                            {trxSlice.trx ? (Math.round(trxSlice.trx.totalafterdiscount * 100) / 100).toFixed(2) : '0.00'}
                        </label>
                    </div>
                </FlexboxGrid.Item>
            </FlexboxGrid>
        </React.Fragment>
    );
}

export default Invoice;
