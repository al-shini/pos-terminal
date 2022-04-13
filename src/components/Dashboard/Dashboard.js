import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux'
import { Outlet, useNavigate } from "react-router-dom";
import { notify } from '../../store/uiSlice';
import { seemlessLogin } from '../../store/authSlice';

import Menu from './Menu';
import axios from '../../axios';

import { Box, Paper } from '@mui/material';



const Dashboard = (props) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const authSlice = useSelector((state) => state.auth);


    useEffect(() => {
        axios({
            method: 'post',
            url: '/auth/validate-token'
        }).then((response) => {
            if (response && response.data) {
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
        if (!authSlice.authenticated) {
            console.log('logged out not authed');
            navigate('/');
        }
    }, [authSlice.authenticated]);


    const content = () => {
        return <Box sx={{ width: '100%' }}>
            <Menu />
            <Paper elevation={1} sx={{ width: '97%', m: 'auto', mt: 3, p: 1 }}>
                <Outlet />
            </Paper>
        </Box>;
    }

    return (
        authSlice.authenticated && content()
    );
}

export default Dashboard;