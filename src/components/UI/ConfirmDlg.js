import { confirmAlert } from 'react-confirm-alert'; // Import 
import 'react-confirm-alert/src/react-confirm-alert.css'; // Import css
import { Button, ButtonToolbar, Divider } from 'rsuite';

const confirm = (title, message, handler) => {
    confirmAlert({
        customUI: ({ onClose }) => {
            return (
                <div style={{ background: 'white', padding: '10px', width: 250, height: 140 }}>
                    <h4 style={{textAlign: 'center'}}>{title}</h4>
                    <hr />
                    <ButtonToolbar>
                        <Button style={{width: '30%', float: 'left'}} appearance='ghost' onClick={onClose}>No</Button>
                        <Button style={{width: '60%', float: 'right'}} appearance='primary' onClick={()=>{
                            handler();
                            onClose();
                        }}>Yes</Button>
                    </ButtonToolbar>
                </div>
            );
        }
    });
};


export default confirm;