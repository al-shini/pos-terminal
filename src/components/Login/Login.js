import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from "react-router-dom";

import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import QRCode from "react-qr-code";

import PosBG from '../../assets/pos-bg.png';
import DazzleLogo from '../../assets/dazzle-logo.png';

import { login } from '../../store/terminalSlice';
import { notify, showLoading, hideLoading } from '../../store/uiSlice';

import config from '../../config';
import axios from '../../axios'


const Login = (props) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const terminalSlice = useSelector((state) => state.terminal);

    const [cred, setCred] = useState({
        username: '',
        password: ''
    });

    const [loginQR, setLoginQR] = useState({});

    const theme = createTheme();

    const handleSubmit = (event) => {
        dispatch(login({ ...cred, terminalHardwareId: config.deviceId }));
        event.preventDefault();
    };

    const checkQrScan = () => {
        axios({
            method: 'get',
            url: '/utilities/checkQRState',
            params: {
                authKey: loginQR.qrAuthKey
            }
        }).then((response) => {
            if (response && response.data) {
                if (response.data.status === 'Scanned') {
                    dispatch(login({
                        terminalHardwareId: config.deviceId,
                        mobileHardwareId: response.data.signedBy,
                        authKey: response.data.key
                    }));
                } else {
                    window.setTimeout(() => {
                        console.log(terminalSlice.authenticated);
                        if (!terminalSlice.authenticated) {
                            checkQrScan();
                        }
                    }, 1500);
                }
            } else {
                dispatch(notify({ msg: 'Incorrect Login QR check response', sev: 'error' }))
            }
        }).catch((error) => {
            if (error.response) {
                if (error.response.status === 401) {
                    dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }))
                } else {
                    dispatch(hideLoading());
                    dispatch(notify({ msg: error.response.data, sev: 'error' }));
                }
            } else {
                dispatch(notify({ msg: error.message, sev: 'error' }));
            }

        });
    }

    useEffect(async () => {
        axios({
            method: 'post',
            url: '/utilities/generateQR',
            data: {
                hardwareId: config.deviceId,
                source: 'Login'
            }
        }).then((response) => {
            if (response && response.data) {
                setLoginQR(response.data)
            } else {
                dispatch(notify({ msg: 'Incorrect Login QR response', sev: 'error' }))
            }
        }).catch((error) => {
            if (error.response) {
                if (error.response.status === 401) {
                    dispatch(notify({ msg: 'Un-Authorized', sev: 'error' }))
                }
            } else {
                dispatch(notify({ msg: error.message, sev: 'error' }));
            }

        });
    }, []);

    useEffect(() => {
        if (terminalSlice.authenticated) {
            navigate('/app');
        }
    }, [terminalSlice.authenticated]);

    useEffect(() => {
        if (loginQR.qrAuthKey && !terminalSlice.authenticated) {
            checkQrScan();
        }
    }, [loginQR]);



    return (
        <ThemeProvider theme={theme}>
            <Grid container component="main" sx={{ height: '100vh' }}>
                <CssBaseline />
                <Grid
                    item
                    xs={false}
                    sm={4}
                    md={7}
                    sx={{
                        backgroundImage: `url(${PosBG})`,
                        backgroundRepeat: 'no-repeat',
                        backgroundColor: (t) =>
                            t.palette.mode === 'light' ? t.palette.grey[50] : t.palette.grey[900],
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}
                />
                <Grid item xs={12} sm={8} md={5} component={Paper} elevation={6} square>
                    <img src={DazzleLogo} style={{ display: 'block', margin: 'auto', maxWidth: '60%' }} />

                    <div style={{ textAlign: 'center', margin: '15px' }}>
                        <QRCode value={JSON.stringify(loginQR)} size={180} />
                    </div>
                    <h6 style={{ textAlign: 'center' }}>
                        <br />
                        OR
                    </h6>
                    <Box
                        sx={{
                            my: 8,
                            mx: 4,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                        }}
                    >

                        <Box component="form" noValidate onSubmit={handleSubmit} sx={{ mt: -5 }}>
                            <TextField
                                margin="normal"
                                required
                                error={!cred.username}
                                fullWidth
                                id="username"
                                label="Username"
                                value={cred.username}
                                onChange={(e) => setCred({ ...cred, username: e.target.value })}
                                autoFocus
                            />
                            <TextField
                                margin="normal"
                                required
                                error={!cred.password}
                                fullWidth
                                value={cred.password}
                                onChange={(e) => setCred({ ...cred, password: e.target.value })}
                                label="Password"
                                type="password"
                                id="password"
                            />

                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                sx={{ mt: 3, mb: 2 }} >
                                Sign In
                            </Button>
                        </Box>
                    </Box>
                </Grid>
            </Grid>
        </ThemeProvider>
    );
}

export default Login;