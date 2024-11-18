import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { lockTill } from '../store/terminalSlice';

const InactivityHandler = ({ setActionsMode }) => {
    const inactivityTimeout = 50 * 60 * 1000; // 10 minutes in milliseconds
    const timeoutRef = useRef(null);

    const dispatch = useDispatch();

    const handleInactivity = () => {
        setActionsMode('operations');
        dispatch(lockTill())
        resetTimer(); // Restart the inactivity timer after it triggers
    };

    const resetTimer = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(handleInactivity, inactivityTimeout);
    };

    useEffect(() => {
        // Set the initial inactivity timeout
        resetTimer();

        // Define activity events
        const activityEvents = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];

        // Reset the timer on any activity
        activityEvents.forEach((event) => {
            window.addEventListener(event, resetTimer);
        });

        // Cleanup function
        return () => {
            clearTimeout(timeoutRef.current);
            activityEvents.forEach((event) => {
                window.removeEventListener(event, resetTimer);
            });
        };
    }, []);

    return (
        <i></i>
    );
};

export default InactivityHandler;
