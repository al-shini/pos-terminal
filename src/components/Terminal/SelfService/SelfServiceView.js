import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBan, faLeaf, faSackDollar, faKeyboard, faUserShield,
    faLock, faArrowRightFromBracket, faTimes, faLockOpen, faTag,
    faLayerGroup, faIdCard, faStar, faPause, faPlay, faArrowRotateRight,
    faCreditCard
} from '@fortawesome/free-solid-svg-icons';
import classes from './SelfServiceView.module.css';
import config from '../../../config';
import axios from '../../../axios';
import Logo from '../../../assets/full-logo.png';
import AnimatedBarcode from './AnimatedBarcode';
import noBarcodeImg from '../../../assets/self-service/no-barcode.png';
import SelfServiceGuide from './SelfServiceGuide';
import SelfServiceCart from './SelfServiceCart';
import SelfServiceLastScan from './SelfServiceLastScan';
import SelfServiceAdsCarousel from './SelfServiceAdsCarousel';
import SelfServiceScalePanel from './SelfServiceScalePanel';
import SelfServicePayModal from './SelfServicePayModal';
import SelfServiceCashDroScreen from './SelfServiceCashDroScreen';
import SelfServiceCashHeldScreen from './SelfServiceCashHeldScreen';
import SelfServiceVisaScreen from './SelfServiceVisaScreen';
import SelfServiceBopPanel from './SelfServiceBopPanel';
import SelfServiceReceiptScreen from './SelfServiceReceiptScreen';
import SelfServiceKeypad from './SelfServiceKeypad';
import SelfServiceScanError from './SelfServiceScanError';
import SelfServiceQtyPicker from './SelfServiceQtyPicker';
import SelfServiceVoice from './SelfServiceVoice';
import TouchKeyboard from '../../UI/TouchKeyboard';
import BalanceSetup from '../BalanceSetup';
import { scanBarcode, scanNewTransaction, prepareScanMultiplierPreDefined } from '../../../store/trxSlice';
import { unlockTill, resetCustomer, fetchSuspendedForTill } from '../../../store/terminalSlice';
import { notify } from '../../../store/uiSlice';
import { roundToCashDro } from '../../../utils/cashRounding';
import AR from './i18n';

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
    topScaleBarcodes,
    images,
    scaleConnected,
    cashDroModalOpen,
    cashDroStatus,
    showReceipt,
    onDeleteLine,
    onCancelOrder,
    onPayCash,
    onCancelPayment,
    onPayVisa,
    onCancelVisaPayment,
    // Set when CashDro took cash that could not be recorded on the sale. While
    // set, nothing else on the lane is reachable — see the render below.
    cashHeld,
    onClearCashHeld,
    authQR,
    // Set only while a linked BOP card reader is running a sale; when null the
    // Visa tender falls back to the supervisor-QR approval flow.
    cardTerminal,
    onClearCardTerminalSale,
    onScanWeightable,
    onReceiptDone,
    onLockTill,
    onLogout,
}) => {
    const terminal = useSelector((state) => state.terminal);
    const trxSlice = useSelector((state) => state.trx);
    const dispatch = useDispatch();

    const [payOpen, setPayOpen] = useState(false);
    const [cashStarting, setCashStarting] = useState(false);
    const [visaOpen, setVisaOpen] = useState(false);
    const [scaleOpen, setScaleOpen] = useState(false);
    const [keypadOpen, setKeypadOpen] = useState(false);
    const [qtyOpen, setQtyOpen] = useState(false);
    const [staffPwOpen, setStaffPwOpen] = useState(false);
    const [staffPassword, setStaffPassword] = useState('');
    const [staffVerifying, setStaffVerifying] = useState(false);
    const [staffMenuOpen, setStaffMenuOpen] = useState(false);
    const [staffIntent, setStaffIntent] = useState('menu'); // 'menu' | 'unlock' | 'clearCardSale' | 'clearCashHeld'
    // [suspended-orders] Lets staff peek at / resume suspended transactions
    // (including ones auto-suspended by the backend when a stale open+
    // customer trx blocked a new scan) right from the same panel that
    // already has lock-till / logout, without leaving self-service mode.
    const [suspendedPanelOpen, setSuspendedPanelOpen] = useState(false);
    // Card-reader pairing, reached from the same staff menu.
    const [bopPanelOpen, setBopPanelOpen] = useState(false);

    // Payment succeeded (receipt screen incoming) — drop the Visa QR overlay
    // so it doesn't linger underneath / re-show after the receipt is
    // dismissed. Declared before the balance-setup early return below so
    // hook call order stays stable across renders.
    useEffect(() => {
        if (showReceipt) {
            setVisaOpen(false);
        }
    }, [showReceipt]);

    // The cash machine's screen has taken over, so the tender choice behind it
    // is done with. Dropping it here (rather than on the tap) is what lets the
    // modal cover the gap while the session is being opened.
    useEffect(() => {
        if (cashDroModalOpen) {
            setPayOpen(false);
        }
    }, [cashDroModalOpen]);

    // Loyalty/club card attached — toast once per card (rising edge only, so
    // it doesn't re-fire on unrelated re-renders while the same card stays
    // attached for the rest of the basket).
    const lastClubKeyRef = useRef(null);
    useEffect(() => {
        const isClub = !!(terminal.customer && terminal.customer.club);
        const key = isClub ? terminal.customer.key : null;
        if (isClub && key !== lastClubKeyRef.current) {
            dispatch(notify({ msg: AR.cardRecognized, sev: 'success' }));
        }
        lastClubKeyRef.current = key;
    }, [terminal.customer, dispatch]);

    const handleDetachCustomer = () => {
        dispatch(resetCustomer());
        dispatch(notify({ msg: AR.customerRemoved, sev: 'info' }));
    };

    const activeItems = useMemo(
        () => (trxSlice.scannedItems || []).filter((i) => !i.voided),
        [trxSlice.scannedItems]
    );
    const hasItems = activeItems.length > 0;
    const amountDue = trxSlice.trx
        ? Math.max(0, (trxSlice.trx.totalafterdiscount || 0) - (trxSlice.trxPaid || 0))
        : 0;
    const total = trxSlice.trx ? (trxSlice.trx.totalafterdiscount || 0) : 0;
    const totalSaved = useMemo(
        () =>
            activeItems.reduce((sum, i) => {
                const saved =
                    i.finalprice != null && i.finalprice < i.totalprice
                        ? i.totalprice - i.finalprice
                        : 0;
                return sum + saved;
            }, 0),
        [activeItems]
    );

    // Till still needs opening balance — reuse the existing BalanceSetup UI.
    if (terminal.display === 'balance-setup') {
        return (
            <div className={classes.Shell} dir="rtl">
                <div className={classes.Header}>
                    <div className={classes.HeaderBrand}>
                        <img src={Logo} alt="Shini" className={classes.HeaderLogo} />
                        <div className={classes.HeaderTitles}>
                            <h1 className={classes.HeaderTitle}>{AR.selfCheckout}</h1>
                            <div className={classes.HeaderHint}>{AR.tillSetupRequired}</div>
                        </div>
                    </div>
                </div>
                <div style={{ flex: 1, padding: 24 }} dir="ltr">
                    <BalanceSetup />
                </div>
            </div>
        );
    }

    // Quantity multiplier — armed for the NEXT scan, auto-resets after it lands.
    const armedQty = Number(trxSlice.multiplier) > 1 ? Number(trxSlice.multiplier) : 0;

    const handleQtyConfirm = (n) => {
        dispatch(prepareScanMultiplierPreDefined(String(n)));
        setQtyOpen(false);
    };

    const handleQtyReset = () => {
        dispatch(prepareScanMultiplierPreDefined('1'));
    };

    const qtyArmedChip = armedQty > 0 && (
        <div className={classes.QtyArmedChip} dir="rtl">
            <FontAwesomeIcon icon={faLayerGroup} />
            {AR.qtyArmed(armedQty)}
            <button
                type="button"
                className={classes.QtyArmedCancel}
                onClick={handleQtyReset}
                title={AR.qtyCancelArmed}
            >
                <FontAwesomeIcon icon={faTimes} />
            </button>
        </div>
    );

    const openPay = () => {
        if (!hasItems || !trxSlice.trx) return;
        // Safety: an armed qty-multiplier is only meant for the NEXT scan —
        // never let it leak into the payment amount (submitPayment multiplies
        // amount by trxSlice.multiplier for both cash and manual-Visa).
        if (Number(trxSlice.multiplier) > 1) {
            dispatch(prepareScanMultiplierPreDefined('1'));
        }
        setPayOpen(true);
    };

    // Self-service settles a sale with exactly one tender: all cash through
    // CashDro, or all card through the BOP reader. Both handlers therefore take
    // no amount — the tender always covers the entire outstanding balance.
    // Opening a CashDro session is a round trip to the server and then to the
    // machine. Closing the pay modal on the tap left the bare cart on screen
    // for the whole of it, which looks like the kiosk dropped the request —
    // so the modal stays up in a busy state and the cash screen replaces it
    // when it is actually ready. If the session never starts (machine not
    // configured, server refused) the customer is left looking at the tenders
    // again rather than at a cart that silently ignored them.
    const handleCash = () => {
        if (cashStarting) {
            return;
        }
        setCashStarting(true);
        Promise.resolve(onPayCash ? onPayCash() : null)
            .finally(() => setCashStarting(false));
    };

    const handleVisa = () => {
        setPayOpen(false);
        setVisaOpen(true);
        if (onPayVisa) onPayVisa();
    };

    const handleCancelPayModal = () => {
        setPayOpen(false);
    };

    const handleCancelCashDro = () => {
        if (onCancelPayment) onCancelPayment();
    };

    const handleCancelVisa = () => {
        setVisaOpen(false);
        if (onCancelVisaPayment) onCancelVisaPayment();
    };

    const handleManualBarcode = (typedValue) => {
        if (terminal.paymentMode) {
            dispatch(notify({
                msg: AR.finishOrCancelPayment,
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
            } else if (staffIntent === 'clearCardSale') {
                // Only a verified staff member can dismiss an indeterminate
                // card sale, since clearing it means they have checked the
                // reader and know whether the card was actually charged.
                setVisaOpen(false);
                if (onClearCardTerminalSale) onClearCardTerminalSale();
            } else if (staffIntent === 'clearCashHeld') {
                // Same reasoning for cash the machine took but the sale never
                // recorded: clearing it asserts a human has reconciled it.
                if (onClearCashHeld) onClearCashHeld();
            } else {
                setStaffMenuOpen(true);
            }
        }).catch((error) => {
            setStaffVerifying(false);
            setStaffPassword('');
            const msg = error && error.response && error.response.status === 401
                ? AR.incorrectPassword
                : AR.couldNotVerify;
            dispatch(notify({ msg, sev: 'error' }));
        });
    };

    const openSuspendedPanel = () => {
        setStaffMenuOpen(false);
        dispatch(fetchSuspendedForTill());
        setSuspendedPanelOpen(true);
    };

    const handleResumeSuspended = (obj) => {
        if (trxSlice.trx) return; // guard — resuming would clobber an active basket
        dispatch(scanNewTransaction({
            customerKey: null,
            barcode: 'SUS-' + obj.nanoId,
            trxKey: null,
            trxMode: terminal.trxMode || 'Sale',
            tillKey: terminal.till ? terminal.till.key : null,
            multiplier: '1'
        }));
        setSuspendedPanelOpen(false);
    };

    const handleRestart = () => {
        window.location.reload();
    };

    return (
        <div className={classes.Shell} dir="rtl">
            <header className={classes.Header}>
                <div className={classes.HeaderBrand}>
                    <img src={Logo} alt="Shini" className={classes.HeaderLogo} />
                    <div className={classes.HeaderTitles}>
                        <h1 className={classes.HeaderTitle}>{AR.selfCheckout}</h1>
                    </div>
                </div>
                <div className={classes.HeaderRight}>
                    {terminal.customer && terminal.customer.club && (
                        <div className={classes.CustomerChip} dir="rtl">
                            <FontAwesomeIcon icon={faIdCard} className={classes.CustomerChipIcon} />
                            <span className={classes.CustomerChipName}>
                                {terminal.customer.customerName || AR.clubMember}
                            </span>
                            <span className={classes.CustomerChipBadge}>
                                <FontAwesomeIcon icon={faStar} />
                                {AR.club}
                                {terminal.customer.employee && (
                                    <b className={classes.CustomerChipEmployee}>{AR.employeeTag}</b>
                                )}
                            </span>
                            {config.features.spendCampaign
                                && trxSlice.trx
                                && trxSlice.trx.campaignSnapshot
                                && trxSlice.trx.campaignSnapshot.active && (
                                <span className={classes.CustomerChipBadge} style={{
                                    background: Number(trxSlice.trx.campaignSnapshot.eligibleDiscount) > 0
                                        ? 'rgba(22,163,74,0.15)' : 'rgba(245,158,11,0.15)',
                                    color: '#92400e',
                                    marginRight: 4,
                                }}>
                                    {Number(trxSlice.trx.campaignSnapshot.cumulativeAmt || 0).toFixed(0)} {config.currencySymbol}
                                    {Number(trxSlice.trx.campaignSnapshot.eligibleDiscount) > 0
                                        ? ` · ${Number(trxSlice.trx.campaignSnapshot.eligibleDiscount)} خصم`
                                        : ''}
                                </span>
                            )}
                            <button
                                type="button"
                                className={classes.CustomerChipRemove}
                                title={AR.removeCustomer}
                                aria-label={AR.removeCustomer}
                                onClick={handleDetachCustomer}
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>
                    )}
                    {terminal.loggedInUser && (
                        <div className={classes.HeaderHint}>
                            {terminal.store ? terminal.store.description : ''} · {AR.ready}
                        </div>
                    )}
                    <button
                        type="button"
                        className={classes.StaffBtn}
                        title={AR.staffAccess}
                        onClick={() => { setStaffIntent('menu'); setStaffPwOpen(true); }}
                    >
                        <FontAwesomeIcon icon={faUserShield} />
                    </button>
                </div>
            </header>

            {terminal.blockActions && (
                <div className={classes.Overlay} style={{ zIndex: 2600 }} dir="rtl">
                    <div className={`${classes.OverlayPanel} ${classes.StaffMenuPanel}`}>
                        <h2 className={classes.OverlayTitle}>
                            <FontAwesomeIcon icon={faLock} style={{ marginLeft: 10, color: '#E32521' }} />
                            {AR.terminalLocked}
                        </h2>
                        <p className={classes.OverlaySubtitle}>{AR.askStaffUnlock}</p>

                        <div className={classes.StaffMenuActions}>
                            <button
                                type="button"
                                className={classes.StaffMenuBtn}
                                onClick={() => { setStaffIntent('unlock'); setStaffPwOpen(true); }}
                            >
                                <FontAwesomeIcon icon={faLockOpen} />
                                {AR.staffUnlock}
                            </button>
                            <button
                                type="button"
                                className={classes.StaffMenuBtn}
                                onClick={() => onLogout && onLogout()}
                            >
                                <FontAwesomeIcon icon={faArrowRightFromBracket} />
                                {AR.signOut}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!hasItems && !showReceipt ? (
                <>
                    <div className={classes.IdleShell}>
                        <div className={classes.IdleGrid}>
                            <div className={classes.IdleMainCard}>
                                <AnimatedBarcode />
                                <h2 className={classes.IdleMainTitle}>{AR.scanToBegin}</h2>
                                <p className={classes.IdleMainHint}>{AR.pointScanner}</p>
                                {qtyArmedChip}
                            </div>

                            <div className={classes.IdleSideCards}>
                                {config.scale && (
                                    <div className={classes.IdleSideCard}>
                                        <div className={classes.IdleSideCardTitle}>{AR.fruitsVeg}</div>
                                        <button
                                            type="button"
                                            className={classes.IdleSideBtn}
                                            onClick={() => setScaleOpen(true)}
                                        >
                                            <FontAwesomeIcon icon={faLeaf} />
                                            {AR.chooseFromList}
                                        </button>
                                    </div>
                                )}
                                <div className={classes.IdleSideCard}>
                                    <img src={noBarcodeImg} alt="" className={classes.IdleSideImg} />
                                    <div className={classes.IdleSideCardTitle}>{AR.noBarcode}</div>
                                    <button
                                        type="button"
                                        className={classes.IdleSideBtn}
                                        onClick={() => setKeypadOpen(true)}
                                    >
                                        <FontAwesomeIcon icon={faKeyboard} />
                                        {AR.typeBarcode}
                                    </button>
                                </div>
                                <div className={classes.IdleSideCard}>
                                    <div className={classes.IdleSideCardTitle}>{AR.multipleItems}</div>
                                    <button
                                        type="button"
                                        className={classes.IdleSideBtn}
                                        onClick={() => setQtyOpen(true)}
                                    >
                                        <FontAwesomeIcon icon={faLayerGroup} />
                                        {AR.setQty}
                                    </button>
                                </div>
                            </div>
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
                        <div className={classes.BodyColumns}>
                            <div className={classes.InvoicePanel}>
                                <SelfServiceCart onDeleteLine={onDeleteLine} />
                            </div>

                            <aside className={classes.ActionCol}>
                                <SelfServiceLastScan />

                                <SelfServiceAdsCarousel />

                                {qtyArmedChip}

                                {config.scale && (
                                    <button
                                        type="button"
                                        className={classes.ScaleEntryBtn}
                                        disabled={terminal.paymentMode || cashDroModalOpen}
                                        onClick={() => setScaleOpen(true)}
                                    >
                                        <FontAwesomeIcon icon={faLeaf} />
                                        {AR.fruitsVeg}
                                    </button>
                                )}

                                <div className={classes.ActionRow}>
                                    <button
                                        type="button"
                                        className={`${classes.ActionBtn} ${classes.ActionBtnKeypad}`}
                                        disabled={terminal.paymentMode || cashDroModalOpen}
                                        onClick={() => setQtyOpen(true)}
                                        title={AR.qtyTitle}
                                    >
                                        <FontAwesomeIcon icon={faLayerGroup} />
                                        {AR.qty}
                                    </button>
                                    <button
                                        type="button"
                                        className={`${classes.ActionBtn} ${classes.ActionBtnKeypad}`}
                                        disabled={terminal.paymentMode || cashDroModalOpen}
                                        onClick={() => setKeypadOpen(true)}
                                    >
                                        <FontAwesomeIcon icon={faKeyboard} />
                                        {AR.typeBarcode}
                                    </button>
                                    <button
                                        type="button"
                                        className={`${classes.ActionBtn} ${classes.ActionBtnCancel}`}
                                        disabled={!trxSlice.trx || terminal.paymentMode || cashDroModalOpen}
                                        onClick={onCancelOrder}
                                        title={AR.cancelOrder}
                                    >
                                        <FontAwesomeIcon icon={faBan} />
                                        {AR.cancel}
                                    </button>
                                </div>
                            </aside>
                        </div>

                        {/* Bottom bar: total under the invoice column, pay under the ads column */}
                        <div className={classes.BottomBar}>
                            <div className={classes.InvoiceTotalBar}>
                                <span className={classes.InvoiceTotalLabel}>{AR.total}</span>
                                <div className={classes.InvoiceTotalLine}>
                                    <span className={classes.InvoiceTotalValue} dir="ltr">
                                        {config.currencySymbol} {fmt(total)}
                                    </span>
                                    {totalSaved > 0 && (
                                        <span className={classes.InvoiceSavedPill} dir="rtl">
                                            <FontAwesomeIcon icon={faTag} />
                                            {AR.youSaved}
                                            <span dir="ltr">{config.currencySymbol} {fmt(totalSaved)}</span>
                                        </span>
                                    )}
                                    <span className={classes.InvoiceCountText}>
                                        {AR.itemCount}: {activeItems.length}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                className={classes.BtnPayBig}
                                disabled={!hasItems || !trxSlice.trx || cashDroModalOpen}
                                onClick={openPay}
                            >
                                <FontAwesomeIcon icon={faSackDollar} />
                                {AR.pay}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Arabic barcode-not-recognized overlay (replaces the App.js backdrop) */}
            <SelfServiceScanError />

            {/* Voice guidance — plays a prompt on each checkout state transition */}
            <SelfServiceVoice
                itemCount={activeItems.length}
                payOpen={payOpen}
                cashDroOpen={cashDroModalOpen}
                showReceipt={showReceipt}
            />

            {qtyOpen && (
                <SelfServiceQtyPicker
                    initial={armedQty || 1}
                    onConfirm={handleQtyConfirm}
                    onCancel={() => setQtyOpen(false)}
                />
            )}

            {payOpen && !cashDroModalOpen && !showReceipt && !cashHeld && (
                <SelfServicePayModal
                    amountDue={amountDue > 0 ? amountDue : total}
                    onCash={handleCash}
                    onVisa={handleVisa}
                    onCancel={handleCancelPayModal}
                    cashStarting={cashStarting}
                    cardTerminalLinked={!!(terminal.terminal && terminal.terminal.bopVisaIp)}
                />
            )}

            {cashDroModalOpen && !cashHeld && (
                <SelfServiceCashDroScreen
                    amountDue={roundToCashDro(
                        (cashDroStatus && cashDroStatus.targetAmount != null)
                            ? cashDroStatus.targetAmount
                            : (amountDue > 0 ? amountDue : total)
                    )}
                    cashDroStatus={cashDroStatus}
                    onCancel={handleCancelCashDro}
                />
            )}

            {visaOpen && !showReceipt && !cashHeld && (
                <SelfServiceVisaScreen
                    authQR={authQR && authQR.source === 'SelfServiceVisa' ? authQR : null}
                    amountDue={
                        cardTerminal && cardTerminal.chargeAmount != null
                            ? cardTerminal.chargeAmount
                            : (authQR && authQR.source === 'SelfServiceVisa' && authQR.chargeAmount != null)
                                ? authQR.chargeAmount
                                : (amountDue > 0 ? amountDue : total)
                    }
                    onCancel={handleCancelVisa}
                    cardTerminal={cardTerminal}
                    onStaffOverride={() => { setStaffIntent('clearCardSale'); setStaffPwOpen(true); }}
                />
            )}

            {showReceipt && !cashHeld && (
                <SelfServiceReceiptScreen
                    lastPayment={trxSlice.lastTrxPayment}
                    onDone={onReceiptDone}
                />
            )}

            {/* Rendered last so it paints over every other overlay: the store is
                holding this customer's cash against a sale that never settled,
                and the lane must not accept anything else until staff clear it. */}
            {cashHeld && (
                <SelfServiceCashHeldScreen
                    amount={cashHeld.amount}
                    cashdroId={cashHeld.cashdroId}
                    outcome={cashHeld.outcome}
                    onStaffOverride={() => { setStaffIntent('clearCashHeld'); setStaffPwOpen(true); }}
                />
            )}

            {keypadOpen && (
                <SelfServiceKeypad
                    onSubmit={handleManualBarcode}
                    onCancel={() => setKeypadOpen(false)}
                />
            )}

            {scaleOpen && config.scale && (
                <SelfServiceScalePanel
                    produceItems={produceItems}
                    otherScaleItems={otherScaleItems}
                    topScaleBarcodes={topScaleBarcodes}
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
                title={AR.staffAccess}
                subtitle={terminal.loggedInUser ? AR.enterPasswordFor(terminal.loggedInUser.username) : AR.enterCashierPassword}
                value={staffPassword}
                onChange={setStaffPassword}
                onClose={closeStaffPrompt}
                onSubmit={handleStaffVerify}
                mask
                submitLabel={staffVerifying ? AR.checking : AR.unlock}
            />

            {staffMenuOpen && (
                <div className={classes.Overlay} dir="rtl">
                    <div className={`${classes.OverlayPanel} ${classes.StaffMenuPanel}`}>
                        <h2 className={classes.OverlayTitle}>
                            <FontAwesomeIcon icon={faUserShield} style={{ marginLeft: 10, color: '#E32521' }} />
                            {AR.staffMenu}
                        </h2>
                        <p className={classes.OverlaySubtitle}>{AR.chooseAction}</p>

                        <div className={classes.StaffMenuActions}>
                            <button
                                type="button"
                                className={classes.StaffMenuBtn}
                                onClick={() => { setStaffMenuOpen(false); if (onLockTill) onLockTill(); }}
                            >
                                <FontAwesomeIcon icon={faLock} />
                                {AR.lockTill}
                            </button>
                            <button
                                type="button"
                                className={classes.StaffMenuBtn}
                                onClick={() => { setStaffMenuOpen(false); if (onLogout) onLogout(); }}
                            >
                                <FontAwesomeIcon icon={faArrowRightFromBracket} />
                                {AR.logout}
                            </button>
                            <button
                                type="button"
                                className={classes.StaffMenuBtn}
                                onClick={openSuspendedPanel}
                            >
                                <FontAwesomeIcon icon={faPause} />
                                {AR.suspendedOrders}
                            </button>
                            <button
                                type="button"
                                className={classes.StaffMenuBtn}
                                onClick={() => { setStaffMenuOpen(false); setBopPanelOpen(true); }}
                            >
                                <FontAwesomeIcon icon={faCreditCard} />
                                {AR.cardTerminalSetup}
                            </button>
                            <button
                                type="button"
                                className={classes.StaffMenuBtn}
                                onClick={handleRestart}
                            >
                                <FontAwesomeIcon icon={faArrowRotateRight} />
                                {AR.restart}
                            </button>
                        </div>

                        <button
                            type="button"
                            className={classes.OverlayCancel}
                            onClick={() => setStaffMenuOpen(false)}
                        >
                            <FontAwesomeIcon icon={faTimes} />
                            {AR.close}
                        </button>
                    </div>
                </div>
            )}

            {bopPanelOpen && (
                <SelfServiceBopPanel onClose={() => setBopPanelOpen(false)} />
            )}

            {suspendedPanelOpen && (
                <div className={classes.Overlay} dir="rtl">
                    <div className={`${classes.OverlayPanel} ${classes.StaffMenuPanel} ${classes.SuspendedPanel}`}>
                        <h2 className={classes.OverlayTitle}>
                            <FontAwesomeIcon icon={faPause} style={{ marginLeft: 10, color: '#E32521' }} />
                            {AR.suspendedOrders}
                        </h2>
                        <p className={classes.OverlaySubtitle}>{AR.suspendedOrdersSubtitle}</p>

                        {trxSlice.trx && (
                            <div className={classes.SuspendedBlockedHint}>{AR.suspendedFinishCurrentFirst}</div>
                        )}

                        <div className={classes.SuspendedList}>
                            {(!terminal.suspendedForTill || terminal.suspendedForTill.length === 0) && (
                                <div className={classes.SuspendedEmpty}>{AR.suspendedEmpty}</div>
                            )}
                            {(terminal.suspendedForTill || []).map((obj) => (
                                <button
                                    key={obj.key || obj.nanoId}
                                    type="button"
                                    className={classes.SuspendedItem}
                                    disabled={!!trxSlice.trx}
                                    onClick={() => handleResumeSuspended(obj)}
                                >
                                    <span className={classes.SuspendedItemAmount}>
                                        {config.currencySymbol} {fmt(obj.totalafterdiscount)}
                                    </span>
                                    <span className={classes.SuspendedItemMeta}>
                                        {obj.createdAt ? AR.suspendedAt(new Date(Number(obj.createdAt)).toLocaleTimeString()) : ''}
                                    </span>
                                    <span className={classes.SuspendedItemResume}>
                                        <FontAwesomeIcon icon={faPlay} />
                                        {AR.resume}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            className={classes.OverlayCancel}
                            onClick={() => setSuspendedPanelOpen(false)}
                        >
                            <FontAwesomeIcon icon={faTimes} />
                            {AR.close}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SelfServiceView;

