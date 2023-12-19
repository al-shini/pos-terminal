import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux'
import axios from '../../axios';
import classes from './Admin.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDay, faLock, faLockOpen, faCashRegister, faHourglassEnd, faBan, faSackDollar, faHandHoldingDollar, faPause } from '@fortawesome/free-solid-svg-icons'
import FlexboxGridItem from 'rsuite/esm/FlexboxGrid/FlexboxGridItem';
import Divider from 'rsuite/esm/Divider';
import { Panel, FlexboxGrid, Button } from 'rsuite';
import { notify } from '../../store/uiSlice';
import { setWorkDay, endDay } from '../../store/backofficeSlice';
import confirm from '../../components/UI/ConfirmDlg';

const WorkDaySetup = (props) => {
    const dispatch = useDispatch();

    const backofficeSlice = useSelector((state) => state.backoffice);
    const terminalSlice = useSelector((state) => state.terminal);


    const loadOpenWorkDay = () => {
        if (terminalSlice.store) {
            axios({
                method: 'post',
                url: '/bo/checkOpenWorkday',
                headers: {
                    storeKey: terminalSlice.store.key
                }
            }).then((response) => {
                if (response && response.data) {
                    dispatch(setWorkDay(response.data));
                    window.setTimeout(loadOpenWorkDay.workDay, 60000);
                } else {
                    dispatch(notify({ msg: 'Incorrect server response', sev: 'error' }));
                }
            }).catch((error) => {
                if (error.response) {
                    if (error.response.status === 401) {
                        dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                    } else if (error.response.status === 404) {
                        dispatch(notify({ msg: 'No Open Work Day For Store', sev: 'warning' }));
                    }
                    else {
                        dispatch(notify({ msg: 'error: ' + error.response.data, sev: 'error' }));
                    }
                } else {
                    dispatch(notify({ msg: 'error: ' + error.message, sev: 'error' }));
                }
            });
        }
    }

    useEffect(() => {
        loadOpenWorkDay();
    }, []);

    const handleCloseDay = () => {
        confirm('End Day?', 'Are you sure you want to close day ' + backofficeSlice.workDay.description, () => {
            dispatch(endDay());
        })
    }

    return (
        <FlexboxGrid style={{ padding: '10px' }}>
            <FlexboxGridItem colspan={24}>
                <h4 style={{ borderBottom: '1px solid #e1e1e1', paddingBottom: '5px' }}>
                    <FontAwesomeIcon icon={faCalendarDay} />
                    <Divider vertical />
                    Work Day Setup
                </h4>
            </FlexboxGridItem>
            <FlexboxGridItem colspan={5} style={{ marginRight: '10px' }}>
                <br />
                {backofficeSlice.workDay && backofficeSlice.workDay.businessDate &&
                    <Panel bordered header="Work Day Header" >
                        <label className={classes.Label}>Business Date: </label>
                        <span className={classes.Value}>{backofficeSlice.workDay.businessDateAsString}</span>
                        <Divider />
                        <label className={classes.Label}>Description: </label>
                        <span className={classes.Value}>{backofficeSlice.workDay.description}</span>
                        <Divider />
                        <Button appearance='primary' color='red' style={{ fontSize: '25px', padding: '15px', width: '100%' }}
                            onClick={handleCloseDay} disabled={backofficeSlice.workDay.openTills > 0} >
                            <FontAwesomeIcon icon={faHourglassEnd} style={{ marginRight: '6px' }} />
                            End Day
                        </Button>

                    </Panel>}
            </FlexboxGridItem>
            <FlexboxGridItem colspan={6} style={{ marginRight: '10px' }}>
                <br />
                {backofficeSlice.workDay && backofficeSlice.workDay.businessDate &&
                    <Panel bordered header="Till Summary" >
                        <label className={classes.Label}><FontAwesomeIcon icon={faCashRegister} style={{ marginRight: '6px' }} /> Total Tills: </label>
                        <span className={classes.Value}>{backofficeSlice.workDay.totalTills}</span>
                        <Divider />
                        <label className={classes.Label}><FontAwesomeIcon icon={faLockOpen} style={{ marginRight: '6px' }} /> Open Tills: </label>
                        <span className={classes.Value}>{backofficeSlice.workDay.openTills}</span>
                        <Divider />
                        <label className={classes.Label}><FontAwesomeIcon icon={faLock} style={{ marginRight: '6px' }} /> Closed Tills: </label>
                        <span className={classes.Value}>{backofficeSlice.workDay.closedTills}</span>
                    </Panel>}
            </FlexboxGridItem>
            <FlexboxGridItem colspan={6} style={{ marginRight: '10px' }}>
                <br />
                {backofficeSlice.workDay && backofficeSlice.workDay.businessDate &&
                    <Panel bordered header="Sales / Refund Summary" >
                        <label className={classes.Label}><FontAwesomeIcon icon={faSackDollar} style={{ marginRight: '6px' }} />  Sale Trx Count: </label>
                        <span className={classes.Value}>{backofficeSlice.workDay.currentSaleTrxCount}</span>
                        <Divider />
                        {/* <label className={classes.Label}><FontAwesomeIcon icon={faSackDollar} style={{ marginRight: '6px' }} />  Sales Amount: </label>
                        <span className={classes.Value}>₪ {backofficeSlice.workDay.currentSaleTrxValue}</span>
                        <Divider /> */}
                        <label className={classes.Label}><FontAwesomeIcon icon={faHandHoldingDollar} style={{ marginRight: '6px' }} /> Refund Trx Count: </label>
                        <span className={classes.Value}>{backofficeSlice.workDay.currentRefundTrxCount}</span>
                        <Divider />
                        <label className={classes.Label}><FontAwesomeIcon icon={faHandHoldingDollar} style={{ marginRight: '6px' }} /> Refund Amount: </label>
                        <span className={classes.Value}>₪ {backofficeSlice.workDay.currentRefundTrxValue}</span>
                    </Panel>}
            </FlexboxGridItem>
            <FlexboxGridItem colspan={6} style={{ marginRight: '10px' }}>
                <br />
                {backofficeSlice.workDay && backofficeSlice.workDay.businessDate &&
                    <Panel bordered header="Void / Suspend Summary" >
                        <label className={classes.Label}><FontAwesomeIcon icon={faBan} style={{ marginRight: '6px' }} /> Voided Trx Count: </label>
                        <span className={classes.Value}>{backofficeSlice.workDay.currentVoidedCount}</span>
                        <Divider />
                        <label className={classes.Label}><FontAwesomeIcon icon={faBan} style={{ marginRight: '6px' }} /> Voided Amount: </label>
                        <span className={classes.Value}>₪ {backofficeSlice.workDay.currentVoidedValue}</span>
                        <Divider />
                        <label className={classes.Label}><FontAwesomeIcon icon={faPause} style={{ marginRight: '6px' }} /> Suspended Trx Count: </label>
                        <span className={classes.Value}>{backofficeSlice.workDay.currentSuspendedCount}</span>
                        <Divider />
                        <label className={classes.Label}><FontAwesomeIcon icon={faPause} style={{ marginRight: '6px' }} /> Suspended Amount: </label>
                        <span className={classes.Value}>₪ {backofficeSlice.workDay.currentSuspendedValue}</span>
                    </Panel>}

            </FlexboxGridItem>

        </FlexboxGrid >
    );
}

export default WorkDaySetup;