import { confirmAlert } from 'react-confirm-alert'; // Import
import 'react-confirm-alert/src/react-confirm-alert.css'; // Import css

const confirm = (title, message, handler) => {
    confirmAlert({
        title,
        message,
        buttons: [
            {
                label: 'Yes',
                onClick: handler
            },
            {
                label: 'No',
                onClick: () => {}
            }
        ]
    });
};

export default confirm;