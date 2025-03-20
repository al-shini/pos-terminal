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
const crypto = require('crypto');
const net = require('net');
const { autoUpdater } = require("electron-updater")
const { print } = require("pdf-to-printer");
const { SerialPort } = require('serialport')
const printComplete = require('./printComplete');
const { ReadlineParser } = require('@serialport/parser-readline');
const logger = require('./logger');
const { ipcMain } = require('electron');
const https = require('https');

let localConfigFile = fs.readFileSync('C:/pos/posconfig.json');
// let localConfigFile = fs.readFileSync('/etc/pos/posconfig.json');

let localConfig = JSON.parse(localConfigFile);
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

    let params = `serverIp=${localConfig.serverIp}&deviceId=${localConfig.deviceId}`;

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
    if (localConfig.systemCurrency) {
        params += `&systemCurrency=${localConfig.systemCurrency}`;
    } else {
        params += `&systemCurrency=NIS`;
    }


    logger.info(params);

    // and load the index.html of the app.
    win.loadURL(isDev ? `http://localhost:3000?${params}` : `file://${__dirname}/../build/index.html?${params}`);

    win.show();

    // customer screen options 
    if (localConfig.showCustomerScreen) {
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

        // customerScreen.webContents.openDevTools();

        // and load the index.html of the app.
        customerScreen.loadURL(isDev ? `http://localhost:3000/#/customer?${params}` : `file://${__dirname}/../build/index.html#/customer?${params}`);
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
        createLogWindow();
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
            doc.text('Paid: ' + object.paid + '', 15, 80 + g);
            doc.text('Change: ' + object.change + '', 15, 95 + g);
            doc.text('Type: ' + object.type, 15, 110 + g);

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
                        print('C:\\pos\\invoice.pdf', {});
                    } else if (!localConfig.printMethod || localConfig.printMethod === 'ptp') {
                        exec(
                            'ptp.exe invoice.pdf', {
                            cwd: 'C:\\pos\\',
                            windowsHide: true
                        }, (e) => {
                            if (e) {
                                throw e;
                            }
                        });
                    }
                });
            });

        })
    }

    const fixRsaFormat = (data) => {
        data = data.replace('-----BEGIN PUBLIC KEY-----', '');
        data = data.replace('-----END PUBLIC KEY-----', '');
        data = data.replace('-----BEGIN PRIVATE KEY-----', '');
        data = data.replace('-----END PRIVATE KEY-----', '');
        data = data.replace(/(\r\n|\n|\r)/gm, "");
        return data;
    }

    const generateEncryptedKeyFromVisaPubKey = (visaPublicRsaKey) => {
        try {
            const key = crypto.randomBytes(32);
            let prefixedKey = '-----BEGIN PUBLIC KEY-----\n'.concat(visaPublicRsaKey).concat('\n-----END PUBLIC KEY-----');
            const encryptedKey = crypto.publicEncrypt({
                key: prefixedKey,
                padding: crypto.constants.RSA_PKCS1_PADDING
            }, key);

            return {
                key,
                encryptedKey
            };
        } catch (e) {
            logger.info(e);
            throw e;
        }
    }

    const encryptObject = (object, visaPublicRsaKey) => {
        try {
            const objectAsText = JSON.stringify(object);
            const _key = generateEncryptedKeyFromVisaPubKey(visaPublicRsaKey);
            const cipher = crypto.createCipheriv('aes-256-ecb', _key.key, '');
            let encryptedObject = cipher.update(objectAsText, 'utf-8', 'base64');
            encryptedObject += cipher.final('base64');

            return {
                k: _key.encryptedKey.toString('base64'),
                d: encryptedObject
            }
        } catch (e) {
            logger.info(e);
            throw e;
        }
    }

    const decryptObject = (cipherJson, terminalPrivateRsaKey) => {
        try {
            const encryptedMsg = JSON.parse(cipherJson);
            const plainAesKey = crypto.privateDecrypt({
                key: terminalPrivateRsaKey,
                padding: crypto.constants.RSA_PKCS1_PADDING
            }, Buffer.from(encryptedMsg.k, 'base64'));

            const aes32Key = Buffer.alloc(32);
            plainAesKey.copy(aes32Key, 0, 0, 32);

            const decCipher = crypto.createDecipheriv('aes-256-ecb', aes32Key, '');
            return decCipher.update(encryptedMsg.d, 'base64', 'utf-8') + decCipher.final('utf-8');
        } catch (e) {
            logger.info(e);
            throw e;
        }
    }

    expressApp.get('/printTrx', async (req, res) => {
        try {
            axios({
                method: 'post',
                url: '/trx/fetchTrx',
                headers: {
                    'trxKey': req.query.trxKey
                }
            }).then((response) => {
                if (response && response.data) {

                    const trx = response.data;

                    // const qrUrl = config.qrBaseUrl + '?sptr=' + trx.key + '_' + trx.nanoId;
                    const qrUrl = 'https://plus.shini.ps/invoice?sptr=' + trx.key + '_' + trx.nanoId;

                    let date = trx.dateAsString;

                    if (!localConfig.printTemplate || localConfig.printTemplate === 'qr') {
                        printWithQR({
                            qr: qrUrl,
                            total: trx.totalafterdiscount,
                            discount: trx.totaldiscount,
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

                        if (!req.query.ignoreDrawer) {
                            oposServiceAxios({
                                method: 'get',
                                url: '/open-drawer'
                            }).then((_res) => {
                                console.log(_res);
                            }).catch((_error) => {
                                throw _error;
                            });
                        }

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
                            throw _error;
                        });


                    }

                    if (trx.campaignList) {
                        const pdfUrl = 'https://image.shini.ps/slip.pdf';
                        const localPdfPath = 'C:/pos/slip.pdf';
                        https.get(pdfUrl, (response) => {
                            const file = fs.createWriteStream(localPdfPath);
                            response.pipe(file);
                            file.on('finish', () => {
                                file.close();
                                console.log('Download complete. Sending to printer...');
                                // Print the PDF
                                print(localPdfPath);
                            });
                        }).on('error', (err) => {
                            console.error('Error downloading the PDF:', err);
                        });
                    }

                    res.send(trx);
                }
            }).catch((error) => {
                if (error.response) {
                    dialog.showErrorBox('Error', 'Un-Authorized')
                } else {
                    dialog.showErrorBox('Error', error.message)
                }
                res.send('error');
            });


        } catch (e) {
            logger.info(e);
            dialog.showErrorBox('Error', e)
            res.send(e);
        }
    })

    expressApp.post('/linkTerminalWithBopVisa', async (req, res) => {
        const terminalKey = req.body.terminalKey;
        const bopVisaIp = req.body.bopVisaIp;

        // generate private and public keys for terminal & store them in the local pos files path
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 4096,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });
        // create the private.key file
        const privateKeyStream = fs.createWriteStream("C:\\pos\\private.key");
        privateKeyStream.write(privateKey);
        privateKeyStream.end();
        // create the public.key file
        const publicKeyStream = fs.createWriteStream("C:\\pos\\public.key");
        publicKeyStream.write(publicKey);
        publicKeyStream.end();

        // open a client socket with the VISA machine and issue
        const client = new net.Socket();
        let received = '';

        logger.info(bopVisaIp);

        client.connect(7800, bopVisaIp);
        client.setEncoding('utf8');
        client.setTimeout(80 * 1000); // timeout must be greater than terminal timeout

        /* begin call back events for visa socket */
        client.on('data', function (response) {
            logger.info('Data Event on Socket => ');
            logger.info(response);
            received += response;
        });

        client.on('error', function (response) {
            logger.info('Error Event on Socket => ');
            logger.info(response);
            res.status(500).send(response);
        });

        client.on('close', function (response) {
            let initResponse = undefined;
            try {
                // try and parse receievd JSON
                logger.info("Recieved JSON ->");
                logger.info(received);
                initResponse = JSON.parse(received);
            } catch (parseError) {
                logger.info('could not parse the received json');
                return;
            }

            logger.info('initResponse', initResponse);
            if (initResponse && initResponse.rsaPubKey) {
                const visaPubKey = initResponse.rsaPubKey;
                // link the private and public key pairs with the terminal object in the backend, alongside the visa machine details
                axios({
                    method: 'post',
                    url: '/trx/linkTerminalWithBopVisa',
                    data: {
                        terminalKey: terminalKey,
                        terminalPrivateRsaKey: privateKey,
                        terminalPublicRsaKey: publicKey,
                        visaIp: bopVisaIp,
                        visaPublicRsaKey: visaPubKey
                    }
                }).then((response) => {
                    if (response && response.data) {
                        res.send(response.data);
                    }
                }).catch((error) => {
                    res.status(500).send({ error: error.message })
                });
            } else {
                res.status(500).send({ error: 'Invalid Response from VISA '.concat(JSON.stringify(initResponse)) })
            }
        });
        /* end call back events for visa socket */

        // send the request to the visa machine
        const initRequestObject = JSON.stringify({
            lang: 0,
            type: 'INIT',
            rsaPubKey: fixRsaFormat(publicKey)
        });
        let length = initRequestObject.length;
        while ((length + '').length < 4) {
            length = '0' + length;
        }
        message = '~PCNC~' + length + '~' + initRequestObject;

        logger.info('Sending -> ')
        logger.info(message)

        client.write(message);

    })

    expressApp.post('/bopVisaSale', async (req, res) => {
        try {
            const terminal = req.body.terminal;
            if (!terminal || !terminal.bopVisaIp || !terminal.bopVisaPublicRsa) {
                // invalid terminal structure
                res.status(500).send('Terminal not linked with BOP visa');
                return;
            }
            const trxId = req.body.trxId;
            const amt = req.body.amt;
            const cur = req.body.cur;

            // open a client socket with the VISA machine and issue
            const client = new net.Socket();
            let received = '';

            client.connect(7800, terminal.bopVisaIp);
            client.setEncoding('utf8');
            client.setTimeout(180 * 1000); // timeout must be greater than terminal timeout
            const ReqRespPrefixLen = 11;
            let sent = false;

            /* begin call back events for visa socket */
            client.on('data', function (response) {
                // logger.info('\n[data event] => ', response);
                received += response;
            });

            client.on('error', function (response) {
                logger.info('[error event] => ', response);
                if (!sent) {
                    res.status(500).send(response);
                    sent = true;
                }
            });

            client.on('close', function (response) {
                try {
                    const saleResponse = JSON.parse(decryptObject(received.substring(ReqRespPrefixLen), terminal.localPrivateRsa));
                    logger.info(saleResponse);
                    res.send(saleResponse);
                } catch (ex) {
                    logger.info('[close event error] => ', response);
                    if (!sent) {
                        res.status(500).send({ error: response })
                        sent = true;
                    }
                }

            });
            /* end call back events for visa socket */

            // send the request to the visa machine
            const encryptedSaleObject = encryptObject({
                lang: 0,
                type: 'SALE',
                amt,
                cur,
                rcpt: trxId
            }, terminal.bopVisaPublicRsa);

            let message = '~PCNC~';
            const objectAsString = JSON.stringify(encryptedSaleObject);
            let length = objectAsString.length;

            while ((length + '').length < 4)
                length = '0' + length;

            message += length + '~' + objectAsString;
            // logger.info('Sending -> ', message);
            client.write(message);

        } catch (e) {
            logger.info(e);
            res.status(500).send(e);
        }
    })

    let port;
    let parser;

    expressApp.get('/openScalePort', (req, res) => {
        port = new SerialPort({
            path: localConfig.scaleCOM || 'COM1',
            baudRate: localConfig.baudRate || 9600,
            autoOpen: false // Prevent auto-opening, we'll open it manually
        });

        parser = port.pipe(new ReadlineParser({ delimiter: '\n' })); // LF as delimiter

        port.open((err) => {
            if (err) {
                logger.error('Error opening serial port: ', err.message);
                return res.status(500).send('Error opening serial port: '.concat(err.message));
            } else {
                return res.status(200).send('Serial Port Opened');
            }
        });
    });

    expressApp.get('/closeScalePort', (req, res) => {
        if (!port.isOpen) {
            return res.status(500).send('Serial port not open to close');
        } else {
            port.close();
            port.on('close', () => {
                return res.status(200).send('Port closed');
            });
            port.on('error', (err) => {
                logger.info('Serial Port closing error: ', err.message);
                return res.status(200).send('Port closing error');
            });
        }
    });

    expressApp.get('/isScaleConnected', (req, res) => {
        if (port && port.isOpen) {
            return res.status(200).send('OK');
        } else {
            return res.status(500).send('Serial port not open');
        }
    });

    expressApp.get('/weightScale', (req, res) => {
        if (!port.isOpen) {
            return res.status(500).send('Serial port not open');
        }
        let responded = false;

        parser.once('data', (data) => {
            logger.info(data);
            const buffer = Buffer.from(data, 'utf-8');
            const valueAsString = buffer.toString('utf-8');
            logger.info(valueAsString);

            const digitsOnly = valueAsString.replace(/[^\d.]/g, '');
            logger.info('scale data: '.concat(digitsOnly));
            responded = true;
            res.send(digitsOnly);
        });

        port.write(localConfig.scaleWeightCommand || '$', (err) => {
            logger.info('sent command '.concat(localConfig.scaleWeightCommand || '$'));
            if (err) {
                logger.error(err);
                logger.error('error writing weightScale command?');
                responded = true;
                res.status(500).send('error writing weightScale command ');
            }
        });
    });

    expressApp.get('/zeroScale', (req, res) => {
        if (!port.isOpen) {
            return res.status(500).send('Serial port not open');
        }

        parser.once('data', (data) => {
            const buffer = Buffer.from(data, 'utf-8');
            const valueAsString = buffer.toString('utf-8');
            res.send(valueAsString);
        });

        port.write(localConfig.scaleZeroCommand || 'Z', (err) => {
            if (err) {
                logger.error(err);
                logger.info('error writing scale command ');
                res.status(500).send('error writing zeroScale command ');
            }
        });
    });

    expressApp.get('/restartScale', (req, res) => {
        if (!port.isOpen) {
            return res.status(500).send('Serial port not open');
        }

        parser.once('data', (data) => {
            AAAAAAAAAAA
            const buffer = Buffer.from(data, 'utf-8');
            const valueAsString = buffer.toString('utf-8');
            res.send(valueAsString);
        });

        port.write(localConfig.scaleRestartCommand || 'Z', (err) => {
            if (err) {
                logger.error(err);
                logger.error('error writing restartScale command ');
                res.status(500).send('error writing restartScale command ');
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
