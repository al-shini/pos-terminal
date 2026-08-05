import React, { useEffect, useState } from 'react';
import { Routes, Route, HashRouter } from "react-router-dom";
import { useDispatch, useSelector } from 'react-redux'
import { Button } from 'rsuite';

import Login from './components/Login/Login';
import Terminal from './components/Terminal/Terminal';
import CustomerDisplay from './components/Terminal/CustomerDisplay';
import Dashboard from "./components/Dashboard/Dashboard";


import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import Admin from './components/Backoffice/Admin';
import { hideHardNotification, hideItemScanError, hideLoading, hideToast } from './store/uiSlice';
import Snackbar from '@mui/material/Snackbar';
import Alert from "@mui/material/Alert";
import config from './config';
import { arabicize } from './utils/arabicMessages';


const App = () => {
  const uiSlice = useSelector((state) => state.ui);
  const dispatch = useDispatch();
  const terminalSlice = useSelector((state) => state.terminal);
  const [timestamp, setTimestamp] = useState(new Date().getTime());

  const checkLoadingTimeout = () => {
    if (uiSlice.loading) {
      setTimestamp(new Date().getTime());
      window.setTimeout(checkLoadingTimeout, 1000);
    }
  }

  useEffect(() => {
    if (uiSlice.loading) {
      checkLoadingTimeout();
    }
  }, [uiSlice.loading])

  return (
    <HashRouter>
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={uiSlice.loading}
      >
        {uiSlice.loadingMessage && <h5>{uiSlice.loadingMessage} </h5>}
        <CircularProgress style={{ position: 'relative', left: '10px' }} color="inherit" />
        <Button appearance='primary' color='red' style={{ position: 'absolute', top: '10px', left: '10px' }}
          disabled={(timestamp - uiSlice.loadingTimestamp) < uiSlice.loadingTimeout} onClick={() => {
            // dispatch(hideLoading());
            window.location.reload();
          }}> إعادة تشغيل
          {((uiSlice.loadingTimeout - (timestamp - uiSlice.loadingTimestamp)) / 1000).toFixed(0) > 0 && <b style={{ marginLeft: '5px' }}>
            ({((uiSlice.loadingTimeout - (timestamp - uiSlice.loadingTimestamp)) / 1000).toFixed(0)})
          </b>}
        </Button>
      </Backdrop>

      {/* Self-service mode renders its own Arabic scan-error overlay
          (SelfServiceScanError inside SelfServiceView), so the generic
          English backdrop is suppressed there. */}
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={uiSlice.itemScanError && !config.selfService}
      >
        <div style={{ textAlign: 'center' }}>

          <h3 style={{background: 'white', padding: 20, borderRadius: 50,
            color: 'black'}}>{arabicize(uiSlice.itemScanErrorMessage, 'error')} </h3>
          <br />
          <h3>
            <Button appearance='primary'
              size='lg'
              style={{ fontSize: '35px', padding: 20 }}
              color='green' onClick={() => {
                dispatch(hideItemScanError());
              }}> موافق
            </Button>
          </h3>
        </div>
      </Backdrop>

      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={uiSlice.hardNotification}
      >
        <div style={{ textAlign: 'center' }}>

          <h3 style={{background: 'white', padding: 20, borderRadius: 50,
            color: 'black'}}>{arabicize(uiSlice.hardNotificationMessage, 'error')} </h3>
          <br />
          <h3>
            <Button appearance='primary'
              size='lg'
              style={{ fontSize: '35px', padding: 20 }}
              color='green' onClick={() => {
                dispatch(hideHardNotification());
              }}> موافق
            </Button>
          </h3>
        </div>
      </Backdrop>

      <Snackbar
        onClose={() => {
          dispatch(hideToast())
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        open={uiSlice.toastOpen} autoHideDuration={2500} >
        <Alert severity={uiSlice.toastType} sx={{ width: '100%' }}>
          {arabicize(uiSlice.toastMsg, uiSlice.toastType)}
        </Alert>
      </Snackbar>

      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="app" element={<Dashboard />} >
          <Route path="" element={terminalSlice.isAdmin ? <Admin /> : <Terminal />} />
        </Route>
        <Route path="customer" element={<CustomerDisplay />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
