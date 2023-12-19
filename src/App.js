import React from 'react';
import { Routes, Route, HashRouter } from "react-router-dom";
import { useSelector } from 'react-redux'

import Login from './components/Login/Login';
import Terminal from './components/Terminal/Terminal';
import CustomerDisplay from './components/Terminal/CustomerDisplay';
import Dashboard from "./components/Dashboard/Dashboard";


import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import Admin from './components/Backoffice/Admin';




const App = () => {
  const uiSlice = useSelector((state) => state.ui);
  const terminalSlice = useSelector((state) => state.terminal);

  return (
    <HashRouter>
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={uiSlice.loading}
      >
        {uiSlice.loadingMessage && <h5>{uiSlice.loadingMessage} </h5>}
        <CircularProgress style={{position: 'relative', left:'10px'}} color="inherit" />
      </Backdrop>

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
