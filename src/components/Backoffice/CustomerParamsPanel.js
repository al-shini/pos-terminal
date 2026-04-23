import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDisplay, faFloppyDisk, faArrowsRotate } from '@fortawesome/free-solid-svg-icons';

import classes from './Admin.module.css';
import { fetchCustomerParams, setCustomerParam } from '../../store/backofficeSlice';
import { bumpCustomerConfigVersion } from '../../store/terminalSlice';

const PARAMS = [
    {
        key: 'POS_CUSTOMER_IMAGES',
        title: 'Customer Display — Carousel Images',
        hint: 'Comma-separated list of image URLs shown on the right panel of every customer screen.',
        placeholder: 'https://…/ad1.jpg, https://…/ad2.jpg',
    },
    {
        key: 'POS_CUSTOMER_MESSAGES',
        title: 'Customer Display — News Bar Messages',
        hint: 'Comma-separated list of short messages that scroll across the bottom news bar.',
        placeholder: '20% off fresh bread today, Double cashback all day!',
    },
];

const CustomerParamsPanel = () => {
    const dispatch = useDispatch();
    const slice = useSelector((state) => state.backoffice?.customerParams);
    const values = slice?.values || {};
    const saving = slice?.saving;

    const [drafts, setDrafts] = useState({});

    useEffect(() => {
        dispatch(fetchCustomerParams());
    }, [dispatch]);

    useEffect(() => {
        const next = {};
        for (const p of PARAMS) {
            next[p.key] = values[p.key]?.local || '';
        }
        setDrafts(next);
    }, [values]);

    const save = (key) => {
        dispatch(setCustomerParam({ name: key, value: drafts[key] || '' }))
            .unwrap()
            .then(() => {
                dispatch(bumpCustomerConfigVersion());
            })
            .catch(() => {});
    };

    return (
        <div className={classes.LookupCard}>
            <div className={classes.LookupCardHeader}>
                <h3 className={classes.LookupCardTitle}>
                    <FontAwesomeIcon icon={faDisplay} />
                    Customer Display Settings (this store)
                </h3>
                <div className={classes.LookupCardActions}>
                    <button
                        className={`${classes.PillBtn} ${classes.PillBtnGhost} ${classes.PillBtnSmall}`}
                        onClick={() => dispatch(fetchCustomerParams())}
                    >
                        <span className={classes.PillBtnIcon}><FontAwesomeIcon icon={faArrowsRotate} /></span>
                        Reload
                    </button>
                </div>
            </div>

            <div className={classes.LookupCardBody}>
                {PARAMS.map((p) => {
                    const info = values[p.key] || {};
                    const source = info.source || 'ho';
                    return (
                        <div key={p.key} className={classes.ParamRow}>
                            <div className={classes.ParamRowLabel}>
                                <span className={classes.ParamRowLabelTitle}>{p.title}</span>
                                <span className={classes.ParamRowLabelHint}>{p.hint}</span>
                                <span
                                    className={`${classes.ParamRowSource} ${source === 'local' ? classes.ParamRowSourceLocal : classes.ParamRowSourceHo}`}
                                    title={source === 'local'
                                        ? 'Using local override'
                                        : 'No local override — falling back to head-office value'}
                                >
                                    {source === 'local' ? 'Local Override' : 'Head Office'}
                                </span>
                            </div>
                            <textarea
                                className={classes.ParamRowInput}
                                placeholder={p.placeholder}
                                value={drafts[p.key] ?? ''}
                                onChange={(e) => setDrafts((d) => ({ ...d, [p.key]: e.target.value }))}
                            />
                            <div>
                                <button
                                    className={`${classes.PillBtn} ${classes.PillBtnDanger} ${classes.PillBtnSmall}`}
                                    onClick={() => save(p.key)}
                                    disabled={saving}
                                >
                                    <span className={classes.PillBtnIcon}><FontAwesomeIcon icon={faFloppyDisk} /></span>
                                    Save
                                </button>
                            </div>
                        </div>
                    );
                })}

                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 10 }}>
                    Saving will only update this store's local values. Customer screens refresh on save.
                </div>
            </div>
        </div>
    );
};

export default CustomerParamsPanel;
