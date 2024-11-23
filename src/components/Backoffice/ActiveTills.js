import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux'
import axios from '../../axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faUser, faUsersGear, faRotate, faCheck, faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import FlexboxGridItem from 'rsuite/esm/FlexboxGrid/FlexboxGridItem';
import Divider from 'rsuite/esm/Divider';
import { Drawer, FlexboxGrid, Button, Table, Panel, InputNumber, Dropdown } from 'rsuite';
import { notify } from '../../store/uiSlice';
import { setTills, setSelectedTill, updateBalance, submitTillCounts, closeTill } from '../../store/backofficeSlice';
import confirm from '../../components/UI/ConfirmDlg';
import { Carousel } from 'rsuite';

const ActiveTills = (props) => {
    const dispatch = useDispatch();

    const backofficeSlice = useSelector((state) => state.backoffice);
    const terminalSlice = useSelector((state) => state.terminal);

    const [closeMode, setCloseMode] = useState(false);

    const handleChange = (e, i) => {
        dispatch(updateBalance({ i: i, balance: e }));
    }

    const loadActiveTills = () => {
        if (terminalSlice.store && backofficeSlice.workDay) {
            axios({
                method: 'post',
                url: '/bo/loadTills',
                headers: {
                    workDayKey: backofficeSlice.workDay.key
                }
            }).then((response) => {
                if (response && response.data) {
                    dispatch(setTills(response.data));
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
        if (backofficeSlice.workDay)
            loadActiveTills();
    }, []);


    const handleCloseTill = (till) => {
        dispatch(setSelectedTill(till));
        setCloseMode(true);
    }

    const handleSubmitCount = () => {
        if (!backofficeSlice.selectedTill) {
            alert('No valid selected Till!');
            return;
        }
        dispatch(submitTillCounts(backofficeSlice.selectedTill.balances));
    }

    const handleFinalCloseTill = () => {
        if (!backofficeSlice.selectedTill) {
            alert('No valid selected Till!');
            return;
        }
        if (backofficeSlice.selectedTill.status === 'R') {
            dispatch(closeTill());
            setCloseMode(false);
        } else {
            alert('Till not submitted');
        }
    }


    const translateStatus = (status) => {
        switch (status) {
            case 'O': return 'Open';
            case 'R': return 'Review';
            case 'L': return 'Locked';
            case 'C': return 'Closed';
        }
    }


    return (
        <React.Fragment>
            {!closeMode && <FlexboxGrid style={{ padding: '10px' }}>
                <FlexboxGridItem colspan={24}>
                    <h4 style={{ borderBottom: '1px solid #e1e1e1', paddingBottom: '5px' }}>
                        <FontAwesomeIcon icon={faUsersGear} />
                        <Divider vertical />
                        Active Tills
                    </h4>
                </FlexboxGridItem>
                <FlexboxGridItem colspan={24}>
                    <br />
                    <Button appearance='primary' color='green' onClick={loadActiveTills}>
                        <FontAwesomeIcon icon={faRotate} style={{ marginRight: '7px' }} />
                        Refresh Data
                    </Button>
                </FlexboxGridItem>
                <FlexboxGridItem colspan={24}>
                    <Table height={400}
                        rowHeight={60}
                        data={backofficeSlice.tills}
                    >
                        <Table.Column width={150} align='center'>
                            <Table.HeaderCell>
                                Close Till
                            </Table.HeaderCell>
                            <Table.Cell>
                                {rowData => <Button appearance='ghost' color='red'
                                    onClick={() => { handleCloseTill(rowData) }} disabled={rowData.status !== 'L' && rowData.status !== 'R'} >
                                    <FontAwesomeIcon icon={faLock} style={{ marginRight: '6px' }} />
                                    Close Till
                                </Button>
                                }
                            </Table.Cell>
                        </Table.Column>
                        <Table.Column align='center'>
                            <Table.HeaderCell>Status</Table.HeaderCell>
                            <Table.Cell>
                                {rowData => translateStatus(rowData.status)}
                            </Table.Cell>
                        </Table.Column>
                        <Table.Column width={300} align='left'>
                            <Table.HeaderCell>User</Table.HeaderCell>
                            <Table.Cell dataKey="user.username" />
                        </Table.Column>
                        <Table.Column width={200} align='center'>
                            <Table.HeaderCell>Trx Sale Count</Table.HeaderCell>
                            <Table.Cell dataKey="currentSaleTrxCount" />
                        </Table.Column>
                        <Table.Column width={200} align='center'>
                            <Table.HeaderCell>Refund Sale Count</Table.HeaderCell>
                            <Table.Cell dataKey="currentRefundTrxCount" />
                        </Table.Column>
                        <Table.Column width={200} align='center'>
                            <Table.HeaderCell>Voided Trx Count</Table.HeaderCell>
                            <Table.Cell dataKey="currentVoidedCount" />
                        </Table.Column>
                        <Table.Column width={200} align='center'>
                            <Table.HeaderCell>Suspended Trx Count</Table.HeaderCell>
                            <Table.Cell dataKey="currentSuspendedCount" />
                        </Table.Column>
                    </Table>
                </FlexboxGridItem>
            </FlexboxGrid >}

            {closeMode && <div style={{ padding: '15px' }}>
                <div>
                    {backofficeSlice.selectedTill && backofficeSlice.selectedTill.user && backofficeSlice.selectedTill.terminal &&
                        <div>
                            <h3>Close Till For User <i style={{ color: '#1787e8' }}>{backofficeSlice.selectedTill.user.username}</i></h3>
                            <hr />
                            <h3>
                                {
                                    backofficeSlice.selectedTill.status === 'R' &&
                                    <span>Final Till Variance in JOD is =
                                        <span style={{ color: backofficeSlice.selectedTill.totalNisVariance >= 0 ? '#34db16' : '#f12121', fontFamily: 'DSDIGI', marginLeft: '5px', fontSize: '40px' }}>
                                            {backofficeSlice.selectedTill.totalNisVariance}JD
                                        </span>
                                    </span>
                                }
                            </h3>
                        </div>
                    }
                </div>
                <hr />
                <div>
                    {backofficeSlice.selectedTill &&
                        <div>
                            <Button onClick={() => setCloseMode(false)}
                                appearance="primary" color={'orange'}>
                                <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: '6px' }} />
                                Go Back
                            </Button>

                            <Button style={{ float: 'right' }} disabled={backofficeSlice.selectedTill.status !== 'R'} onClick={() => {
                                confirm('Close Till?', '', () => {
                                    handleFinalCloseTill()
                                })
                            }}
                                appearance="primary" color={'red'}>
                                <FontAwesomeIcon icon={faLock} style={{ marginRight: '6px' }} />
                                Close Till
                            </Button>
                            <Button style={{ float: 'right', marginRight: '10px' }} onClick={handleSubmitCount}
                                appearance="primary" color={'blue'}>
                                <FontAwesomeIcon icon={faCheck} style={{ marginRight: '6px' }} />
                                Submit Counting
                            </Button>
                        </div>
                    }
                </div>
                <hr />
                {backofficeSlice.selectedTill && backofficeSlice.selectedTill.balances && <div style={{ height: '65vh', overflowY: 'auto' }} >
                    <FlexboxGrid>
                        {
                            backofficeSlice.selectedTill.balances.map((bv, i) => {
                                if (bv.paymentMethodKey !== 'Cash') {
                                    if (bv.currency === 'JOD') {
                                        // do nothing
                                    }else{
                                        return null;
                                    }
                                }

                                return <FlexboxGridItem key={i + 'fgi'} colspan={5} style={{ marginRight: '4%', marginBottom: '1%' }}>
                                    <Panel bordered eventKey={i + 1} key={bv.key}
                                        header={
                                            <span>
                                                <b>{bv.paymentMethodDescription}</b>
                                                <Divider vertical />
                                                <span>{bv.closingBalance + ' ' + bv.currency}</span>
                                                <Divider vertical />
                                                <small>
                                                    {bv.currency !== 'JOD' && (backofficeSlice.selectedTill.status !== 'L') ? ((bv.closingBalance * bv.rate) + '').concat(' JOD') : ''}
                                                </small>
                                            </span>
                                        }>
                                        <FlexboxGrid>
                                            <FlexboxGridItem colspan={1} />
                                            <FlexboxGridItem colspan={22}>
                                                <h5 style={{ textAlign: 'center' }}>Counted</h5>
                                                <InputNumber disabled={backofficeSlice.selectedTill.status === 'C'}
                                                    prefix={bv.currency}
                                                    value={bv.closingBalance}
                                                    onChange={(e) => handleChange(e, i)} />
                                            </FlexboxGridItem>
                                            <FlexboxGridItem colspan={1} />

                                            <FlexboxGridItem colspan={1} />
                                            {
                                                backofficeSlice.selectedTill.status === 'R' &&
                                                <FlexboxGridItem colspan={22}>
                                                    <br />
                                                    <h5 style={{ textAlign: 'center' }}>Actual</h5>
                                                    <InputNumber disabled={true} style={{ color: 'black', opacity: '1' }}
                                                        prefix={bv.currency}
                                                        value={(bv.currency === 'JOD' && bv.paymentMethodKey === 'Cash') ? backofficeSlice.selectedTill.actualBalance : bv.actualBalance} />
                                                </FlexboxGridItem>
                                            }
                                            <FlexboxGridItem colspan={1} />

                                            <FlexboxGridItem colspan={1} />
                                            {
                                                backofficeSlice.selectedTill.status === 'R' &&
                                                <FlexboxGridItem colspan={22}>
                                                    <br />
                                                    <h5 style={{ textAlign: 'center' }}>Variance (Currency)</h5>
                                                    <InputNumber disabled={true} style={{ color: 'black', opacity: '1' }}
                                                        prefix={bv.currency}
                                                        value={(bv.currency === 'JOD' && bv.paymentMethodKey === 'Cash') ? backofficeSlice.selectedTill.variance : bv.ogCurrencyVariance} />
                                                </FlexboxGridItem>
                                            }
                                            <FlexboxGridItem colspan={1} />

                                        </FlexboxGrid>
                                    </Panel>
                                </FlexboxGridItem>
                            })
                        }
                    </FlexboxGrid>
                </div>}
            </div>}
        </React.Fragment>

    );
}

export default ActiveTills;