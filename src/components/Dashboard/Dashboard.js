import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux'
import { Outlet, useNavigate } from "react-router-dom";
import { notify } from '../../store/uiSlice';
import { seemlessLogin, unblockActions, blockActions, setStoreCustomer, setCustomer, setTrxMode } from '../../store/terminalSlice';
import axios from '../../axios';
import config from '../../config';
import { Box } from '@mui/material';
import { resumeTrx } from '../../store/trxSlice';



const Dashboard = (props) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const terminal = useSelector((state) => state.terminal);

    useEffect(() => {
        if (!terminal.authenticated) {
            console.log('validating token...');
            axios({
                method: 'post',
                url: '/auth/validate-token',
                params: {
                    deviceId: config.deviceId
                }
            }).then((response) => {
                if (response && response.data) {
                    console.log('response from seemlessLogin', response.data);
                    dispatch(seemlessLogin(response.data));
                    updateCustomer(response.data)
                }
            }).catch((error) => {
                if (error.response) {
                    if (error.response.status === 401) {
                        console.log('Authorization invalid');
                        navigate('/');
                    }
                } else {
                    dispatch(notify({ msg: error.message, sev: 'error' }));
                }
            });
        } else {
            if(!terminal.storeCustomer){
                updateCustomer({...terminal});
            }
        }
    }, []);

    const updateCustomer = (loginResponse) => {
        axios({
            method: 'post',
            url: '/posAcc/fetchCustomer',
            headers: {
                customerKey: loginResponse.store.sapCustomerCode
            }
        }).then((response) => {
            if (response && response.data) {
                dispatch(setStoreCustomer(response.data))
                checkOpenTrx(loginResponse.till, response.data);
            }
        }).catch((error) => {
            dispatch(notify({ msg: error ? error.message : error, sev: 'error' }));
        });
    }

    const checkOpenTrx = (till, storeCustomer) => {
        console.log('checkOpenTrx...');
        return axios({
            method: 'post',
            url: '/trx/checkOpenTrx',
            data: {
                tillKey: till.key
            }
        }).then((response) => {
            if (response && response.data) {
                dispatch(resumeTrx(response.data));
                console.log(response.data)
                if (response.data.trx)
                    dispatch(setTrxMode(response.data.trx.type))
                if (response.data.customer) {
                    dispatch(setCustomer(response.data.customer));
                } else {
                    dispatch(setCustomer(storeCustomer))
                }
            }
        }).catch((error) => {
            if (error.response) {
                if (error.response.status === 401) {
                    dispatch(notify({ msg: 'Wrong credentials', sev: 'error' }));
                }
            } else {
                dispatch(notify({ msg: error.message, sev: 'error' }));
            }

        });
    }


    useEffect(() => {
        if (!terminal.authenticated) {
            navigate('/');
        }
    }, [terminal.authenticated]);

    useEffect(() => {
        if (terminal.till && terminal.till.status === 'L') {
            dispatch(blockActions());
        } else {
            dispatch(unblockActions());
        }
    }, [terminal.till]);


    const content = () => {
        return <Box sx={{ width: '100%' }}>
            <Outlet />
        </Box>;
    }

    return (
        terminal.authenticated && content()
    );
}

export default Dashboard;