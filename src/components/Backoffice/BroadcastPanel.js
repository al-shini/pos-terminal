import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBullhorn, faPaperPlane, faTrash, faImage,
} from '@fortawesome/free-solid-svg-icons';

import classes from './Admin.module.css';
import { setCustomerBroadcast, clearCustomerBroadcast } from '../../store/terminalSlice';

const BroadcastPanel = () => {
    const dispatch = useDispatch();
    const current = useSelector((state) => state.terminal?.customerBroadcast);

    const [message, setMessage] = useState('');
    const [imageUrl, setImageUrl] = useState('');

    const send = () => {
        if (!message.trim() && !imageUrl.trim()) return;
        dispatch(setCustomerBroadcast({ message: message.trim(), imageUrl: imageUrl.trim() || null }));
    };

    const clear = () => {
        dispatch(clearCustomerBroadcast());
        setMessage('');
        setImageUrl('');
    };

    return (
        <div className={classes.LookupCard}>
            <div className={classes.LookupCardHeader}>
                <h3 className={classes.LookupCardTitle}>
                    <FontAwesomeIcon icon={faBullhorn} />
                    Broadcast to Customer Screens
                </h3>
            </div>

            <div className={classes.LookupCardBody}>
                <div className={classes.BroadcastCard}>
                    <div className={classes.BroadcastField}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                            Message
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Big message to flash on every open customer screen…"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                        />
                    </div>

                    <div className={classes.BroadcastField}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                            <FontAwesomeIcon icon={faImage} /> Image URL (optional)
                        </label>
                        <input
                            type="text"
                            placeholder="https://…"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                        />
                    </div>

                    {current && (
                        <div className={classes.BroadcastPreview}>
                            <b>Currently broadcasting:</b>
                            <div style={{ marginTop: 6 }}>{current.message || <em style={{ color: '#6B7280' }}>(image only)</em>}</div>
                            {current.imageUrl && (
                                <div style={{ marginTop: 6 }}>
                                    <small style={{ color: '#6B7280' }}>{current.imageUrl}</small>
                                </div>
                            )}
                        </div>
                    )}

                    <div className={classes.BroadcastActions}>
                        <button
                            className={`${classes.PillBtn} ${classes.PillBtnDanger} ${classes.PillBtnSmall}`}
                            onClick={send}
                            disabled={!message.trim() && !imageUrl.trim()}
                        >
                            <span className={classes.PillBtnIcon}><FontAwesomeIcon icon={faPaperPlane} /></span>
                            Broadcast
                        </button>
                        <button
                            className={`${classes.PillBtn} ${classes.PillBtnGhost} ${classes.PillBtnSmall}`}
                            onClick={clear}
                            disabled={!current}
                        >
                            <span className={classes.PillBtnIcon}><FontAwesomeIcon icon={faTrash} /></span>
                            Clear
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BroadcastPanel;
