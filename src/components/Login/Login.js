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

import PosBG from '../../assets/pos-bg.png';
import DazzleLogo from '../../assets/dazzle-logo.png';

import {login}  from '../../store/authSlice';

const Login = (props) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const authSlice = useSelector((state) => state.auth);

    const [cred, setCred] = useState({
        username: '',
        password: ''
    });

    const theme = createTheme();

    const handleSubmit = (event) => {
        dispatch(login(cred));
        event.preventDefault();
    };

    useEffect(() => {
        if(authSlice.authenticated){
            navigate('/app');
        }
    }, [authSlice.authenticated]);



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
                    <br/>
                    <br/>
                    <br/>
                    <br/>
                <img src={DazzleLogo} style={{display: 'block', margin: 'auto', maxWidth: '60%'}} />
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