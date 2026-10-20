const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser')
const PDFDocument = require('pdfkit');
const { exec } = require("child_process");
const stream = require('./stream');
const qr = require('qrcode');
const { app, BrowserWindow, dialog, screen } = require("electron");
const isDev = require("electron-is-dev");
const { autoUpdater } = require("electron-updater")
const { print } = require("pdf-to-printer");
const { SerialPort, ByteLengthParser } = require('serialport')
const printComplete = require('./printComplete');
const { ReadlineParser } = require('@serialport/parser-readline');
const logger = require('./logger');
const bopVisa = require('./bopVisa');
const arabBankVisa = require('./arabBankVisa');
const { ipcMain } = require('electron');
const https = require('https');
const os = require('os');

// Local terminal configuration. Missing/corrupt files no longer crash the
// app at boot: we fall back to an empty config (and create the file) so the
// terminal can still reach the login screen, where the on-screen editor
// (gear button → PosConfigEditor) can create/fix the file and restart.
const LOCAL_CONFIG_PATH = 'C:/pos/posconfig.json';

const readLocalConfigFromDisk = () => {
    const raw = fs.readFileSync(LOCAL_CONFIG_PATH);
    return JSON.parse(raw);
};

let localConfig;
try {
    localConfig = readLocalConfigFromDisk();
} catch (ex) {
    console.error(`Could not read ${LOCAL_CONFIG_PATH}: ${ex && ex.message} — starting with empty config`);
    localConfig = {};
    try {
        fs.mkdirSync('C:/pos', { recursive: true });
        if (!fs.existsSync(LOCAL_CONFIG_PATH)) {
            fs.writeFileSync(LOCAL_CONFIG_PATH, JSON.stringify({}, null, 4));
        }
    } catch (writeEx) {
        console.error(`Could not create ${LOCAL_CONFIG_PATH}: ${writeEx && writeEx.message}`);
    }
}
const config = {
    qrBaseUrl: 'http://46.43.70.210:81/process-customer-entry.xhtml'
}
const axiosImport = require('axios');
const { log } = require('console');
const axios = axiosImport.create({
    baseURL: 'http://' + localConfig.serverIp + ':8080/'
});
const oposServiceAxios = axiosImport.create({
    baseURL: 'http://localhost:6666/'
});


// Conditionally include the dev tools installer to load React Dev Tools
let installExtension, REACT_DEVELOPER_TOOLS; // NEW!

if (isDev) {
    const devTools = require("electron-devtools-installer");
    installExtension = devTools.default;
    REACT_DEVELOPER_TOOLS = devTools.REACT_DEVELOPER_TOOLS;
} // NEW!


let updateInterval = null;
const logFilePath = path.join(__dirname, 'logs', 'app.log');

ipcMain.on('log-message', (event, arg) => {
    const { level, message } = arg;
    logger[level](message);
});

// ---------------------------------------------------------------------------
// Cross-window redux replication relay.
// ---------------------------------------------------------------------------
// The cashier and customer-display windows share one redux state. The renderer
// relays every plain action here; we forward it to every OTHER live window.
// This replaces the old broadcast-channel transport, which was unreliable on
// the `file://` origin used by packaged builds (large scan actions were
// silently dropped, so the customer screen never showed scanned items).
ipcMain.on('redux-action', (event, action) => {
    try {
        const senderId = event.sender.id;
        BrowserWindow.getAllWindows().forEach((w) => {
            if (w && w.webContents && !w.webContents.isDestroyed() && w.webContents.id !== senderId) {
                w.webContents.send('redux-action', action);
            }
        });
    } catch (ex) {
        logger.error(`redux-action relay failed: ${ex && ex.message}`);
    }
});

// A window (re)loaded and wants the current state. Ask every other window to
// provide its snapshot; the sender of this request is the target.
ipcMain.on('redux-request-state', (event) => {
    try {
        const requesterId = event.sender.id;
        BrowserWindow.getAllWindows().forEach((w) => {
            if (w && w.webContents && !w.webContents.isDestroyed() && w.webContents.id !== requesterId) {
                w.webContents.send('redux-provide-state', requesterId);
            }
        });
    } catch (ex) {
        logger.error(`redux-request-state relay failed: ${ex && ex.message}`);
    }
});

// A window answered a state request with its full snapshot. The most recent
// requester id is tracked per provider call via the closure below.
ipcMain.on('redux-state-snapshot', (event, snapshot) => {
    try {
        const providerId = event.sender.id;
        // Forward the snapshot to every other window. Receivers only adopt it
        // if they don't already have a live session (guarded in the renderer),
        // so this is safe to broadcast.
        BrowserWindow.getAllWindows().forEach((w) => {
            if (w && w.webContents && !w.webContents.isDestroyed() && w.webContents.id !== providerId) {
                w.webContents.send('redux-hydrate', snapshot);
            }
        });
    } catch (ex) {
        logger.error(`redux-state-snapshot relay failed: ${ex && ex.message}`);
    }
});

function createWindow() {
    // Create the browser window.
    const win = new BrowserWindow({
        width: 1024,
        height: 768,
        resizable: true,
        show: true,
        fullscreen: isDev ? false : localConfig.admin ? false : true,
        webPreferences: {
            nodeIntegration: true, contextIsolation: false, enableRemoteModule: true
        }
    });

    win.setMenu(null);

    ipcMain.on('show-dev-tools', (event, arg) => {
        win.webContents.openDevTools();
    });

    if (isDev) {
        win.webContents.openDevTools();
    }



    fs.promises.writeFile(logFilePath, '');

    // Printing the A4 invoice reprint from the renderer via `window.print()` is
    // unreliable in Electron with nodeIntegration enabled: cancelling the native
    // print dialog can tear the BrowserWindow down and — because this window is
    // the only one — `window-all-closed` then quits the whole app. Driving the
    // print from the main process with `webContents.print()` keeps the renderer
    // untouched so the overlay stays open and the app never quits.
    ipcMain.on('print-active-window', (event) => {
        try {
            const sender = event.sender;
            const hostWindow = BrowserWindow.fromWebContents(sender);
            if (!hostWindow) {
                return;
            }
            hostWindow.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
                if (!success && failureReason && failureReason !== 'cancelled') {
                    logger.error(`print-active-window failed: ${failureReason}`);
                }
            });
        } catch (ex) {
            logger.error(`print-active-window exception: ${ex && ex.message}`);
        }
    });

    // Guard against a missing/empty posconfig.json (first boot before the
    // login-screen editor creates it): send sane fallbacks instead of the
    // literal string "undefined", which config.js would treat as a real value.
    let params = `serverIp=${localConfig.serverIp || '127.0.0.1'}&deviceId=${localConfig.deviceId || ''}`;

    if (localConfig.admin) {
        params += `&admin=true`;
    }
    if (localConfig.scale) {
        params += `&scale=true`;
    }
    if (localConfig.scaleAlphabet) {
        params += `&scaleAlphabet=true`;
    }
    if (localConfig.autoUpdate) {
        params += `&autoUpdate=true`;
    }
    // Self-checkout kiosk mode — customer uses the main window directly.
    // The secondary customer-display window is skipped when this is set.
    if (localConfig.selfService) {
        params += `&selfService=true`;
    }
    if (localConfig.systemCurrency) {
        params += `&systemCurrency=${localConfig.systemCurrency}`;
    } else {
        params += `&systemCurrency=NIS`;
    }
    // Tenant drives regional behaviour (currency symbol, rounding, feature flags).
    // Defaults to jordan when omitted so existing installers keep working; palestine
    // installers should set tenant=palestine in pos-config.json.
    if (localConfig.tenant) {
        params += `&tenant=${localConfig.tenant}`;
    }
    // Khairgate Wallet UAT scan simulation: "khairgateTestQr": true in
    // posconfig.json puts an "Insert test QR" button in the Khairgate scan
    // modal (test customer from the integration details sheet). A string
    // value simulates that specific QR instead. Never set in production.
    if (localConfig.khairgateTestQr) {
        params += `&khairgateTestQr=${encodeURIComponent(localConfig.khairgateTestQr)}`;
    }


    logger.info(params);

    // and load the index.html of the app.
    win.loadURL(isDev ? `http://localhost:3000?${params}` : `file://${__dirname}/../build/index.html?${params}`);

    win.show();

    // customer screen options — skipped in self-service mode because the
    // main window IS the customer-facing kiosk.
    if (localConfig.showCustomerScreen && !localConfig.selfService) {
        const displays = screen.getAllDisplays()
        const externalDisplay = displays.find((display) => {
            return display.bounds.x !== 0 || display.bounds.y !== 0
        })

        let x = 0;
        let y = 0;
        if (externalDisplay) {
            x = externalDisplay.bounds.x + 50;
            y = externalDisplay.bounds.y + 50;
        }

        const customerScreen = new BrowserWindow({
            width: 1024,
            height: 768,
            x,
            y,
            title: 'Customer Display',
            resizable: true,
            show: true,
            fullscreen: true,
            webPreferences: {
                nodeIntegration: true, contextIsolation: false, enableRemoteModule: true
            }
        });

        customerScreen.setMenu(null);

        ipcMain.on('show-dev-tools', (event, arg) => {
            customerScreen.webContents.openDevTools();
        });

        if (isDev) {
            customerScreen.webContents.openDevTools();
        }

        // IMPORTANT: the query string must come BEFORE the hash fragment,
        // otherwise `location.search` is empty and `config.js` falls back to
        // serverIp=127.0.0.1, which breaks any HTTP call the customer window
        // makes (e.g. /trx/customerDisplayConfig for the images + news bar).
        customerScreen.loadURL(isDev ? `http://localhost:3000/?${params}#/customer` : `file://${__dirname}/../build/index.html?${params}#/customer`);
        customerScreen.show();
    }

}

