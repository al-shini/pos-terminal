import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCreditCard, faTimes, faPlug, faLink, faLinkSlash, faSpinner,
    faRotate, faNetworkWired, faCircleCheck, faCircleXmark,
    faTriangleExclamation, faKeyboard
} from '@fortawesome/free-solid-svg-icons';
import classes from './SelfServiceView.module.css';
import axios from '../../../axios';
import config from '../../../config';
import { setTerminal } from '../../../store/terminalSlice';
import { notify } from '../../../store/uiSlice';
import TouchKeyboard from '../../UI/TouchKeyboard';
import AR from './i18n';

const localUrl = (route) => `http://127.0.0.1:${config.expressPort ? config.expressPort : '3001'}${route}`;

const isSerialTarget = (target) => /^(\\\\\.\\)?COM\d+$/i.test(String(target || '').trim());

/**
 * Staff-only setup for the BOP card reader, reachable from the self-service
 * staff menu.
 *
 * The stored `bopVisaIp` doubles as the transport target — a COM port name for
 * a reader on a serial cable, an IP address for a networked one — so this panel
 * only has to decide which of the two the operator is entering.
 *
 * Linking runs a real INIT handshake against the device and replaces the RSA
 * pair held for this station, which is why re-linking an already-linked reader
 * asks for confirmation: the old keys stop working the moment new ones are
 * accepted.
 */
