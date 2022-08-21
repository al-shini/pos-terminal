import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../store/terminalSlice';

import { Navbar, Button, Divider } from 'rsuite';

import DazzleLogo from '../../assets/dazzle-logo.png';

/* Icons */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserTie, faXmark, faClock } from '@fortawesome/free-solid-svg-icons'


const Menu = (props) => {
  const dispatch = useDispatch();
  const terminalSlice = useSelector((state) => state.terminal);


  const logoutHandler = () => {
    dispatch(logout());
  }


  return (
    <Navbar>
      <div style={{ position: 'absolute', left: '0%', height: '5vh', lineHeight: '5vh' }}>
        <img src={DazzleLogo} style={{ height: '100%', maxHeight: '6vh' }} alt='none' />
      </div>

      <div style={{ position: 'absolute', left: '7vw', height: '5vh', lineHeight: '5vh' }}>
        <label style={{ fontSize: '16px' }}>
          <FontAwesomeIcon icon={faUserTie} style={{ marginRight: '5px'  }} />
          {terminalSlice.loggedInUser.username}
        </label>
      </div>

      <div style={{ position: 'absolute', left: '15vw', height: '5vh', lineHeight: '5vh' }}>
        <label style={{ fontSize: '16px' }}>
          <FontAwesomeIcon icon={faClock} style={{ marginRight: '5px'   }} />
          {new Date().toISOString().split('T')[0]}
        </label>
      </div>

      <div style={{ position: 'absolute', right: '1%', height: '5vh', lineHeight: '5vh' }}>
        <Button appearance='link' color='red' size='xs' style={{ fontSize: '13px' }} onClick={logoutHandler}>
          Shutdown Terminal
          <Divider vertical />
          <FontAwesomeIcon icon={faXmark} />
        </Button>
      </div>


    </Navbar>
  );
}

export default Menu;