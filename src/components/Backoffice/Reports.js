import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartColumn } from '@fortawesome/free-solid-svg-icons';

import classes from './Admin.module.css';
import AuditPanel from './AuditPanel';
import TopItemsPanel from './TopItemsPanel';
import BroadcastPanel from './BroadcastPanel';
import CustomerParamsPanel from './CustomerParamsPanel';

const Reports = () => {
    return (
        <>
            <div className={classes.SectionHeader}>
                <h3 className={classes.SectionTitle}>
                    <span className={classes.SectionTitleIcon}>
                        <FontAwesomeIcon icon={faChartColumn} />
                    </span>
                    Reports &amp; Tools
                </h3>
            </div>

            <AuditPanel />
            <div style={{ marginTop: 18 }}>
                <TopItemsPanel />
            </div>
            <div style={{ marginTop: 18 }}>
                <BroadcastPanel />
            </div>
            <div style={{ marginTop: 18 }}>
                <CustomerParamsPanel />
            </div>
        </>
    );
};

export default Reports;