const SelfServiceBopPanel = ({ onClose }) => {
    const terminal = useSelector((state) => state.terminal);
    const dispatch = useDispatch();

    const linkedTarget = (terminal.terminal && terminal.terminal.bopVisaIp) || '';
    const linked = !!linkedTarget;

    const [mode, setMode] = useState(() => (linked && !isSerialTarget(linkedTarget) ? 'network' : 'serial'));
    const [ports, setPorts] = useState([]);
    const [portsLoading, setPortsLoading] = useState(false);
    const [selectedPort, setSelectedPort] = useState(() => (isSerialTarget(linkedTarget) ? linkedTarget : ''));
    const [ip, setIp] = useState(() => (linked && !isSerialTarget(linkedTarget) ? linkedTarget : ''));
    const [ipKeyboardOpen, setIpKeyboardOpen] = useState(false);
    const [busy, setBusy] = useState(null); // null | 'link' | 'unlink' | 'test' | 'probe'
    const [testResult, setTestResult] = useState(null);
    const [confirmRelink, setConfirmRelink] = useState(false);
    // Set when the pre-link probe found nothing on the chosen port. Turns Link
    // into "link anyway" rather than blocking, because the probe reads a silent
    // port as empty and no firmware should be trusted to always answer junk.
    const [noAnswer, setNoAnswer] = useState(false);

    const loadPorts = useCallback(() => {
        setPortsLoading(true);
        axios({ method: 'get', url: localUrl('/bopVisaPorts') })
            .then((response) => {
                const list = (response && response.data && response.data.ports) || [];
                setPorts(list);
                // Pre-select the obvious choice so a single tap on Link is enough.
                setSelectedPort((current) => {
                    if (current && list.some((p) => p.path === current)) return current;
                    if (isSerialTarget(linkedTarget) && list.some((p) => p.path === linkedTarget)) return linkedTarget;
                    // Only ever guess a USB-serial adapter. Bluetooth and
                    // motherboard COM ports are always present and never a
                    // reader, so picking one for the operator would just point
                    // the station at a port that cannot answer.
                    const usbPorts = list.filter((p) => p.usb);
                    return usbPorts.length === 1 ? usbPorts[0].path : '';
                });
            })
            .catch(() => setPorts([]))
            .finally(() => setPortsLoading(false));
    }, [linkedTarget]);

    // Windows drops the COM entry when the adapter is unplugged, so a stored
    // port that is no longer listed is a disconnected cable, not a config error.
    const linkedPortMissing = linked
        && isSerialTarget(linkedTarget)
        && !portsLoading
        && ports.length > 0
        && !ports.some((p) => p.path === linkedTarget);

    useEffect(() => {
        if (mode === 'serial') {
            loadPorts();
        }
    }, [mode, loadPorts]);

    const target = mode === 'serial' ? selectedPort : ip.trim();

    const handleTest = () => {
        if (!target) return;
        setBusy('test');
        setTestResult(null);
        axios({ method: 'post', url: localUrl('/bopVisaStatus'), data: { target } })
            .then((response) => setTestResult(!!(response && response.data && response.data.reachable)))
            .catch(() => setTestResult(false))
            .finally(() => setBusy(null));
    };

    const handleLink = async () => {
        if (!target) return;
        if (linked && !confirmRelink) {
            setConfirmRelink(true);
            return;
        }

        // Probe first. The handshake waits 90 seconds for a reply, which is the
        // right budget for a reader that is thinking but a long time to leave an
        // operator staring at a spinner when the port is simply empty. The probe
        // settles that in about five.
        if (!noAnswer) {
            setBusy('probe');
            setTestResult(null);
            let reachable = null;
            try {
                const probe = await axios({ method: 'post', url: localUrl('/bopVisaStatus'), data: { target } });
                reachable = probe && probe.data ? probe.data.reachable : null;
            } catch (error) {
                reachable = false;
            }
            if (reachable === false) {
                setNoAnswer(true);
                setBusy(null);
                return;
            }
        }

        setBusy('link');
        setTestResult(null);
        axios({
            method: 'post',
            url: localUrl('/linkTerminalWithBopVisa'),
            data: {
                terminalKey: terminal.terminal ? terminal.terminal.key : null,
                bopVisaIp: target
            }
        })
            .then((response) => {
                if (response && response.data && response.data.key) {
                    dispatch(setTerminal(response.data));
                    dispatch(notify({ msg: AR.cardTerminalLinkOk, sev: 'success' }));
                    setConfirmRelink(false);
                    setNoAnswer(false);
                    onClose();
                } else {
                    dispatch(notify({ msg: AR.cardTerminalUnreachable, sev: 'error' }));
                }
            })
            .catch((error) => {
                const data = error.response && error.response.data;
                dispatch(notify({
                    msg: (data && data.error) || (error.response && error.response.data) || error.message,
                    sev: 'error'
                }));
            })
            .finally(() => setBusy(null));
    };

    const handleUnlink = () => {
        setBusy('unlink');
        axios({
            method: 'post',
            url: localUrl('/unlinkTerminalFromBopVisa'),
            data: { terminalKey: terminal.terminal ? terminal.terminal.key : null }
        })
            .then((response) => {
                if (response && response.data && response.data.key) {
                    dispatch(setTerminal(response.data));
                    dispatch(notify({ msg: AR.cardTerminalUnlinkOk, sev: 'info' }));
                    onClose();
                }
            })
            .catch((error) => {
                const data = error.response && error.response.data;
                dispatch(notify({ msg: (data && data.error) || error.message, sev: 'error' }));
            })
            .finally(() => setBusy(null));
    };

    return (
        <div className={classes.Overlay} dir="rtl">
            <div className={`${classes.OverlayPanel} ${classes.StaffMenuPanel} ${classes.BopPanel}`}>
                <h2 className={classes.OverlayTitle}>
                    <FontAwesomeIcon icon={faCreditCard} style={{ marginLeft: 10, color: '#E32521' }} />
                    {AR.cardTerminalSetup}
                </h2>
                <p className={classes.OverlaySubtitle}>{AR.cardTerminalSetupSubtitle}</p>

                <div className={`${classes.BopStatus} ${linked ? classes.BopStatusOk : classes.BopStatusOff}`}>
                    <FontAwesomeIcon icon={linked ? faCircleCheck : faCircleXmark} />
                    <span>{linked ? AR.cardTerminalLinked : AR.cardTerminalUnlinked}</span>
                    {linked && <span className={classes.BopStatusTarget} dir="ltr">{linkedTarget}</span>}
                </div>

                <div className={classes.BopSectionLabel}>{AR.cardTerminalConnection}</div>
                <div className={classes.BopChoiceRow}>
                    <button
                        type="button"
                        className={`${classes.BopChoice} ${mode === 'serial' ? classes.BopChoiceActive : ''}`}
                        onClick={() => { setMode('serial'); setTestResult(null); setNoAnswer(false); }}
                    >
                        <FontAwesomeIcon icon={faPlug} />
                        {AR.cardTerminalSerialPort}
                    </button>
                    <button
                        type="button"
                        className={`${classes.BopChoice} ${mode === 'network' ? classes.BopChoiceActive : ''}`}
                        onClick={() => { setMode('network'); setTestResult(null); setNoAnswer(false); }}
                    >
                        <FontAwesomeIcon icon={faNetworkWired} />
                        {AR.cardTerminalNetwork}
                    </button>
                </div>

                {mode === 'serial' ? (
                    <>
                        <div className={classes.BopPortList}>
                            {portsLoading && (
                                <div className={classes.SuspendedEmpty}>
                                    <FontAwesomeIcon icon={faSpinner} spin />
                                </div>
                            )}
                            {!portsLoading && ports.length === 0 && (
                                <div className={classes.SuspendedEmpty}>{AR.cardTerminalNoPorts}</div>
                            )}
                            {!portsLoading && ports.map((port) => (
                                <button
                                    key={port.path}
                                    type="button"
                                    className={`${classes.BopPortBtn} ${selectedPort === port.path ? classes.BopPortBtnActive : ''}`}
                                    onClick={() => { setSelectedPort(port.path); setTestResult(null); setNoAnswer(false); }}
                                >
                                    <span className={classes.BopPortName} dir="ltr">
                                        <FontAwesomeIcon icon={faPlug} style={{ marginLeft: 8 }} />
                                        {port.path}
                                    </span>
                                    <span className={classes.BopPortMeta} dir="ltr">
                                        {port.friendlyName || port.manufacturer || ''}
                                        {!port.usb && ` — ${AR.cardTerminalPortUnlikely}`}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            className={classes.BopGhostBtn}
                            onClick={loadPorts}
                            disabled={portsLoading}
                        >
                            <FontAwesomeIcon icon={faRotate} spin={portsLoading} />
                            {AR.cardTerminalRefreshPorts}
                        </button>
                    </>
                ) : (
                    <button
                        type="button"
                        className={classes.BopIpField}
                        onClick={() => setIpKeyboardOpen(true)}
                    >
                        <FontAwesomeIcon icon={faKeyboard} />
                        <span dir="ltr">{ip || AR.cardTerminalIpPlaceholder}</span>
                    </button>
                )}

                {linkedPortMissing && (
                    <div className={`${classes.BopHint} ${classes.BopHintBad}`}>
                        <FontAwesomeIcon icon={faTriangleExclamation} />
                        {AR.cardTerminalLinkedPortMissing(linkedTarget)}
                    </div>
                )}

                {testResult !== null && (
                    <div className={`${classes.BopHint} ${testResult ? classes.BopHintOk : classes.BopHintBad}`}>
                        <FontAwesomeIcon icon={testResult ? faCircleCheck : faCircleXmark} />
                        {testResult ? AR.cardTerminalReachable : AR.cardTerminalUnreachable}
                    </div>
                )}

                {noAnswer && (
                    <div className={`${classes.BopHint} ${classes.BopHintBad}`}>
                        <FontAwesomeIcon icon={faCircleXmark} />
                        {AR.cardTerminalNoAnswerOn(target)}
                    </div>
                )}

                {confirmRelink && (
                    <div className={classes.SuspendedBlockedHint}>
                        <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginLeft: 8 }} />
                        {AR.cardTerminalRelinkWarning}
                    </div>
                )}

                {busy === 'probe' && (
                    <div className={classes.BopHint}>
                        <FontAwesomeIcon icon={faSpinner} spin />
                        {AR.cardTerminalProbing}
                    </div>
                )}

                {busy === 'link' && (
                    <div className={classes.BopHint}>
                        <FontAwesomeIcon icon={faSpinner} spin />
                        {AR.cardTerminalLinking}
                    </div>
                )}

                <div className={classes.StaffMenuActions}>
                    <button
                        type="button"
                        className={classes.StaffMenuBtn}
                        onClick={handleTest}
                        disabled={!target || !!busy}
                    >
                        <FontAwesomeIcon icon={busy === 'test' ? faSpinner : faPlug} spin={busy === 'test'} />
                        {busy === 'test' ? AR.cardTerminalTesting : AR.cardTerminalTest}
                    </button>
                    <button
                        type="button"
                        className={`${classes.StaffMenuBtn} ${classes.BopPrimaryBtn}`}
                        onClick={handleLink}
                        disabled={!target || !!busy}
                    >
                        <FontAwesomeIcon
                            icon={(busy === 'link' || busy === 'probe') ? faSpinner : faLink}
                            spin={busy === 'link' || busy === 'probe'}
                        />
                        {noAnswer
                            ? AR.cardTerminalLinkAnyway
                            : (confirmRelink ? AR.cardTerminalConfirmRelink : AR.cardTerminalLink)}
                    </button>
                    {linked && (
                        <button
                            type="button"
                            className={`${classes.StaffMenuBtn} ${classes.BopDangerBtn}`}
                            onClick={handleUnlink}
                            disabled={!!busy}
                        >
                            <FontAwesomeIcon icon={busy === 'unlink' ? faSpinner : faLinkSlash} spin={busy === 'unlink'} />
                            {AR.cardTerminalUnlink}
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    className={classes.OverlayCancel}
                    onClick={onClose}
                    disabled={!!busy}
                >
                    <FontAwesomeIcon icon={faTimes} />
                    {AR.close}
                </button>
            </div>

            <TouchKeyboard
                open={ipKeyboardOpen}
                title={AR.cardTerminalNetwork}
                subtitle={AR.cardTerminalIpPlaceholder}
                value={ip}
                onChange={setIp}
                onClose={() => setIpKeyboardOpen(false)}
                onSubmit={() => { setIpKeyboardOpen(false); setTestResult(null); setNoAnswer(false); }}
                submitLabel={AR.done}
            />
        </div>
    );
};

export default SelfServiceBopPanel;
