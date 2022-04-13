import React from 'react';
import { useNavigate } from "react-router-dom";
import { styled } from '@mui/material/styles';
import { Button, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import PeopleIcon from '@mui/icons-material/People';
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import LockClockIcon from '@mui/icons-material/LockClock';
import AssessmentIcon from '@mui/icons-material/Assessment';
import DazzleLogo from '../../assets/dazzle-logo.png';


const Landing = (props) => {
    const navigate = useNavigate();

    const Item = styled(Paper)(({ theme }) => ({
        backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
        ...theme.typography.body2,
        padding: theme.spacing(1),
        textAlign: 'center',
        color: theme.palette.text.secondary,
    }));

    const LandingButton = styled(Button)(({ theme }) => ({
        padding: 70,
        fontSize: 18,
    }));


    return (
        <Grid container spacing={2}>
            <Grid item xs={12}>
                <img style={{ margin: 'auto', display: 'block' }} src={DazzleLogo} width={250} />
            </Grid>

            <Grid item xs={4}>
                <Item>
                    <LandingButton onClick={() => { navigate('/app/admin') }}>
                        <AdminPanelSettingsIcon />
                        <Typography margin={1.5} variant='h5'>
                            Administration
                        </Typography>
                    </LandingButton>
                </Item>
            </Grid>
        </Grid>
    );
}

export default Landing;