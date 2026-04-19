import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux'

import { FlexboxGrid, List, IconButton, Divider } from 'rsuite';
import classes from './Terminal.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChevronDown, faChevronUp, faMoneyBill, faCreditCard, faStar,
    faMobileScreenButton, faMotorcycle, faBan, faReceipt, faCoins
} from '@fortawesome/free-solid-svg-icons'

import axios from '../../axios';
import { selectPayment, setUsedCoupons, uploadPayments } from '../../store/trxSlice';
import { notify } from '../../store/uiSlice';
import config from '../../config';

const getPaymentMethodVisual = (key, description) => {
    const k = (key || '').toLowerCase();
    const d = (description || '').toLowerCase();

    if (k === 'cash' || d.includes('cash') && !d.includes('back')) {
        return { icon: faMoneyBill, bg: 'linear-gradient(135deg, #22C55E 0%, #15803D 100%)', ring: 'rgba(34, 197, 94, 0.25)' };
    }
    if (k === 'cashback' || d.includes('cashback') || d.includes('cash back')) {
        return { icon: faStar, bg: 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)', ring: 'rgba(245, 158, 11, 0.28)' };
    }
    if (d.includes('talabat')) {
        return { icon: faMotorcycle, bg: 'linear-gradient(135deg, #F97316 0%, #C2410C 100%)', ring: 'rgba(249, 115, 22, 0.28)' };
    }
    if (d.includes('mobi') || d.includes('wallet')) {
        return { icon: faMobileScreenButton, bg: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)', ring: 'rgba(139, 92, 246, 0.28)' };
    }
    if (d.includes('coupon') || d.includes('voucher')) {
        return { icon: faCoins, bg: 'linear-gradient(135deg, #F43F5E 0%, #BE123C 100%)', ring: 'rgba(244, 63, 94, 0.28)' };
    }
    if (d.includes('card') || d.includes('visa') || d.includes('master') || d.includes('credit') || d.includes('debit')) {
        return { icon: faCreditCard, bg: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', ring: 'rgba(59, 130, 246, 0.28)' };
    }
    return { icon: faReceipt, bg: 'linear-gradient(135deg, #64748B 0%, #334155 100%)', ring: 'rgba(100, 116, 139, 0.25)' };
};


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
                        if (!payment.voided && payment.paymentMethodKey === 'Cashback') {
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

            <div style={{
                background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
                color: 'white',
                height: '5vh',
                width: '110%',
                right: '10px',
                position: 'relative',
                borderLeft: terminal.trxMode === 'Refund' ? '4px solid #EF4444' : '4px solid #22C55E',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '16px',
                boxShadow: '0 2px 6px rgba(17, 24, 39, 0.12)'
            }}>
                <h4 id='paymentsHeader' style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: 700,
                    letterSpacing: '1.2px',
                    textTransform: 'uppercase',
                    fontFamily: '"Inter", "Segoe UI", sans-serif',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: terminal.trxMode === 'Refund' ? '#EF4444' : '#22C55E',
                        boxShadow: terminal.trxMode === 'Refund'
                            ? '0 0 10px rgba(239, 68, 68, 0.6)'
                            : '0 0 10px rgba(34, 197, 94, 0.6)'
                    }} />
                    {terminal.trxMode === 'Sale' && <span>Payments</span>}
                    {terminal.trxMode === 'Refund' && <span style={{ color: '#FCA5A5' }}>Payments (Refund)</span>}
                </h4>
            </div>

            <List hover id='paymentList' style={{ height: '79vh' }} autoScroll={false}>

                {
                    trxSlice.payments ? trxSlice.payments.map((obj, i) => {
                        const method = terminal.paymentMethods[obj.paymentMethodKey];
                        const visual = getPaymentMethodVisual(obj.paymentMethodKey, method ? method.description : '');
                        const isSelected = obj.key === trxSlice.selectedPayment.key;
                        const isVoided = obj.voided;
                        const hasConversion = obj.rate !== 1;
                        const baseClass = isSelected
                            ? classes.SelectedRowBG
                            : (isEven(i + 1) ? classes.EvenRow : classes.OddRow);
                        return (
                            <List.Item
                                onClick={(e) => handleItemClick(obj)}
                                className={`${baseClass} ${isVoided ? classes.PaymentRowVoided : ''}`}
                                key={obj.key}
                                style={{ padding: 0 }}
                            >
                                <div className={classes.PaymentRow}>
                                    <div
                                        className={classes.PaymentIcon}
                                        style={{
                                            background: isVoided
                                                ? 'linear-gradient(135deg, #CBD5E1 0%, #94A3B8 100%)'
                                                : visual.bg,
                                            boxShadow: isVoided
                                                ? '0 0 0 3px rgba(148, 163, 184, 0.18)'
                                                : `0 0 0 3px ${visual.ring}`
                                        }}
                                    >
                                        <FontAwesomeIcon icon={isVoided ? faBan : visual.icon} />
                                    </div>

                                    <div className={classes.PaymentBody}>
                                        <div className={classes.PaymentTopRow}>
                                            <span className={`${classes.PaymentMethod} ${isVoided ? classes.PaymentTextMuted : ''}`}>
                                                {method ? method.description : obj.paymentMethodKey}
                                            </span>
                                            <span className={`${classes.PaymentCurrencyChip} ${isVoided ? classes.PaymentCurrencyChipMuted : ''}`}>
                                                {obj.currency}
                                            </span>
                                            {isVoided && (
                                                <span className={classes.PaymentVoidedBadge}>
                                                    <FontAwesomeIcon icon={faBan} style={{ fontSize: 10 }} />
                                                    VOIDED
                                                </span>
                                            )}
                                        </div>
                                        {hasConversion && (
                                            <div className={`${classes.PaymentConversion} ${isVoided ? classes.PaymentTextMuted : ''}`}>
                                                <span className={classes.PaymentConversionNum}>{obj.originalAmount}</span>
                                                <span className={classes.PaymentConversionOp}>×</span>
                                                <span className={classes.PaymentConversionNum}>{obj.rate}</span>
                                                <span className={classes.PaymentConversionOp}>=</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className={`${classes.PaymentAmount} ${isVoided ? classes.PaymentAmountVoided : ''}`}>
                                        {obj.amount}
                                    </div>
                                </div>
                            </List.Item>
                        );
                    }) : null
                }
            </List>
            <FlexboxGrid style={{
                height: '15.5vh',
                background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
                justifyContent: 'flex-end',
                borderTop: '1px solid #E5E7EB',
                borderBottom: '1px solid #E5E7EB',
                paddingBottom: 5
            }}>

                <FlexboxGrid.Item colspan={24} >
                    <span style={{ color: 'transparent', lineHeight: '1vh' }}>.</span>
                </FlexboxGrid.Item>

                <FlexboxGrid.Item colspan={10} >
                    <FlexboxGrid style={{ marginTop: '1vh' }}>
                        <FlexboxGrid.Item colspan={2} />
                        <FlexboxGrid.Item colspan={5} >
                            <IconButton onClick={scrollUp} icon={<FontAwesomeIcon size='lg' icon={faChevronUp} />} className={classes.ScrollButton} />
                        </FlexboxGrid.Item>
                        <FlexboxGrid.Item colspan={3} />
                        <FlexboxGrid.Item colspan={5} >
                            <IconButton onClick={scrollDown} icon={<FontAwesomeIcon size='lg' icon={faChevronDown} />} className={classes.ScrollButton} />
                        </FlexboxGrid.Item>
                    </FlexboxGrid>
                </FlexboxGrid.Item>

                <FlexboxGrid.Item colspan={14} >
                    <div style={{ textAlign: 'right', marginRight: '14px', marginTop: '8px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'baseline',
                            gap: '4px',
                            background: '#F1F5F9',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            border: '1px solid #E5E7EB',
                            fontSize: '12px',
                            color: '#6B7280',
                            fontWeight: 600,
                            letterSpacing: '0.3px',
                            textTransform: 'uppercase'
                        }}>
                            <b style={{ color: '#111827', fontSize: '14px', fontFamily: '"DSDIGI", monospace' }}>
                                {trxSlice.scannedItems ? trxSlice.scannedItems.length : 0}
                            </b>
                            Items
                        </span>
                        {trxSlice.trx && trxSlice.trx.totalcashbackamt > 0 && (
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: '#2563EB',
                                fontSize: '12px',
                                fontWeight: 600,
                                background: 'rgba(37, 99, 235, 0.08)',
                                padding: '4px 10px',
                                borderRadius: '999px',
                                border: '1px solid rgba(37, 99, 235, 0.18)'
                            }}>
                                Cashback&nbsp;
                                <b style={{ fontFamily: '"DSDIGI", monospace', fontSize: '13px' }}>
                                    {((trxSlice.trx.totalcashbackamt * 100) / 100).toFixed(config.systemCurrency === 'NIS' ? 2 : 3)}
                                </b>
                            </span>
                        )}
                    </div>
                    <div style={{ textAlign: 'right', marginRight: '14px', marginTop: '4px' }}>
                        <small id='NISSymbol' style={{
                            fontSize: '16px',
                            color: '#6B7280',
                            fontWeight: 700,
                            marginRight: '6px',
                            letterSpacing: '0.5px'
                        }}>JD</small>
                        <label id='Total' style={{
                            color: '#111827',
                            fontSize: '36px',
                            fontWeight: 800,
                            fontFamily: '"DSDIGI", monospace',
                            lineHeight: 1
                        }}>
                            {trxSlice.trx ? (Math.round(trxSlice.trx.totalafterdiscount * 100) / 100).toFixed(config.systemCurrency === 'NIS' ? 2 : 3) : '0.00'}
                        </label>
                    </div>

                </FlexboxGrid.Item>
            </FlexboxGrid>
        </React.Fragment>
    );
}

export default Invoice;