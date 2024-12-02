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

const { Column, HeaderCell, Cell } = Table;

const ActiveTills = (props) => {
    const dispatch = useDispatch();

    const backofficeSlice = useSelector((state) => state.backoffice);
    const terminalSlice = useSelector((state) => state.terminal);

    const [closeMode, setCloseMode] = useState(false);
const data = (backofficeSlice.selectedTill && backofficeSlice.selectedTill.balances)
    ? backofficeSlice.selectedTill.balances.map((bv, i) => ({
        key: i, // Use index as key
        paymentMethod: bv.paymentMethodDescription,
        closingBalance: bv.closingBalance + ' ' + bv.currency,
        counted: {
            value: bv.closingBalance,
            editable: backofficeSlice.selectedTill.status !== 'C',
            currency: bv.currency,
        },
        actual: {
            value:
                bv.currency === 'JOD' && bv.paymentMethodKey === 'Cash'
                    ? backofficeSlice.selectedTill.actualBalance
                    : bv.actualBalance,
            editable: false,
        },
        variance: {
            value:
                bv.currency === 'JOD' && bv.paymentMethodKey === 'Cash'
                    ? backofficeSlice.selectedTill.variance
                    : bv.ogCurrencyVariance,
            editable: false,
        },
    }))
    : [];

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
                {backofficeSlice.selectedTill && backofficeSlice.selectedTill.balances && <div style={{height:'70vh', overflowY: 'auto' }} >
                    <Table data={data} bordered rowHeight={60} fillHeight >
                        {/* Payment Method Column */}
                        {/* <Column flexGrow={1} align="center">
                            <HeaderCell>Payment Method</HeaderCell>
                            <Cell dataKey="paymentMethod" />
                        </Column> */}

                        {/* Closing Balance Column */}
                        {/* <Column flexGrow={1} align="center">
                            <HeaderCell>Closing Balance</HeaderCell>
                            <Cell dataKey="closingBalance" />
                        </Column> */}

                        {/* Counted Column */}
                        <Column flexGrow={2} align="center">
                            <HeaderCell>Counted</HeaderCell>
                    
                            <Cell>
                                {rowData => (
                                    <InputNumber
                                        disabled={!rowData.counted.editable}
                                        prefix={<span><b>[ {rowData.paymentMethod} ]</b>  <span>{rowData.counted.currency}</span></span>}
                                        value={rowData.counted.value}
                                        onChange={value => handleChange(value, rowData.key)}
                                    />
                                )}
                            </Cell>
                        </Column>

                        {/* Actual Column */}
                        {backofficeSlice.selectedTill.status === 'R' && (
                            <Column flexGrow={2} align="center">
                                <HeaderCell>Actual</HeaderCell>
                                <Cell>
                                    {rowData => (
                                        <InputNumber
                                            disabled={!rowData.actual.editable}
                                            style={{ color: 'black', opacity: '1' }}
                                            prefix={rowData.counted.currency}
                                            value={rowData.actual.value}
                                        />
                                    )}
                                </Cell>
                            </Column>
                        )}

                        {/* Variance Column */}
                        {backofficeSlice.selectedTill.status === 'R' && (
                            <Column flexGrow={2} align="center">
                                <HeaderCell>Variance (Currency)</HeaderCell>
                                <Cell>
                                    {rowData => (
                                        <InputNumber
                                            disabled={!rowData.variance.editable}
                                            style={{ color: 'black', opacity: '1' }}
                                            prefix={rowData.counted.currency}
                                            value={rowData.variance.value}
                                        />
                                    )}
                                </Cell>
                            </Column>
                        )}
                    </Table>
                </div>}
            </div>}
        </React.Fragment>

    );
}

export default ActiveTills;