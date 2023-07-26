import React from 'react';
import { Routes, Route, HashRouter } from "react-router-dom";
import { useSelector } from 'react-redux'

import Login from './components/Login/Login';
import Terminal from './components/Terminal/Terminal';
import CustomerDisplay from './components/Terminal/CustomerDisplay';
import Dashboard from "./components/Dashboard/Dashboard";


import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';




const App = () => {
  const uiSlice = useSelector((state) => state.ui);

  return (
    <HashRouter>
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={uiSlice.loading}
      >
        <CircularProgress color="inherit" />
      </Backdrop>

      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="app" element={<Dashboard />} >
          <Route path="" element={<Terminal />} />
        </Route>
        <Route path="customer" element={<CustomerDisplay />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
