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
import { hideHardNotification, hideItemScanError, hideLoading, hideToast, hideCampaignWin } from './store/uiSlice';
import Snackbar from '@mui/material/Snackbar';
import Alert from "@mui/material/Alert";


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
          }}> Restart
          {((uiSlice.loadingTimeout - (timestamp - uiSlice.loadingTimestamp)) / 1000).toFixed(0) > 0 && <b style={{ marginLeft: '5px' }}>
            ({((uiSlice.loadingTimeout - (timestamp - uiSlice.loadingTimestamp)) / 1000).toFixed(0)})
          </b>}
        </Button>
      </Backdrop>

      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={uiSlice.itemScanError}
      >
        <div style={{ textAlign: 'center' }}>

          <h3 style={{background: 'white', padding: 20, borderRadius: 50,
            color: 'black'}}>{uiSlice.itemScanErrorMessage} </h3>
          <br />
          <h3>
            <Button appearance='primary'
              size='lg'
              style={{ fontSize: '35px', padding: 20 }}
              color='green' onClick={() => {
                dispatch(hideItemScanError());
              }}> OK
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
            color: 'black'}}>{uiSlice.hardNotificationMessage} </h3>
          <br />
          <h3>
            <Button appearance='primary'
              size='lg'
              style={{ fontSize: '35px', padding: 20 }}
              color='green' onClick={() => {
                dispatch(hideHardNotification());
              }}> OK
            </Button>
          </h3>
        </div>
      </Backdrop>

      {uiSlice.campaignWin && <Backdrop
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 2 }}
        open={true}
      >
        <style>{`
          @keyframes confettiFall {
            0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
          }
          @keyframes pulseGlow {
            0%, 100% { box-shadow: 0 0 20px rgba(255,215,0,0.6), 0 0 60px rgba(255,215,0,0.3); transform: scale(1); }
            50% { box-shadow: 0 0 40px rgba(255,215,0,0.9), 0 0 100px rgba(255,215,0,0.5); transform: scale(1.03); }
          }
          @keyframes slideUp {
            0% { transform: translateY(60px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
          @keyframes starBurst {
            0% { transform: scale(0) rotate(0deg); opacity: 0; }
            50% { transform: scale(1.2) rotate(180deg); opacity: 1; }
            100% { transform: scale(1) rotate(360deg); opacity: 1; }
          }
          .confetti-piece {
            position: fixed;
            width: 12px;
            height: 12px;
            top: -20px;
            animation: confettiFall linear forwards;
          }
        `}</style>
        {[...Array(40)].map((_, i) => (
          <div key={i} className="confetti-piece" style={{
            left: `${Math.random() * 100}%`,
            background: ['#FFD700','#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FF69B4','#FFA500','#7B68EE'][i % 8],
            borderRadius: i % 3 === 0 ? '50%' : i % 3 === 1 ? '0' : '50% 0',
            animationDuration: `${2 + Math.random() * 3}s`,
            animationDelay: `${Math.random() * 2}s`,
            width: `${8 + Math.random() * 12}px`,
            height: `${8 + Math.random() * 12}px`,
          }} />
        ))}
        <div style={{
          textAlign: 'center',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          borderRadius: '24px',
          padding: '50px 60px',
          maxWidth: '600px',
          animation: 'pulseGlow 2s ease-in-out infinite, slideUp 0.6s ease-out',
          position: 'relative',
          border: '3px solid rgba(255,215,0,0.4)',
        }}>
          <div style={{
            fontSize: '72px',
            animation: 'starBurst 0.8s ease-out forwards',
            marginBottom: '10px',
          }}>&#127881;</div>
          <h1 style={{
            color: '#FFD700',
            fontSize: '42px',
            fontWeight: 'bold',
            margin: '0 0 15px 0',
            textShadow: '0 0 20px rgba(255,215,0,0.5)',
            fontFamily: 'Arial, sans-serif',
          }}>CONGRATULATIONS!</h1>
          <h2 style={{
            color: 'white',
            fontSize: '28px',
            margin: '0 0 20px 0',
            fontWeight: 'normal',
            fontFamily: 'Arial, sans-serif',
          }}>You won a voucher!</h2>
          <div style={{
            background: 'linear-gradient(135deg, #FFD700, #FFA500)',
            borderRadius: '16px',
            padding: '20px 40px',
            display: 'inline-block',
            marginBottom: '20px',
          }}>
            <span style={{
              fontSize: '56px',
              fontWeight: 'bold',
              color: '#1a1a2e',
              fontFamily: 'Arial, sans-serif',
            }}>{uiSlice.campaignWinData?.voucherAmount} ILS</span>
          </div>
          <div style={{
            color: '#a0a0a0',
            fontSize: '18px',
            marginBottom: '30px',
            fontFamily: 'Arial, sans-serif',
          }}>
            Voucher Code: <span style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '22px', letterSpacing: '2px' }}>
              {uiSlice.campaignWinData?.couponCode}
            </span>
          </div>
          <Button appearance='primary' size='lg'
            style={{
              fontSize: '24px',
              padding: '15px 50px',
              background: 'linear-gradient(135deg, #FFD700, #FFA500)',
              border: 'none',
              color: '#1a1a2e',
              fontWeight: 'bold',
              borderRadius: '12px',
            }}
            onClick={() => { dispatch(hideCampaignWin()); }}>
            OK
          </Button>
        </div>
      </Backdrop>}

      <Snackbar
        onClose={() => {
          dispatch(hideToast())
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        open={uiSlice.toastOpen} autoHideDuration={2500} >
        <Alert severity={uiSlice.toastType} sx={{ width: '100%' }}>
          {uiSlice.toastMsg}
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
