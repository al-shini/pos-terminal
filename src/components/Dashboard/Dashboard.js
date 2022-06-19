import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux'
import { Outlet, useNavigate } from "react-router-dom";
import { notify } from '../../store/uiSlice';
import { seemlessLogin } from '../../store/terminalSlice';

import Menu from './Menu';
import axios from '../../axios';
import config from '../../config';
import { Box, Paper } from '@mui/material';



const Dashboard = (props) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const terminalSlice = useSelector((state) => state.terminal);


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
        if (!terminalSlice.authenticated) {
            navigate('/');
        }
    }, [terminalSlice.authenticated]);


    const content = () => {
        return <Box sx={{ width: '100%' }}>
            <Outlet />
        </Box>;
    }

    return (
        terminalSlice.authenticated && content()
    );
}

export default Dashboard;