autoUpdater.on('error', (error) => {
    dialog.showErrorBox('Error while checking for updates: ', error == null ? "unknown" : (error.stack || error).toString())
    logger.info('Error while checking for updates');
})

autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info);
    const dialogOpts = {
        type: 'info',
        buttons: ['OK'],
        title: 'Update Available',
        message: 'A new version of the application is available.',
        detail: 'It will be downloaded in the background. You will be notified when it is ready to be installed.'
    };
    dialog.showMessageBox(dialogOpts);
});

autoUpdater.on('update-not-available', (info) => {
    log.info('No update available:', info);
    const dialogOpts = {
        type: 'info',
        buttons: ['OK'],
        title: 'No Updates',
        message: 'You are using the latest version of the application.',
        detail: 'No updates are available at this time.'
    };
    dialog.showMessageBox(dialogOpts);
});

autoUpdater.on("update-downloaded", (_event, releaseNotes, releaseName) => {
    const dialogOpts = {
        type: 'info',
        buttons: ['Restart', 'Later'],
        title: 'Application Update',
        message: process.platform === 'win32' ? releaseNotes : releaseName,
        detail: 'A new version has been downloaded. Restart the application to apply the updates.'
    };
    dialog.showMessageBox(dialogOpts).then((returnValue) => {
        if (returnValue.response === 0) autoUpdater.quitAndInstall()
    });
});



// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    // If another instance is running, exit this one
    app.quit();
} else {

    app.whenReady().then(() => {
        createWindow();
        // createLogWindow();  // removed: function was never defined -> threw an unhandled rejection on every startup
        // updateInterval = setInterval(() => autoUpdater.checkForUpdates(), 600000); // every 10 minute
    });

    // Quit when all windows are closed, except on macOS. There, it's common
    // for applications and their menu bar to stay active until the user quits
    // explicitly with Cmd + Q.
    app.on("window-all-closed", () => {
        if (process.platform !== "darwin") {
            app.quit();
        }
    });

    app.on("activate", () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();

            if (isDev) {
                installExtension(REACT_DEVELOPER_TOOLS)
                    .then(name => logger.info(`Added Extension:  ${name}`))
                    .catch(error => logger.info(`An error occurred: , ${error}`));
            }
        }
    });


    // In this file you can include the rest of your app's specific main process
    // code. You can also put them in separate files and require them here.

    const expressApp = express();
    expressApp.use(cors());
    expressApp.use(bodyParser.json())
    expressApp.use(bodyParser.urlencoded({ extended: false }))

    // Receipt with a QR pointing at the online invoice — used when
    // posconfig.json sets printTemplate to 'qr' (or leaves it unset).
    // The PDF is written to C:\pos\invoice.pdf then sent to the printer
    // according to printMethod: 'default' → Windows default printer via
    // pdf-to-printer, 'ptp' (or unset) → the legacy ptp.exe helper.
    const printWithQR = (object) => {
        let writeStream = new stream.WritableBufferStream();
        const qrFileName = 'C:\\pos\\qr.png'
        const logo = 'C:\\pos\\logo.png'
        const invoiceFileName = 'C:\\pos\\invoice.pdf'

        const doc = new PDFDocument({
            size: [203, 400],
            margins: { // by default, all are 72
                top: 5,
                bottom: 5,
                left: 5,
                right: 5
            }
        });

        qr.toFile(qrFileName, object.qr, (ex, url) => {
            if (ex) {
                logger.info('ex', ex);
            }

            doc.pipe(writeStream);
            doc.fontSize(15);
            let g = 50;

            doc.font('C:\\pos\\arial.ttf')
            doc.image(logo, 55, 15 + g, { width: 100, height: 25 });
            doc.image(qrFileName, 110, 40 + g, { width: 100, height: 100 });
            doc.font('C:\\pos\\VT323.ttf');
            doc.text('Total: ' + object.total + '', 15, 50 + g);
            doc.text('Discount: ' + object.discount + '', 15, 65 + g);
            // Self-checkout sales are rounded to what the cash machine can
            // settle, so the total can differ from the lines by a few agorot.
            // Only printed when there is something to explain.
            let row = 80;
            if (object.rounding) {
                doc.text('Rounding: ' + object.rounding + '', 15, row + g);
                row += 15;
            }
            doc.text('Paid: ' + object.paid + '', 15, row + g);
            doc.text('Change: ' + object.change + '', 15, row + 15 + g);
            doc.text('Type: ' + object.type, 15, row + 30 + g);

            doc.fontSize(13)
            doc.text('Store: ' + object.store, 15, 140 + g);
            doc.text('Cashier: ' + object.cashier, 15, 160 + g);
            doc.text(object.date, 15, 182 + g);

            doc.end()

            writeStream.on('finish', () => {
                const base64 = writeStream.toBuffer().toString('base64')
                fs.writeFile(invoiceFileName, base64, 'base64', (err) => {
                    if (err) {
                        logger.info('ERROR', err);
                    }
                    logger.info('printing...............................');
                    if (localConfig.printMethod && localConfig.printMethod === 'default') {
                        print('C:\\pos\\invoice.pdf', {}).catch((e) => {
                            logger.error('pdf-to-printer failed: ' + (e && e.message));
                        });
                    } else if (!localConfig.printMethod || localConfig.printMethod === 'ptp') {
                        exec(
                            'ptp.exe invoice.pdf', {
                            cwd: 'C:\\pos\\',
                            windowsHide: true
                        }, (e) => {
                            if (e) {
                                logger.error('ptp.exe failed: ' + (e && e.message));
                            }
                        });
                    }
                });
            });

        })
    }

    const fetchTrx = async (trxKey) => {
        const response = await axios({
            method: 'post',
            url: '/trx/fetchTrx',
            headers: {
                'trxKey': trxKey
            }
        });
        return response && response.data ? response.data : null;
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Fawtara is a JORDAN-only feature. On the Palestine tenant the backend
    // has no fawtaraQrString field at all, so polling for it just adds a
    // fixed ~4s delay to every OPOS receipt. Gate the polling by tenant.
    const isPalestineTenant = () => {
        const t = (localConfig.tenant || '').toString().toLowerCase();
        if (t === 'palestine' || t === 'ps') return true;
        // legacy installers only set systemCurrency=NIS
        return !t && localConfig.systemCurrency === 'NIS';
    };

    // Fawtara QR is generated asynchronously on the backend after the sale
    // closes (Jordan only); poll briefly until it lands.
    const fetchTrxWithFawtara = async (trxKey) => {
        const maxAttempts = 8;
        const delayMs = 500;
        let trx = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            trx = await fetchTrx(trxKey);
            if (!trx) {
                return null;
            }
            if (trx.type !== 'Sale' || (trx.fawtaraQrString && trx.fawtaraQrString.trim().length > 0)) {
                return trx;
            }
            await sleep(delayMs);
        }
        return trx;
    };

    // Opens the cash drawer via the OPOS service and RESOLVES WHEN DONE.
    // The print job must not be sent before this settles: the NCR drawer is
    // kicked through the printer, so a drawer pulse issued while the printer
    // is busy with receipt bitmaps comes back Busy/Offline and the drawer
    // never opens (this is exactly what broke when the Fawtara delay — which
    // accidentally guaranteed drawer-before-print ordering — was removed).
    // The timeout keeps a dead drawer from ever blocking the receipt.
    const openDrawerAndWait = () => {
        return oposServiceAxios({ method: 'get', url: '/open-drawer', timeout: 5000 })
            .catch((_error) => log('open-drawer failed: ' + (_error && _error.message)));
    };

    // Dispatch the receipt according to posconfig.json:
    //   printTemplate 'qr' (default) → small QR slip via printWithQR
    //   printTemplate 'complete'     → full itemised PDF via printComplete
    //   printTemplate 'opos'         → hand off to the OPOS service (:6666)
    const printReceiptForTrx = (trx) => {
        const qrUrl = 'https://plus.shini.ps/invoice?sptr=' + trx.key + '_' + trx.nanoId;
        const date = trx.dateAsString;

        if (!localConfig.printTemplate || localConfig.printTemplate === 'qr') {
            printWithQR({
                qr: qrUrl,
                total: trx.totalafterdiscount,
                discount: trx.totaldiscount,
                rounding: trx.cashRounding,
                paid: trx.paidamt,
                change: trx.customerchange,
                date,
                store: trx.branch,
                cashier: trx.username,
                type: trx.type
            });
        } else if (localConfig.printTemplate === 'complete') {
            printComplete({
                qr: qrUrl,
                total: trx.totalafterdiscount,
                discount: trx.totaldiscount,
                rounding: trx.cashRounding,
                paid: trx.paidamt,
                change: trx.customerchange,
                date,
                store: trx.branch,
                cashier: trx.username,
                type: trx.type,
                lines: trx.printableLines,
                totalTax: trx.totalTaxAmt,
                payments: trx.paymentSummaryList,
                taxDiscount: trx.taxDiscount,
                terminal: trx.terminalKey
            });
        } else if (localConfig.printTemplate === 'opos') {
            oposServiceAxios({
                method: 'post',
                url: '/opos-print',
                data: trx,
                headers: {
                    'Content-Type': 'application/json',
                }
            }).then((_res) => {
                console.log(_res);
            }).catch((_error) => {
                log('opos-print failed: ' + (_error && _error.message));
            });
        }
    };

    expressApp.get('/printTrx', async (req, res) => {
        try {
            const trxKey = req.query.trxKey;
            let trx = null;

            if (localConfig.printTemplate === 'opos') {
                // Kick the drawer and fetch the trx IN PARALLEL (the drawer
                // needs no trx data), but wait for BOTH before printing so
                // the drawer pulse always hits an idle printer — see
                // openDrawerAndWait for why ordering is mandatory.
                const drawerDone = openDrawerAndWait();

                // Palestine: fetch once — no Fawtara polling (see isPalestineTenant).
                trx = isPalestineTenant() ? await fetchTrx(trxKey) : await fetchTrxWithFawtara(trxKey);
                await drawerDone;
            } else {
                trx = await fetchTrx(trxKey);
            }

            if (trx) {
                printReceiptForTrx(trx);

                if (trx.campaignList && Array.isArray(trx.campaignList)) {
                    trx.campaignList.forEach((campaign, index) => {
                        console.log(campaign);
                        const pdfUrl = campaign.qrCode;
                        if (!pdfUrl) {
                            console.warn(`No QR code URL found for campaign at index ${index}`);
                            return;
                        }
                        console.log(index)
                        const localPdfPath = path.join(os.tmpdir(), `slip_${index}.pdf`);

                        https.get(pdfUrl, (response) => {
                            const file = fs.createWriteStream(localPdfPath);
                            response.pipe(file);
                            file.on('finish', () => {
                                file.close();
                                console.log(`Downloaded PDF for campaign ${index + 1}. Sending to printer...`);
                                print(localPdfPath)
                                    .then(() => {
                                        console.log(`Printed campaign ${index + 1} successfully.`);
                                        fs.unlink(localPdfPath, (err) => {
                                            if (err) console.error(`Error deleting file ${localPdfPath}:`, err);
                                        });
                                    })
                                    .catch((err) => {
                                        console.error(`Print failed for campaign ${index + 1}:`, err);
                                    });
                            });
                        }).on('error', (err) => {
                            console.error(`Error downloading PDF for campaign ${index + 1}:`, err);
                        });
                    });
                }


                res.send(trx);
            } else {
                // Never leave the renderer's HTTP call hanging when the
                // backend returned no transaction.
                res.status(404).send('Transaction not found');
            }
        } catch (error) {
            if (error.response) {
                dialog.showErrorBox('Error', 'Un-Authorized')
            } else {
                dialog.showErrorBox('Error', error.message)
            }
            res.send('error');
        }
    })

    expressApp.get('/printTrxNoDrawer', async (req, res) => {
        try {
            const trxKey = req.query.trxKey;
            let trx = null;

            if (localConfig.printTemplate === 'opos') {
                // Palestine: fetch once — no Fawtara polling (see isPalestineTenant).
                trx = isPalestineTenant() ? await fetchTrx(trxKey) : await fetchTrxWithFawtara(trxKey);
            } else {
                trx = await fetchTrx(trxKey);
            }

            if (trx) {
                printReceiptForTrx(trx);

                if (trx.campaignList && Array.isArray(trx.campaignList)) {
                    trx.campaignList.forEach((campaign, index) => {
                        console.log(campaign);
                        const pdfUrl = campaign.qrCode;
                        if (!pdfUrl) {
                            console.warn(`No QR code URL found for campaign at index ${index}`);
                            return;
                        }

                        const localPdfPath = path.join(os.tmpdir(), `slip_${index}.pdf`);

                        https.get(pdfUrl, (response) => {
                            const file = fs.createWriteStream(localPdfPath);
                            response.pipe(file);
                            file.on('finish', () => {
                                file.close();
                                console.log(`Downloaded PDF for campaign ${index + 1}. Sending to printer...`);
                                print(localPdfPath)
                                    .then(() => {
                                        console.log(`Printed campaign ${index + 1} successfully.`);
                                        fs.unlink(localPdfPath, (err) => {
                                            if (err) console.error(`Error deleting file ${localPdfPath}:`, err);
                                        });
                                    })
                                    .catch((err) => {
                                        console.error(`Print failed for campaign ${index + 1}:`, err);
                                    });
                            });
                        }).on('error', (err) => {
                            console.error(`Error downloading PDF for campaign ${index + 1}:`, err);
                        });
                    });
                }


                res.send(trx);
            } else {
                res.status(404).send('Transaction not found');
            }
        } catch (error) {
            if (error.response) {
                dialog.showErrorBox('Error', 'Un-Authorized')
            } else {
                dialog.showErrorBox('Error', error.message)
            }
            res.send('error');
        }
    })


    // -----------------------------------------------------------------------
    // BOP Visa payment terminal
    //
    // `bopVisaIp` carries the transport target: an IPv4 address for a networked
    // terminal, or a COM port name ("COM1") for one on a serial cable. The
    // backend stores the field verbatim, so both transports share it and adding
    // serial needed no schema change. Everything protocol-related lives in
    // ./bopVisa.js.
    // -----------------------------------------------------------------------

    const BOP_KEY_DIR = 'C:\\pos';

    // DTR/RTS default to asserted (see SERIAL_DEFAULTS in bopVisa.js — a low
    // RTS stalls readers on cables that wire the handshake pins). Set
    // bopVisaDtr/bopVisaRts to false in pos-config.json to force a line low on
    // a station whose reader genuinely needs that.
    const bopSerialSettings = () => ({
        baudRate: localConfig.bopVisaBaudRate || 115200,
        dtr: localConfig.bopVisaDtr !== false,
        rts: localConfig.bopVisaRts !== false,
        // Opt-in driver-managed RTS/CTS flow control, for stations whose
        // serial link drops bytes mid-stream (see SerialTransport.open).
        rtscts: localConfig.bopVisaRtscts === true
    });

    /**
     * Keep a copy of the pairing on disk next to the other terminal files.
     * The backend copy is the one actually used; this is a diagnostic aid for
     * support, so failing to write it must never fail the link.
     */
    const archiveBopKeysLocally = (target, publicKey, privateKey, visaPublicRsaKey) => {
        try {
            fs.mkdirSync(BOP_KEY_DIR, { recursive: true });
            fs.writeFileSync(path.join(BOP_KEY_DIR, 'private.key'), privateKey);
            fs.writeFileSync(path.join(BOP_KEY_DIR, 'public.key'), publicKey);
            fs.writeFileSync(path.join(BOP_KEY_DIR, 'visa-public.key'), visaPublicRsaKey);
            fs.writeFileSync(path.join(BOP_KEY_DIR, 'visa-link.json'), JSON.stringify({
                target,
                linkedAt: new Date().toISOString()
            }, null, 4));
        } catch (ex) {
            logger.warn(`[bopVisa] could not archive keys to ${BOP_KEY_DIR}: ${ex && ex.message}`);
        }
    };

    /** COM ports available on this machine, for the link screen's picker. */
    expressApp.get('/bopVisaPorts', async (req, res) => {
        try {
            res.send({ ports: await bopVisa.listSerialPorts() });
        } catch (ex) {
            logger.error(`[bopVisa] could not list serial ports: ${ex && ex.message}`);
            res.status(500).send({ error: ex.message });
        }
    });

    /** Is the device on the other end actually answering? */
    expressApp.post('/bopVisaStatus', async (req, res) => {
        const target = String(req.body.target || req.body.bopVisaIp || '').trim();
        if (!target) {
            res.status(400).send({ error: 'A COM port or IP address is required' });
            return;
        }

        const busy = bopVisa.getActiveOperation();
        if (busy) {
            res.send({ target, reachable: null, busy: busy.label });
            return;
        }

        try {
            const result = await bopVisa.ping({ target, serial: bopSerialSettings() });
            res.send({ target, reachable: result.reachable, serial: bopVisa.isSerialTarget(target) });
        } catch (ex) {
            res.send({ target, reachable: false, error: ex.message, serial: bopVisa.isSerialTarget(target) });
        }
    });

    expressApp.post('/linkTerminalWithBopVisa', async (req, res) => {
        const terminalKey = req.body.terminalKey;
        const target = String(req.body.bopVisaIp || req.body.target || '').trim();

        if (!terminalKey) {
            res.status(400).send({ error: 'No terminal is logged in on this station' });
            return;
        }
        if (!target) {
            res.status(400).send({ error: 'Select a COM port or enter the terminal IP address first' });
            return;
        }

        const isSerial = bopVisa.isSerialTarget(target);

        try {
            // The pairing is only usable once the backend has it, so nothing is
            // written anywhere until INIT has actually succeeded — overwriting a
            // good private key with one the terminal never acknowledged would
            // leave the station unable to read any reply, and the device will
            // not re-pair on demand.
            const pairing = await bopVisa.init({
                target,
                // BOP's own serial tool sends this; the networked path never did
                // and is left alone so existing installs behave identically.
                print: isSerial ? (localConfig.bopVisaPrintMode === undefined ? 3 : localConfig.bopVisaPrintMode) : undefined,
                serial: bopSerialSettings()
            });

            const response = await axios({
                method: 'post',
                url: '/trx/linkTerminalWithBopVisa',
                data: {
                    terminalKey,
                    terminalPrivateRsaKey: pairing.privateKey,
                    terminalPublicRsaKey: pairing.publicKey,
                    visaIp: target,
                    visaPublicRsaKey: pairing.visaPublicRsaKey
                }
            });

            archiveBopKeysLocally(target, pairing.publicKey, pairing.privateKey, pairing.visaPublicRsaKey);
            logger.info(`[bopVisa] terminal ${terminalKey} linked to ${target}`);
            res.send(response.data);
        } catch (ex) {
            const detail = (ex.response && ex.response.data) ? ex.response.data : ex.message;
            logger.error(`[bopVisa] link to ${target} failed: ${detail}`);
            res.status(500).send({
                error: typeof detail === 'string' ? detail : (detail.error || ex.message),
                target,
                serial: isSerial
            });
        }
    });

    expressApp.post('/unlinkTerminalFromBopVisa', async (req, res) => {
        const terminalKey = req.body.terminalKey;
        if (!terminalKey) {
            res.status(400).send({ error: 'No terminal is logged in on this station' });
            return;
        }

        try {
            // Clearing the stored pairing is the whole of an unlink; the device
            // keeps its own key until it is re-initialised from its menus, and
            // a fresh link overwrites both sides anyway.
            const response = await axios({
                method: 'post',
                url: '/trx/linkTerminalWithBopVisa',
                data: {
                    terminalKey,
                    terminalPrivateRsaKey: null,
                    terminalPublicRsaKey: null,
                    visaIp: null,
                    visaPublicRsaKey: null
                }
            });

            try {
                ['private.key', 'public.key', 'visa-public.key', 'visa-link.json'].forEach((name) => {
                    const file = path.join(BOP_KEY_DIR, name);
                    if (fs.existsSync(file)) {
                        fs.unlinkSync(file);
                    }
                });
            } catch (ex) {
                logger.warn(`[bopVisa] could not clear archived keys: ${ex && ex.message}`);
            }

            logger.info(`[bopVisa] terminal ${terminalKey} unlinked`);
            res.send(response.data);
        } catch (ex) {
            const detail = (ex.response && ex.response.data) ? ex.response.data : ex.message;
            logger.error(`[bopVisa] unlink failed: ${detail}`);
            res.status(500).send({ error: typeof detail === 'string' ? detail : ex.message });
        }
    });

    expressApp.post('/bopVisaSale', async (req, res) => {
        const terminal = req.body.terminal;

        if (!terminal || !terminal.bopVisaIp || !terminal.bopVisaPublicRsa || !terminal.localPrivateRsa) {
            res.status(400).send({ error: 'This station is not linked to a BOP Visa terminal' });
            return;
        }

        const busy = bopVisa.getActiveOperation();
        if (busy) {
            // Two sales at once would interleave on one port and could double
            // charge, so the second is refused outright rather than queued.
            res.status(409).send({
                error: `The payment terminal is busy with a ${busy.label} started ${Math.round(busy.elapsedMs / 1000)}s ago`
            });
            return;
        }

        try {
            const response = await bopVisa.sale({
                target: terminal.bopVisaIp,
                visaPublicRsaKey: terminal.bopVisaPublicRsa,
                privateKey: terminal.localPrivateRsa,
                amt: req.body.amt,
                cur: req.body.cur,
                rcpt: req.body.trxId,
                serial: bopSerialSettings()
            });
            // Declines come back here too, with a non-zero resp_code — the
            // caller decides what to do with them.
            res.send(response);
        } catch (ex) {
            logger.error(`[bopVisa] sale failed: ${ex.message}`);
            res.status(ex.outcomeUnknown ? 504 : 500).send({
                error: ex.message,
                // The card may have been charged even though we never saw the
                // answer, so the UI must tell the operator to check the device
                // instead of quietly offering a retry.
                outcomeUnknown: !!ex.outcomeUnknown,
                // Set when the reader approved a different figure than we asked
                // for: the money definitely moved, so this can never be retried.
                amountMismatch: !!ex.amountMismatch,
                terminalMessage: ex.terminalMessage || null,
                authCode: ex.authCode || null,
                rcpt: ex.rcpt
            });
        }
    })

    // -----------------------------------------------------------------------
    // Arab Bank Visa payment terminal (Jordan)
    //
    // The terminal is driven by a separate Windows service (bundled Node 18 +
    // edge-js + the bank's CashierAgentDesktopDLL) on 127.0.0.1:9700 — see
    // arabi-visa-pos-windows-service/README.md. These routes are the ONLY way
    // the renderer reaches it: Electron owns the busy lock, the long sale
    // timeout, the logging, and the install / auto-detect flows. The COM port
    // comes from posconfig.json (`arabiVisaCom`), which both this app and the
    // service read.
    // -----------------------------------------------------------------------

    const abSettings = () => arabBankVisa.resolveSettings(localConfig);

    const abAxios = (timeoutMs) => axiosImport.create({
        baseURL: abSettings().serviceUrl,
        timeout: timeoutMs,
        // Keep 4xx/5xx as rejections (default) — classifySaleError maps them.
        proxy: false
    });

    let abActiveSale = null; // { transIndexCode, trxKey, startedAt }

    const abServiceHealth = async (timeoutMs) => {
        try {
            const r = await abAxios(timeoutMs || 1500).get('/health');
            return r.data;
        } catch (ex) {
            return null;
        }
    };

    /** Everything the admin panel needs to show the station's card-terminal state. */
    expressApp.get('/arabiVisa/status', async (req, res) => {
        const settings = abSettings();
        const pkg = arabBankVisa.packageStatus(settings.serviceDir);
        const [service, health, ports] = await Promise.all([
            arabBankVisa.queryServiceState(arabBankVisa.SERVICE_ID),
            abServiceHealth(1500),
            bopVisa.listSerialPorts().catch(() => [])
        ]);
        const portNames = ports.map((p) => arabBankVisa.normaliseComPort(p.path));
        const terminal = null; // the renderer passes conflicts for the BOP link itself
        res.send({
            settings,
            package: pkg,
            service,
            health,
            serviceReachable: !!health,
            ports,
            comPortPresent: settings.comPort ? portNames.indexOf(settings.comPort) >= 0 : false,
            comPortConflicts: arabBankVisa.comPortConflicts(localConfig, terminal),
            activeSale: abActiveSale ? Object.assign({}, abActiveSale, { elapsedSec: Math.round((Date.now() - abActiveSale.startedAt) / 1000) }) : null,
            install: arabBankVisa.getActiveInstall(),
            lastInstall: arabBankVisa.readInstallResult(settings.serviceDir),
            ready: !!(health && health.ok && settings.comPort && portNames.indexOf(settings.comPort) >= 0
                && arabBankVisa.comPortConflicts(localConfig, terminal).length === 0)
        });
    });

    /** Serial ports on this PC (shared by the posconfig editor's COM dropdowns). */
    expressApp.get('/serialPorts', async (req, res) => {
        try {
            res.send({ ports: await bopVisa.listSerialPorts() });
        } catch (ex) {
            logger.error(`[arabBank] could not list serial ports: ${ex && ex.message}`);
            res.status(500).send({ error: ex.message, ports: [] });
        }
    });

    /** Probe one COM port (defaults to the configured one) with the protocol handshake. */
    expressApp.post('/arabiVisa/handshake', async (req, res) => {
        if (abActiveSale) {
            res.status(409).send({ ok: false, code: 'busy', error: 'A card sale is in progress on this station' });
            return;
        }
        const body = req.body || {};
        try {
            const r = await abAxios(30000).post('/handshake', {
                comPort: body.comPort || undefined,
                baudRate: body.baudRate || undefined,
                timeoutMs: body.timeoutMs || undefined
            });
            res.send(r.data);
        } catch (ex) {
            const mapped = arabBankVisa.classifySaleError(ex, abSettings());
            if (mapped.body.code === 'outcomeUnknown') {
                // A handshake has no financial outcome; report it as a plain failure.
                mapped.body = { ok: false, code: 'noResponse', error: 'The service did not answer the handshake request in time' };
                mapped.status = 502;
            }
            res.status(mapped.status).send(mapped.body);
        }
    });

    /**
     * Try every plausible COM port until one answers the handshake. Reserved
     * ports (scale, BOP reader) are skipped. Returns the winner or a structured
     * reason so the UI can say exactly why nothing was found.
     */
    expressApp.post('/arabiVisa/autoDetect', async (req, res) => {
        if (abActiveSale) {
            res.status(409).send({ ok: false, code: 'busy', error: 'A card sale is in progress on this station' });
            return;
        }
        const settings = abSettings();
        const health = await abServiceHealth(1500);
        if (!health) {
            res.status(503).send({
                ok: false, code: 'SERVICE_DOWN',
                error: 'The Arab Bank Visa service is not running - install/start it first'
            });
            return;
        }
        let ports = [];
        try { ports = await bopVisa.listSerialPorts(); } catch (ex) { /* fall through with empty list */ }
        const terminal = (req.body && req.body.terminal) || null;
        const candidates = arabBankVisa.pickCandidatePorts(ports, localConfig, terminal);
        const reserved = arabBankVisa.reservedPorts(localConfig, terminal);
        if (!candidates.length) {
            res.status(404).send({
                ok: false, code: 'noPorts',
                error: ports.length
                    ? 'Every COM port on this PC is reserved (' + Object.keys(reserved).map((k) => k + ' = ' + reserved[k]).join(', ') + ')'
                    : 'No serial ports found on this PC. Plug in the terminal cable and install the PL2303 driver.',
                ports, reserved
            });
            return;
        }

        const timeoutMs = 2000;
        const attempts = [];
        const winners = [];
        for (const c of candidates) {
            try {
                const r = await abAxios(30000).post('/handshake', { comPort: c.path, timeoutMs });
                attempts.push({ comPort: c.path, ok: true, baudRate: r.data.baudRate, elapsedMs: r.data.elapsedMs, friendlyName: c.friendlyName });
                winners.push({ comPort: c.path, baudRate: r.data.baudRate, friendlyName: c.friendlyName, manufacturer: c.manufacturer });
                // The configured / highest-scored port answering is conclusive.
                if (winners.length === 1 && (c.path === settings.comPort || c.score >= 50)) break;
            } catch (ex) {
                const data = ex.response && ex.response.data;
                attempts.push({
                    comPort: c.path, ok: false, friendlyName: c.friendlyName,
                    code: (data && data.code) || ex.code || 'error',
                    error: (data && data.error) || ex.message
                });
                if (data && data.code === 'busy') break; // service lock held, stop hammering
            }
        }
        logger.info(`[arabBank] autoDetect: ${JSON.stringify(attempts)}`);

        if (winners.length === 1) {
            res.send({ ok: true, comPort: winners[0].comPort, baudRate: winners[0].baudRate, friendlyName: winners[0].friendlyName, attempts, reserved });
        } else if (winners.length > 1) {
            res.status(409).send({
                ok: false, code: 'multiple',
                error: 'More than one port answered the Arab Bank handshake (' + winners.map((w) => w.comPort).join(', ') + '). Unplug all but the terminal and retry, or pick one manually.',
                winners, attempts, reserved
            });
        } else {
            res.status(404).send({
                ok: false, code: 'notFound',
                error: 'No port answered the Arab Bank handshake. Tried: ' + attempts.map((a) => a.comPort).join(', ') + '. Check the terminal is powered on and the cable is in.',
                attempts, reserved
            });
        }
    });

    /**
     * Charge the card. Body: { amountMinor, currencyCode, transIndexCode, trxKey }.
     * Mirrors the service contract 1:1 (see arabi-visa-pos-windows-service/README.md).
     */
    expressApp.post('/arabiVisa/sale', async (req, res) => {
        const settings = abSettings();
        const body = req.body || {};
        const amountMinor = body.amountMinor;
        if (typeof amountMinor !== 'number' || !Number.isInteger(amountMinor) || amountMinor <= 0) {
            res.status(400).send({ ok: false, code: 'badRequest', error: 'amountMinor must be a positive integer' });
            return;
        }
        if (!body.trxKey) {
            res.status(400).send({ ok: false, code: 'badRequest', error: 'trxKey is required' });
            return;
        }
        if (!body.transIndexCode || !/^\d{1,12}$/.test(String(body.transIndexCode))) {
            res.status(400).send({ ok: false, code: 'badRequest', error: 'transIndexCode must be 1-12 digits' });
            return;
        }
        if (!settings.comPort) {
            res.status(412).send({ ok: false, code: 'noComPort', error: 'arabiVisaCom is not set. Open Admin > Arab Bank Visa > Setup automatically.' });
            return;
        }
        const conflicts = arabBankVisa.comPortConflicts(localConfig, body.terminal || null);
        if (conflicts.length) {
            res.status(412).send({ ok: false, code: 'portConflict', error: conflicts.join('; ') });
            return;
        }
        if (abActiveSale) {
            res.status(409).send({
                ok: false, code: 'busy',
                error: `A card sale (ref ${abActiveSale.transIndexCode}) is already in progress, started ${Math.round((Date.now() - abActiveSale.startedAt) / 1000)}s ago`
            });
            return;
        }

        abActiveSale = { transIndexCode: String(body.transIndexCode), trxKey: String(body.trxKey), startedAt: Date.now() };
        const timeoutMs = settings.timeoutSec * 1000 + 25000;
        logger.info(`[arabBank] SALE start ref=${abActiveSale.transIndexCode} trx=${abActiveSale.trxKey} amountMinor=${amountMinor} cur=${body.currencyCode || 400} port=${settings.comPort}`);
        try {
            const r = await abAxios(timeoutMs).post('/sale', {
                amountMinor,
                currencyCode: body.currencyCode || 400,
                transIndexCode: String(body.transIndexCode),
                trxKey: String(body.trxKey),
                deviceId: localConfig.deviceId || ''
            });
            const d = r.data || {};
            logger.info(`[arabBank] SALE end ref=${abActiveSale.transIndexCode} approved=${d.approved} cancelled=${d.cancelled} resp=${d.respCode} "${d.respDesc}" amountMinor=${d.amountMinor} rrn=${d.rrn} auth=${d.authCode} card=${d.cardNum}`);
            res.send(d);
        } catch (ex) {
            const mapped = arabBankVisa.classifySaleError(ex, settings);
            logger.error(`[arabBank] SALE failed ref=${abActiveSale.transIndexCode} status=${mapped.status} code=${mapped.body.code} ${mapped.body.error || ''}`);
            mapped.body.transIndexCode = mapped.body.transIndexCode || abActiveSale.transIndexCode;
            res.status(mapped.status).send(mapped.body);
        } finally {
            abActiveSale = null;
        }
    });

    /** Kick off install.ps1 (UAC prompt on the station). Poll /arabiVisa/install/status. */
    expressApp.post('/arabiVisa/install', async (req, res) => {
        const settings = abSettings();
        const pkg = arabBankVisa.packageStatus(settings.serviceDir);
        if (!pkg.present) {
            res.status(404).send({
                ok: false, code: 'PACKAGE_MISSING',
                error: `The service package is not on this PC. Copy arabi-visa-pos-windows-service to ${settings.serviceDir} first.`,
                package: pkg
            });
            return;
        }
        if (!pkg.bundledNode || !pkg.dll || !pkg.nodeModules) {
            res.status(412).send({
                ok: false, code: 'PACKAGE_INCOMPLETE',
                error: 'The service package is incomplete: '
                    + [!pkg.bundledNode && 'node\\node.exe', !pkg.dll && 'CashierAgentDesktopDLL.dll', !pkg.nodeModules && 'node_modules'].filter(Boolean).join(', ')
                    + ' missing in ' + settings.serviceDir,
                package: pkg
            });
            return;
        }
        if (abActiveSale) {
            res.status(409).send({ ok: false, code: 'busy', error: 'Finish the card sale in progress before re-installing the service' });
            return;
        }
        const running = arabBankVisa.getActiveInstall();
        if (running && running.running) {
            res.status(409).send({ ok: false, code: 'INSTALL_RUNNING', error: 'An installation is already running', install: running });
            return;
        }
        try {
            const p = arabBankVisa.runInstaller(settings.serviceDir, { port: settings.servicePort, configPath: LOCAL_CONFIG_PATH.replace(/\//g, '\\') });
            p.then((r) => logger.info(`[arabBank] installer finished exit=${r.exitCode} ${r.error || ''}`))
                .catch((ex) => logger.error(`[arabBank] installer error: ${ex && ex.message}`));
            res.send({ ok: true, started: true, install: arabBankVisa.getActiveInstall() });
        } catch (ex) {
            res.status(500).send({ ok: false, code: ex.code || 'error', error: ex.message });
        }
    });

    expressApp.get('/arabiVisa/install/status', async (req, res) => {
        const settings = abSettings();
        const install = arabBankVisa.getActiveInstall();
        const result = arabBankVisa.readInstallResult(settings.serviceDir);
        res.send({
            install,
            running: !!(install && install.running),
            exitCode: install && !install.running ? install.exitCode : null,
            exitMessage: install && !install.running ? arabBankVisa.describeInstallExit(install.exitCode) : null,
            result,
            logTail: arabBankVisa.tailInstallLog(settings.serviceDir, 60)
        });
    });

    // Enhanced scale handling with stability management
    let scaleHandler = null;

    // Scale frame delimiter resolution
    // -----------------------------------------------------------------------
    // Different scale firmwares terminate their frames differently. Jordan
    // scales (TEM EGE-TB and similar) emit CR-terminated frames, while
    // Palestine installs typically run LF-terminated firmware. If the
    // delimiter doesn't match what the scale emits, `ReadlineParser` never
    // fires and `/weightScale` ends up timing out.
    //
    // Resolution order (most specific wins):
    //   1. `localConfig.scaleFrameDelimiter` — explicit per-install override
    //      in pos-config.json. Accepts either a JSON-escaped control char
    //      ("\r", "\n", "\r\n") or the literal tokens "CR", "LF", "CRLF".
    //   2. Tenant default — palestine → "\n", jordan → "\r".
    //   3. Fall back to "\r" for safety (Jordan has been the historical
    //      default and the TEM EGE-TB comment below still applies).
    const resolveScaleFrameDelimiter = () => {
        const raw = localConfig.scaleFrameDelimiter;
        if (typeof raw === 'string' && raw.length > 0) {
            const upper = raw.trim().toUpperCase();
            if (upper === 'CR') return '\r';
            if (upper === 'LF') return '\n';
            if (upper === 'CRLF') return '\r\n';
            return raw; // assume JSON already unescaped "\r" / "\n"
        }
        const tenant = (localConfig.tenant || '').toString().toLowerCase();
        if (tenant === 'palestine' || tenant === 'ps') return '\n';
        if (tenant === 'jordan' || tenant === 'jo') return '\r';
        // Legacy installs don't carry a tenant field; keep historical CR so
        // existing Jordan stores aren't disturbed.
        return '\r';
    };

    // Scale configuration from local config
    const getScaleConfig = () => ({
        port: localConfig.scaleCOM || 'COM1',
        baudRate: localConfig.baudRate || 9600,
        maxRetries: localConfig.scaleMaxRetries || 6,
        retryDelay: localConfig.scaleRetryDelay || 500,
        responseTimeout: localConfig.scaleResponseTimeout || 3000,
        weightCommand: localConfig.scaleWeightCommand || '$',
        zeroCommand: localConfig.scaleZeroCommand || 'Z',
        restartCommand: localConfig.scaleRestartCommand || 'Z',
        frameDelimiter: resolveScaleFrameDelimiter()
    });

    // Enhanced Scale Handler Class for TEM EGE-TB
    class EnhancedScaleHandler {
        constructor(config) {
            this.config = config;
            this.serialPort = null;
            this.parser = null;
            this.isConnected = false;
            this.isWaitingForWeight = false;
            this.currentWeightPromise = null;
            this.weightTimeout = null;
            this.retryCount = 0;
        }

        async connect() {
            return new Promise((resolve, reject) => {
                try {
                    this.serialPort = new SerialPort({
                        path: this.config.port,
                        baudRate: this.config.baudRate,
                        autoOpen: false
                    });

                    // Frame delimiter comes from the tenant-aware config so the
                    // same build works on Jordan (CR-terminated firmware,
                    // e.g. TEM EGE-TB) and Palestine (LF-terminated firmware).
                    const delim = this.config.frameDelimiter || '\r';
                    const delimLabel = delim === '\r' ? 'CR'
                        : delim === '\n' ? 'LF'
                        : delim === '\r\n' ? 'CRLF'
                        : JSON.stringify(delim);
                    logger.info(`Scale frame delimiter: ${delimLabel}`);
                    this.parser = this.serialPort.pipe(new ReadlineParser({ delimiter: delim }));

                    this.serialPort.on('error', (err) => {
                        logger.error('Scale Serial Port Error:', err.message);
                        this.isConnected = false;
                        reject(err);
                    });

                    this.serialPort.on('open', () => {
                        logger.info('Enhanced Scale Handler connected successfully');
                        this.isConnected = true;
                        resolve();
                    });

                    this.serialPort.on('close', () => {
                        logger.info('Enhanced Scale Handler disconnected');
                        this.isConnected = false;
                    });

                    // Listen for weight data
                    this.parser.on('data', (data) => {
                        this.handleWeightData(data);
                    });

                    this.serialPort.open();
                } catch (error) {
                    reject(error);
                }
            });
        }

        async disconnect() {
            return new Promise((resolve) => {
                if (this.serialPort && this.serialPort.isOpen) {
                    this.serialPort.close(() => {
                        this.isConnected = false;
                        resolve();
                    });
                } else {
                    resolve();
                }
            });
        }

        async getWeight() {
            if (!this.isConnected) {
                throw new Error('Scale not connected');
            }

            if (this.isWaitingForWeight) {
                throw new Error('Weight reading already in progress');
            }

            return new Promise((resolve, reject) => {
                this.currentWeightPromise = { resolve, reject };
                this.retryCount = 0;
                this.attemptWeightReading();
            });
        }

        async sendCommand(command) {
            if (!this.isConnected) {
                throw new Error('Scale not connected');
            }

            return new Promise((resolve, reject) => {
                this.serialPort.write(command, (err) => {
                    if (err) {
                        reject(new Error(`Failed to send command: ${err.message}`));
                    } else {
                        resolve();
                    }
                });
            });
        }

        attemptWeightReading() {
            if (this.retryCount >= this.config.maxRetries) {
                this.handleWeightError('Weight unstable after maximum retries. Please ensure scale is stable.');
                return;
            }

            logger.info(`Attempting weight reading (${this.retryCount + 1}/${this.config.maxRetries + 1})`);
            this.isWaitingForWeight = true;

            // Set timeout for response
            this.weightTimeout = setTimeout(() => {
                this.handleNoResponse();
            }, this.config.responseTimeout);

            // Send weight command
            this.serialPort.write(this.config.weightCommand, (err) => {
                if (err) {
                    this.handleWeightError(`Failed to send weight command: ${err.message}`);
                }
            });
        }

        handleWeightData(data) {
            // Clear timeout since we got a response
            if (this.weightTimeout) {
                clearTimeout(this.weightTimeout);
                this.weightTimeout = null;
            }

            this.isWaitingForWeight = false;

            // Normalize and parse the weight data. Log the raw frame so onsite
            // support can see exactly what the scale emitted (unit suffixes,
            // status prefixes like "ST,GS,", sign characters, comma vs dot
            // decimal separator, etc.) when a store reports a reading bug.
            const rawString = (typeof data === 'string' ? data : data.toString('utf-8')).trim();
            // Some firmwares use a comma as the decimal separator; normalize
            // it to a dot before stripping non-numeric characters so we don't
            // silently collapse "1,234" into "1234".
            const normalized = rawString.replace(',', '.');
            const cleanWeight = normalized.replace(/[^\d.]/g, '');
            const weightValue = parseFloat(cleanWeight);

            logger.info(`Scale raw: ${JSON.stringify(rawString)}, parsed: ${weightValue}`);

            if (!isNaN(weightValue)) {
                this.retryCount = 0;

                if (this.currentWeightPromise) {
                    this.currentWeightPromise.resolve(weightValue);
                    this.currentWeightPromise = null;
                }
            } else {
                this.handleWeightError('Invalid weight data format received');
            }
        }

        handleNoResponse() {
            this.isWaitingForWeight = false;
            this.retryCount++;

            logger.info(`No response from scale (attempt ${this.retryCount}/${this.config.maxRetries + 1}) - weight may be unstable`);

            if (this.retryCount <= this.config.maxRetries) {
                logger.info(`Retrying in ${this.config.retryDelay}ms...`);
                setTimeout(() => {
                    this.attemptWeightReading();
                }, this.config.retryDelay);
            } else {
                this.handleWeightError('Weight reading failed: Scale indicates unstable weight');
            }
        }

        handleWeightError(errorMessage) {
            this.isWaitingForWeight = false;
            this.retryCount = 0;

            if (this.weightTimeout) {
                clearTimeout(this.weightTimeout);
                this.weightTimeout = null;
            }

            logger.error('Weight reading error:', errorMessage);

            if (this.currentWeightPromise) {
                this.currentWeightPromise.reject(new Error(errorMessage));
                this.currentWeightPromise = null;
            }
        }

        isReady() {
            return this.isConnected && !this.isWaitingForWeight;
        }
    }

    expressApp.get('/openScalePort', async (req, res) => {
        try {
            if (scaleHandler && scaleHandler.isConnected) {
                return res.status(200).send('Scale port already open');
            }

            const config = getScaleConfig();
            scaleHandler = new EnhancedScaleHandler(config);
            
            await scaleHandler.connect();
            logger.info('Scale port opened with enhanced stability handling');
            return res.status(200).send('Serial Port Opened');
        } catch (error) {
            logger.error('Error opening scale port:', error.message);
            return res.status(500).send('Error opening serial port: ' + error.message);
        }
    });

    expressApp.get('/closeScalePort', async (req, res) => {
        try {
            if (!scaleHandler || !scaleHandler.isConnected) {
                return res.status(500).send('Serial port not open to close');
            }

            await scaleHandler.disconnect();
            scaleHandler = null;
            logger.info('Scale port closed successfully');
            return res.status(200).send('Port closed');
        } catch (error) {
            logger.error('Error closing scale port:', error.message);
            return res.status(500).send('Port closing error: ' + error.message);
        }
    });

    expressApp.get('/isScaleConnected', (req, res) => {
        if (scaleHandler && scaleHandler.isConnected) {
            return res.status(200).send('OK');
        } else {
            return res.status(500).send('Serial port not open');
        }
    });

    expressApp.get('/weightScale', async (req, res) => {
        try {
            if (!scaleHandler || !scaleHandler.isConnected) {
                return res.status(500).send('Serial port not open');
            }

            if (!scaleHandler.isReady()) {
                return res.status(409).send('Scale is busy processing another request');
            }

            logger.info('Starting enhanced weight reading with stability handling');
            const weight = await scaleHandler.getWeight();
            
            logger.info(`Weight reading completed: ${weight}`);
            res.send(weight.toString());
        } catch (error) {
            logger.error('Weight reading error:', error.message);
            
            // Provide specific error messages for different scenarios
            if (error.message.includes('unstable')) {
                res.status(408).send('Weight unstable - please ensure items are placed steadily on scale');
            } else if (error.message.includes('already in progress')) {
                res.status(409).send('Weight reading already in progress');
            } else {
                res.status(500).send('Error reading weight: ' + error.message);
            }
        }
    });

    expressApp.get('/zeroScale', async (req, res) => {
        try {
            if (!scaleHandler || !scaleHandler.isConnected) {
                return res.status(500).send('Serial port not open');
            }

            logger.info('Zeroing scale...');
            await scaleHandler.sendCommand(scaleHandler.config.zeroCommand);
            
            logger.info('Scale zeroed successfully');
            res.send('Scale zeroed successfully');
        } catch (error) {
            logger.error('Error zeroing scale:', error.message);
            res.status(500).send('Error zeroing scale: ' + error.message);
        }
    });

    expressApp.get('/restartScale', async (req, res) => {
        try {
            if (!scaleHandler || !scaleHandler.isConnected) {
                return res.status(500).send('Serial port not open');
            }

            logger.info('Restarting scale...');
            await scaleHandler.sendCommand(scaleHandler.config.restartCommand);
            
            logger.info('Scale restart command sent successfully');
            res.send('Scale restart command sent successfully');
        } catch (error) {
            logger.error('Error restarting scale:', error.message);
            res.status(500).send('Error restarting scale: ' + error.message);
        }
    });

    // New endpoint to get enhanced scale status
    expressApp.get('/scaleStatus', (req, res) => {
        if (!scaleHandler) {
            return res.json({
                connected: false,
                ready: false,
                message: 'Scale handler not initialized'
            });
        }

        res.json({
            connected: scaleHandler.isConnected,
            ready: scaleHandler.isReady(),
            waiting: scaleHandler.isWaitingForWeight,
            config: {
                port: scaleHandler.config.port,
                baudRate: scaleHandler.config.baudRate,
                maxRetries: scaleHandler.config.maxRetries,
                retryDelay: scaleHandler.config.retryDelay,
                responseTimeout: scaleHandler.config.responseTimeout
            }
        });
    });

    function restartApp() {
        app.relaunch();
        app.exit(0);
    }

    expressApp.get('/restart', (req, res) => {
        restartApp();
        res.send('App is restarting...');
    });

    // ---- posconfig.json editor (login-screen gear button) -------------------
    // GET returns the CURRENT on-disk content (fresh read, not the boot-time
    // snapshot). POST overwrites the whole file with the posted object; the
    // renderer then calls /restart so every consumer (main + renderer) reloads
    // the new config from scratch.
    expressApp.get('/localConfig', (req, res) => {
        try {
            const exists = fs.existsSync(LOCAL_CONFIG_PATH);
            let cfg = {};
            if (exists) {
                cfg = JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH));
            }
            res.json({ exists, path: LOCAL_CONFIG_PATH, config: cfg });
        } catch (ex) {
            res.status(500).send('Could not read config: ' + (ex && ex.message));
        }
    });

    expressApp.post('/localConfig', (req, res) => {
        try {
            const cfg = req.body;
            if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
                return res.status(400).send('Config must be a JSON object');
            }
            fs.mkdirSync('C:/pos', { recursive: true });
            fs.writeFileSync(LOCAL_CONFIG_PATH, JSON.stringify(cfg, null, 4));
            localConfig = cfg; // refresh the in-memory copy immediately
            logger.info(`posconfig.json updated via login-screen editor (${Object.keys(cfg).length} keys)`);
            res.json({ ok: true, path: LOCAL_CONFIG_PATH });
        } catch (ex) {
            res.status(500).send('Could not save config: ' + (ex && ex.message));
        }
    });

    // Shallow-merge a few keys into posconfig.json without touching the rest
    // (POST /localConfig above REPLACES the whole file). Used by the Arab Bank
    // Visa setup to store the detected COM port / baud. A `null` value deletes
    // the key. Reads the file fresh so an edit made elsewhere is not clobbered.
    expressApp.post('/localConfig/merge', (req, res) => {
        try {
            const patch = req.body;
            if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
                return res.status(400).send('Patch must be a JSON object');
            }
            let current = {};
            if (fs.existsSync(LOCAL_CONFIG_PATH)) {
                try { current = JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH, 'utf8').replace(/^\uFEFF/, '')) || {}; } catch (_) { current = Object.assign({}, localConfig); }
            }
            const changed = [];
            Object.keys(patch).forEach((k) => {
                const key = String(k).trim();
                if (!key) return;
                if (patch[k] === null) {
                    if (key in current) { delete current[key]; changed.push(key); }
                } else if (JSON.stringify(current[key]) !== JSON.stringify(patch[k])) {
                    current[key] = patch[k];
                    changed.push(key);
                }
            });
            fs.mkdirSync('C:/pos', { recursive: true });
            fs.writeFileSync(LOCAL_CONFIG_PATH, JSON.stringify(current, null, 4));
            localConfig = current;
            logger.info(`posconfig.json merged: ${changed.join(', ') || 'no changes'}`);
            res.json({ ok: true, path: LOCAL_CONFIG_PATH, changed, config: current });
        } catch (ex) {
            res.status(500).send('Could not merge config: ' + (ex && ex.message));
        }
    });

    // autoUpdater.checkForUpdates()

    expressApp.get('/checkForUpdates', (req, res) => {
        autoUpdater.checkForUpdates()
        res.send('Checking for updates...');
    });

    // RUN express app
    expressApp.listen(localConfig.expressPort ? localConfig.expressPort : 3001, () => {
        logger.info(`Terminal app listening on port ${localConfig.expressPort ? localConfig.expressPort : '3001'}`)
    })

}
