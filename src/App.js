import React from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useSelector } from 'react-redux'

import Login from './components/Login/Login';
import Terminal from './components/Terminal/Terminal';
import Dashboard from "./components/Dashboard/Dashboard";


import Backdrop from '@mui/material/Backdrop';
import Snackbar from '@mui/material/Snackbar';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from "@mui/material/Alert";




const App = () => {
  const uiSlice = useSelector((state) => state.ui);

  return (
    <BrowserRouter>
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={uiSlice.loading}
      >
        <CircularProgress color="inherit" />
      </Backdrop>

      <Snackbar
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        open={uiSlice.toastOpen} >
        <Alert severity={uiSlice.toastType} sx={{ width: '100%' }}>
          {uiSlice.toastMsg}
        </Alert>
      </Snackbar>

      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="app" element={<Dashboard />} >
          <Route path="" element={<Terminal />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
