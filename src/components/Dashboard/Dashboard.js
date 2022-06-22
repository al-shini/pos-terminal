import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux'
import { Outlet, useNavigate } from "react-router-dom";
import { notify, hideLoading } from '../../store/uiSlice';
import { seemlessLogin, unblockActions, blockActions } from '../../store/terminalSlice';

import Menu from './Menu';
import axios from '../../axios';
import config from '../../config';
import { Box, Paper } from '@mui/material';



const Dashboard = (props) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const terminal = useSelector((state) => state.terminal);


    useEffect(() => {
        axios({
            method: 'post',
            url: '/auth/validate-token',
            params: {
                deviceId: config.deviceId
            }
        }).then((response) => {
            if (response && response.data) {
                console.log('valdiate token', response.data);
                dispatch(seemlessLogin(response.data));
                dispatch(hideLoading())
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
    }, []);

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