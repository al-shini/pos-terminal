import React, { useEffect } from 'react';
import { useSelector } from 'react-redux'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDay, faUsersGear, faSignOut } from '@fortawesome/free-solid-svg-icons'
import FlexboxGridItem from 'rsuite/esm/FlexboxGrid/FlexboxGridItem';
import Divider from 'rsuite/esm/Divider';
import { FlexboxGrid } from 'rsuite';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { Alert, Paper, Snackbar } from '@mui/material';
import WorkDaySetup from './WorkDaySetup';
import ActiveTills from './ActiveTills';
import confirm from '../UI/ConfirmDlg';


const Admin = (props) => {
    const uiSlice = useSelector((state) => state.ui);

    const [tabIndex, setTabIndex] = React.useState(0);
    const handleChange = (event, newValue) => {
        setTabIndex(newValue);
    }; 

    return (
        <div style={{position: 'fixed', left: '0%', top: '0%', background: 'white !important',width: '100vw'}}>
            <FlexboxGrid style={{ padding: '10px', background: 'white' }}>
                <FlexboxGridItem colspan={24} style={{ height: '5vh' }}>
                    {<Snackbar
                        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                        open={uiSlice.toastOpen} >
                        <Alert severity={uiSlice.toastType} sx={{ width: '100%' }}>
                            {uiSlice.toastMsg}
                        </Alert>
                    </Snackbar>}

                    <Tabs value={tabIndex} onChange={handleChange} aria-label="basic tabs example">
                        <Tab label={<div>
                            <FontAwesomeIcon icon={faCalendarDay} />
                            <Divider vertical />
                            Work Day Setup
                        </div>} />
                        <Tab label={<div>
                            <FontAwesomeIcon icon={faUsersGear} />
                            <Divider vertical />
                            Active Tills
                        </div>} />
                    </Tabs>
                    <Divider />
                    <div onClick={() => {
                              confirm('Exit?', 'Are you sure you want to close the application?', () => {
                                window.close();
                            })
                         }} style={{ color: 'red', position: 'fixed', top: '0%', right: '0%', margin: '15px', cursor: 'pointer', background: 'white' }}>
                        <h5>
                            <FontAwesomeIcon icon={faSignOut} style={{ marginRight: '5px' }} />
                            Exit Application
                        </h5>
                    </div>
                </FlexboxGridItem>
                <FlexboxGridItem colspan={24} >
                    <Paper elevation={1} style={{ height: '100%' }}>
                        {tabIndex === 0 && <WorkDaySetup />}
                        {tabIndex === 1 && <ActiveTills />}
                    </Paper>
                </FlexboxGridItem>
            </FlexboxGrid >
        </div>
    );
}

export default Admin;