import React from 'react';
import { useDispatch } from 'react-redux';
import { logout } from '../../store/authSlice';

import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import ListSubheader from '@mui/material/ListSubheader';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';



/* Icons */
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import Typography from '@mui/material/Typography';
import MenuIcon from '@mui/icons-material/Menu';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useNavigate } from 'react-router-dom';


const Menu = (props) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [open, setOpen] = React.useState(false);
  const toggleDrawer = () => {
    setOpen(!open);
  };


  const logoutHandler = () => {
    dispatch(logout());
  }


  return (
    <React.Fragment>
      <AppBar position="static">
        <Toolbar>
          <IconButton onClick={toggleDrawer}
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Typography onClick={() => {navigate('/app'); setOpen(false)}} variant="h6" component="div" sx={{ flexGrow: 1, cursor: 'pointer' }}>
            Shini Plus - Dazzle POS
          </Typography>
          <Typography variant="h6" component="div" >
          </Typography>
          <Button onClick={logoutHandler}
            size="large" edge="start" color="inherit" aria-label="menu" >
            <ExitToAppIcon />
            <Typography variant="h7" component="div" sx={{ flexGrow: 1 }}>
              Logout
            </Typography>
          </Button>
        </Toolbar>
      </AppBar>


      <Drawer anchor='left' open={open} onClose={toggleDrawer} >
        <Box sx={{ width: 250 }}>
          <List
            sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}
            component="nav"
            aria-labelledby="nested-list-subheader"
            subheader={
              <ListSubheader component="div" id="nested-list-subheader">
                Navigation Menu
              </ListSubheader>
            } >

            <ListItemButton onClick={() => {navigate('/app/admin'); setOpen(false)}}>
              <ListItemIcon>
                <AdminPanelSettingsIcon />
              </ListItemIcon>
              <ListItemText primary="Administration" />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>

    </React.Fragment>
  );
}

export default Menu;