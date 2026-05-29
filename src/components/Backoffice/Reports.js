import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartColumn } from '@fortawesome/free-solid-svg-icons';

import classes from './Admin.module.css';
import config from '../../config';
import AuditPanel from './AuditPanel';
import TopItemsPanel from './TopItemsPanel';
import BroadcastPanel from './BroadcastPanel';
import CustomerParamsPanel from './CustomerParamsPanel';

// Each panel is gated by its own feature flag so a tenant can expose just a
// subset of the Reports tab. The audit / top-items / broadcast panels call
// Jordan-only endpoints, whereas the Customer Display editor only writes to
// the LOCAL store _params, so it can safely be enabled for any tenant whose
// pos-backend exposes /bo/getCustomerParams + /bo/setCustomerParam.
const Reports = () => {
    const features = config.features || {};
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

            {features.adminAudit && <AuditPanel />}
            {features.adminTopItems && (
                <div style={{ marginTop: 18 }}>
                    <TopItemsPanel />
                </div>
            )}
            {features.adminBroadcast && (
                <div style={{ marginTop: 18 }}>
                    <BroadcastPanel />
                </div>
            )}
            {features.adminCustomerParams && (
                <div style={{ marginTop: 18 }}>
                    <CustomerParamsPanel />
                </div>
            )}
        </>
    );
};

export default Reports;
