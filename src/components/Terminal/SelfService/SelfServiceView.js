import React, { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBan, faLeaf, faSackDollar, faBarcode, faKeyboard, faUserShield,
    faLock, faArrowRightFromBracket, faTimes, faLockOpen
} from '@fortawesome/free-solid-svg-icons';
import classes from './SelfServiceView.module.css';
import config from '../../../config';
import axios from '../../../axios';
import Logo from '../../../assets/full-logo.png';
import SelfServiceGuide from './SelfServiceGuide';
import SelfServiceCart from './SelfServiceCart';
import SelfServiceScalePanel from './SelfServiceScalePanel';
import SelfServicePayModal from './SelfServicePayModal';
import SelfServiceCashDroScreen from './SelfServiceCashDroScreen';
import SelfServiceReceiptScreen from './SelfServiceReceiptScreen';
import SelfServiceKeypad from './SelfServiceKeypad';
import TouchKeyboard from '../../UI/TouchKeyboard';
import BalanceSetup from '../BalanceSetup';
import { scanBarcode, scanNewTransaction } from '../../../store/trxSlice';
import { unlockTill } from '../../../store/terminalSlice';
import { notify } from '../../../store/uiSlice';

const fmt = (n) => (((Number(n) || 0) * 100) / 100).toFixed(config.decimals);

/**
 * Customer-facing self-checkout shell.
 *
 * All transaction / CashDro logic lives in Terminal.js — this component only
 * owns local UI state (pay modal, scale panel, receipt dismiss) and renders
 * large touch-friendly controls. Cashier-mode Terminal UI is never mounted
 * when this view is active.
 */
const SelfServiceView = ({
    produceItems,
    otherScaleItems,
    images,
    scaleConnected,
    cashDroModalOpen,
    cashDroStatus,
    showReceipt,
    onDeleteLine,
    onCancelOrder,
    onPayCash,
    onCancelPayment,
    onScanWeightable,
    onReceiptDone,
    onLockTill,
    onLogout,
}) => {
    const terminal = useSelector((state) => state.terminal);
    const trxSlice = useSelector((state) => state.trx);
    const dispatch = useDispatch();

    const [payOpen, setPayOpen] = useState(false);
    const [scaleOpen, setScaleOpen] = useState(false);
    const [keypadOpen, setKeypadOpen] = useState(false);
    const [staffPwOpen, setStaffPwOpen] = useState(false);
    const [staffPassword, setStaffPassword] = useState('');
    const [staffVerifying, setStaffVerifying] = useState(false);
    const [staffMenuOpen, setStaffMenuOpen] = useState(false);
    const [staffIntent, setStaffIntent] = useState('menu'); // 'menu' | 'unlock'

    const activeItems = useMemo(
        () => (trxSlice.scannedItems || []).filter((i) => !i.voided),
        [trxSlice.scannedItems]
    );
    const hasItems = activeItems.length > 0;
    const amountDue = trxSlice.trx
        ? Math.max(0, (trxSlice.trx.totalafterdiscount || 0) - (trxSlice.trxPaid || 0))
        : 0;
    const total = trxSlice.trx ? (trxSlice.trx.totalafterdiscount || 0) : 0;

    // Till still needs opening balance — reuse the existing BalanceSetup UI.
    if (terminal.display === 'balance-setup') {
        return (
            <div className={classes.Shell}>
                <div className={classes.Header}>
                    <div className={classes.HeaderBrand}>
                        <img src={Logo} alt="Shini" className={classes.HeaderLogo} />
                        <div className={classes.HeaderTitles}>
                            <h1 className={classes.HeaderTitle}>Self Checkout</h1>
                            <div className={classes.HeaderHint}>Till setup required</div>
                        </div>
                    </div>
                </div>
                <div style={{ flex: 1, padding: 24 }}>
                    <BalanceSetup />
                </div>
            </div>
        );
    }

    const openPay = () => {
        if (!hasItems || !trxSlice.trx) return;
        setPayOpen(true);
    };

    const handleCash = () => {
        setPayOpen(false);
        if (onPayCash) onPayCash();
    };

    const handleCancelPayModal = () => {
        setPayOpen(false);
    };

    const handleCancelCashDro = () => {
        if (onCancelPayment) onCancelPayment();
    };

    const handleManualBarcode = (typedValue) => {
        if (terminal.paymentMode) {
            dispatch(notify({
                msg: 'Finish or cancel payment before adding more items',
                sev: 'warning'
            }));
            return;
        }
        setKeypadOpen(false);
        if (trxSlice.trx && trxSlice.trx.key) {
            dispatch(scanBarcode({
                customerKey: terminal.customer ? terminal.customer.key : null,
                barcode: typedValue,
                trxKey: trxSlice.trx.key,
                trxMode: terminal.trxMode || 'Sale',
                tillKey: terminal.till ? terminal.till.key : null,
                multiplier: trxSlice.multiplier ? trxSlice.multiplier : '1'
            }));
        } else {
            dispatch(scanNewTransaction({
                customerKey: terminal.customer ? terminal.customer.key : null,
                barcode: typedValue,
                trxKey: null,
                trxMode: terminal.trxMode || 'Sale',
                tillKey: terminal.till ? terminal.till.key : null,
                multiplier: trxSlice.multiplier ? trxSlice.multiplier : '1'
            }));
        }
    };

    const closeStaffPrompt = () => {
        setStaffPwOpen(false);
        setStaffPassword('');
        setStaffVerifying(false);
    };

    const handleStaffVerify = () => {
        if (!staffPassword || !terminal.loggedInUser) return;
        setStaffVerifying(true);
        axios({
            method: 'post',
            url: '/auth/login',
            data: {
                username: terminal.loggedInUser.username,
                password: staffPassword,
                terminalHardwareId: config.deviceId,
            },
        }).then(() => {
            closeStaffPrompt();
            if (staffIntent === 'unlock') {
                dispatch(unlockTill());
            } else {
                setStaffMenuOpen(true);
            }
        }).catch((error) => {
            setStaffVerifying(false);
            setStaffPassword('');
            const msg = error && error.response && error.response.status === 401
                ? 'Incorrect password'
                : 'Could not verify password';
            dispatch(notify({ msg, sev: 'error' }));
        });
    };

    return (
        <div className={classes.Shell}>
            <header className={classes.Header}>
                <div className={classes.HeaderBrand}>
                    <img src={Logo} alt="Shini" className={classes.HeaderLogo} />
                    <div className={classes.HeaderTitles}>
                        <h1 className={classes.HeaderTitle}>Self Checkout</h1>
                    </div>
                </div>
                <div className={classes.HeaderRight}>
                    {terminal.loggedInUser && (
                        <div className={classes.HeaderHint}>
                            {terminal.store ? terminal.store.description : ''} · Ready
                        </div>
                    )}
                    <button
                        type="button"
                        className={classes.StaffBtn}
                        title="Staff access"
                        onClick={() => { setStaffIntent('menu'); setStaffPwOpen(true); }}
                    >
                        <FontAwesomeIcon icon={faUserShield} />
                    </button>
                </div>
            </header>

            {terminal.blockActions && (
                <div className={classes.Overlay} style={{ zIndex: 2600 }}>
                    <div className={`${classes.OverlayPanel} ${classes.StaffMenuPanel}`}>
                        <h2 className={classes.OverlayTitle}>
                            <FontAwesomeIcon icon={faLock} style={{ marginRight: 10, color: '#E11E26' }} />
                            Terminal Locked
                        </h2>
                        <p className={classes.OverlaySubtitle}>Ask a staff member to unlock this till</p>

                        <div className={classes.StaffMenuActions}>
                            <button
                                type="button"
                                className={classes.StaffMenuBtn}
                                onClick={() => { setStaffIntent('unlock'); setStaffPwOpen(true); }}
                            >
                                <FontAwesomeIcon icon={faLockOpen} />
                                Staff Unlock
                            </button>
                            <button
                                type="button"
                                className={classes.StaffMenuBtn}
                                onClick={() => onLogout && onLogout()}
                            >
                                <FontAwesomeIcon icon={faArrowRightFromBracket} />
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!hasItems && !showReceipt ? (
                <>
                    <div className={classes.IdleShell}>
                        <div className={classes.IdleHero}>
                            <div className={classes.IdlePulse}>
                                <span className={classes.IdlePulseRing} aria-hidden />
                                <FontAwesomeIcon icon={faBarcode} className={classes.IdlePulseIcon} />
                                Waiting for scan…
                            </div>
                            <p className={classes.IdleHint}>
                                Point the scanner at a barcode to begin
                            </p>
                        </div>

                        <div className={`${classes.IdleCards} ${!config.scale ? classes.IdleCardsSingle : ''}`}>
                            {config.scale && (
                                <button
                                    type="button"
                                    className={`${classes.IdleCard} ${classes.IdleCardScale}`}
                                    onClick={() => setScaleOpen(true)}
                                >
                                    <span className={classes.IdleCardIcon}>
                                        <FontAwesomeIcon icon={faLeaf} />
                                    </span>
                                    <span className={classes.IdleCardLabel}>Fruits &amp; Veg</span>
                                    <span className={classes.IdleCardNote}>Weigh produce</span>
                                </button>
                            )}
                            <button
                                type="button"
                                className={`${classes.IdleCard} ${classes.IdleCardKeypad}`}
                                onClick={() => setKeypadOpen(true)}
                            >
                                <span className={classes.IdleCardIcon}>
                                    <FontAwesomeIcon icon={faKeyboard} />
                                </span>
                                <span className={classes.IdleCardLabel}>Type barcode</span>
                                <span className={classes.IdleCardNote}>Enter numbers</span>
                            </button>
                        </div>

                        {/* Cart (with BarcodeReader) still mounted so scans start a trx */}
                        <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
                            <SelfServiceCart onDeleteLine={onDeleteLine} />
                        </div>
                    </div>
                    <SelfServiceGuide variant="footer" />
                </>
            ) : (
                <>
                    <div className={classes.Body}>
                        <div className={classes.MainCol}>
                            <SelfServiceCart onDeleteLine={onDeleteLine} onOpenKeypad={() => setKeypadOpen(true)} />
                        </div>
                        <aside className={classes.SideCol}>
                            <SelfServiceGuide variant="side" />
                        </aside>
                    </div>

                    <footer className={classes.Footer}>
                        <div className={classes.TotalBlock}>
                            <div className={classes.TotalLabel}>Total</div>
                            <div className={classes.TotalValue}>
                                {config.currencySymbol} {fmt(total)}
                            </div>
                        </div>

                        <button
                            type="button"
                            className={`${classes.FooterBtn} ${classes.BtnCancel}`}
                            disabled={!trxSlice.trx || terminal.paymentMode || cashDroModalOpen}
                            onClick={onCancelOrder}
                            title="Cancel order"
                        >
                            <FontAwesomeIcon icon={faBan} />
                            Cancel
                        </button>

                        {config.scale && (
                            <button
                                type="button"
                                className={`${classes.FooterBtn} ${classes.BtnScale}`}
                                disabled={terminal.paymentMode || cashDroModalOpen}
                                onClick={() => setScaleOpen(true)}
                            >
                                <FontAwesomeIcon icon={faLeaf} />
                                Scale
                            </button>
                        )}

                        <button
                            type="button"
                            className={`${classes.FooterBtn} ${classes.BtnPay}`}
                            disabled={!hasItems || !trxSlice.trx || cashDroModalOpen}
                            onClick={openPay}
                        >
                            <FontAwesomeIcon icon={faSackDollar} />
                            Pay
                        </button>
                    </footer>
                </>
            )}

            {payOpen && !cashDroModalOpen && !showReceipt && (
                <SelfServicePayModal
                    amountDue={amountDue > 0 ? amountDue : total}
                    onCash={handleCash}
                    onCancel={handleCancelPayModal}
                />
            )}

            {cashDroModalOpen && (
                <SelfServiceCashDroScreen
                    amountDue={amountDue > 0 ? amountDue : total}
                    cashDroStatus={cashDroStatus}
                    onCancel={handleCancelCashDro}
                />
            )}

            {showReceipt && (
                <SelfServiceReceiptScreen
                    lastPayment={trxSlice.lastTrxPayment}
                    onDone={onReceiptDone}
                />
            )}

            {keypadOpen && (
                <SelfServiceKeypad
                    onSubmit={handleManualBarcode}
                    onCancel={() => setKeypadOpen(false)}
                />
            )}

            {scaleOpen && (
                <SelfServiceScalePanel
                    produceItems={produceItems}
                    otherScaleItems={otherScaleItems}
                    images={images}
                    scaleConnected={scaleConnected}
                    onClose={() => setScaleOpen(false)}
                    onPickItem={(item) => {
                        if (onScanWeightable) onScanWeightable(item);
                        setScaleOpen(false);
                    }}
                />
            )}

            <TouchKeyboard
                open={staffPwOpen}
                title="Staff Access"
                subtitle={terminal.loggedInUser ? `Enter password for ${terminal.loggedInUser.username}` : 'Enter your cashier password'}
                value={staffPassword}
                onChange={setStaffPassword}
                onClose={closeStaffPrompt}
                onSubmit={handleStaffVerify}
                mask
                submitLabel={staffVerifying ? 'Checking…' : 'Unlock'}
            />

            {staffMenuOpen && (
                <div className={classes.Overlay}>
                    <div className={`${classes.OverlayPanel} ${classes.StaffMenuPanel}`}>
                        <h2 className={classes.OverlayTitle}>
                            <FontAwesomeIcon icon={faUserShield} style={{ marginRight: 10, color: '#E11E26' }} />
                            Staff Menu
                        </h2>
                        <p className={classes.OverlaySubtitle}>Choose an action</p>

                        <div className={classes.StaffMenuActions}>
                            <button
                                type="button"
                                className={classes.StaffMenuBtn}
                                onClick={() => { setStaffMenuOpen(false); if (onLockTill) onLockTill(); }}
                            >
                                <FontAwesomeIcon icon={faLock} />
                                Lock Till
                            </button>
                            <button
                                type="button"
                                className={classes.StaffMenuBtn}
                                onClick={() => { setStaffMenuOpen(false); if (onLogout) onLogout(); }}
                            >
                                <FontAwesomeIcon icon={faArrowRightFromBracket} />
                                Logout
                            </button>
                        </div>

                        <button
                            type="button"
                            className={classes.OverlayCancel}
                            onClick={() => setStaffMenuOpen(false)}
                        >
                            <FontAwesomeIcon icon={faTimes} />
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SelfServiceView;
