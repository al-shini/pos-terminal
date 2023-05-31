const path = require("path");
const fs = require('fs');
const fsPromises = require('fs/promises');
const { downloadRelease } = require('@terascope/fetch-github-release');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser')
const PDFDocument = require('pdfkit');
const { exec } = require("child_process");
const stream = require('./stream');
const qr = require('qrcode');
const bwipjs = require('bwip-js');
const { app, BrowserWindow, dialog } = require("electron");
const isDev = require("electron-is-dev");
const crypto = require('crypto');
const net = require('net');
const { autoUpdater } = require("electron-updater")


let localConfigFile = fs.readFileSync('C:/pos/posconfig.json');
let localConfig = JSON.parse(localConfigFile);
const config = {
    qrBaseUrl: 'http://46.43.70.210:81/process-customer-entry.xhtml'
}
const axiosImport = require('axios');
const axios = axiosImport.create({
    baseURL: 'http://' + localConfig.serverIp + ':8080/'
});


// Conditionally include the dev tools installer to load React Dev Tools
let installExtension, REACT_DEVELOPER_TOOLS; // NEW!

if (isDev) {
    const devTools = require("electron-devtools-installer");
    installExtension = devTools.default;
    REACT_DEVELOPER_TOOLS = devTools.REACT_DEVELOPER_TOOLS;
} // NEW!


function createWindow() {
    // Create the browser window.
    const win = new BrowserWindow({
        width: 1024,
        height: 768,
        resizable: true,
        show: true,
        fullscreen: true,
        webPreferences: {
            nodeIntegration: true,
            webSecurity: false
        }
    });

    win.setMenu(null);

    const params = `serverIp=${localConfig.serverIp}&deviceId=${localConfig.deviceId}`;

    // and load the index.html of the app.
    win.loadURL(isDev ? `http://localhost:3000?${params}` : `file://${__dirname}/../build/index.html?${params}`);

    win.show();
    // Open the DevTools.
    if (localConfig.devTools) {
        win.webContents.openDevTools({ mode: "detach" });
    }

}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow);

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
                .then(name => console.log(`Added Extension:  ${name}`))
                .catch(error => console.log(`An error occurred: , ${error}`));
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
            console.log('ex', ex);
        }

        doc.pipe(writeStream);
        doc.fontSize(15);
        let g = 50;

        doc.font('C:\\pos\\arial.ttf')
        doc.image(logo, 55, 15 + g, { width: 100, height: 25 });
        doc.image(qrFileName, 110, 40 + g, { width: 100, height: 100 });
        doc.font('C:\\pos\\VT323.ttf');
        doc.text('Total: ' + object.total + ' ILS', 15, 50 + g);
        doc.text('Discount: ' + object.discount + ' ILS', 15, 65 + g);
        doc.text('Paid: ' + object.paid + ' ILS', 15, 80 + g);
        doc.text('Change: ' + object.change + ' ILS', 15, 95 + g);
        doc.text('Paid By: CASH', 15, 110 + g);

        doc.fontSize(13)
        doc.text('Store: ' + object.store, 15, 140 + g);
        doc.text('Cashier: ' + object.cashier, 15, 160 + g);
        doc.text(object.date, 15, 182 + g);

        doc.end()

        writeStream.on('finish', () => {
            const base64 = writeStream.toBuffer().toString('base64')
            fs.writeFile(invoiceFileName, base64, 'base64', (err) => {
                if (err) {
                    console.log('ERROR', err);
                }
                // print.print(invoiceFileName);
                console.log('printing...............................');
                exec(
                    'ptp.exe invoice.pdf', {
                    cwd: 'C:\\pos\\',
                    windowsHide: true
                }, (e) => {
                    if (e) {
                        throw e;
                    }
                });
            });
        });

    })
}

const printWithBarcode = (object) => {
    let writeStream = new stream.WritableBufferStream();
    const barcodeFileName = 'C:\\pos\\barcode.png'
    const invoiceFileName = 'C:\\pos\\invoice.pdf'
    const logo = 'C:\\pos\\logo.png'

    const doc = new PDFDocument({
        size: [203, 400],
        margins: { // by default, all are 72
            top: 5,
            bottom: 5,
            left: 5,
            right: 5
        }
    });


    bwipjs.toBuffer({
        bcid: 'code128',       // Barcode type
        text: 'SUS-' + object.nanoId,    // Text to encode
        scale: 2,               // 3x scaling factor
        height: 6,              // Bar height, in millimeters
        includetext: true,            // Show human-readable text
        textxalign: 'center',        // Always good to set this
    })
        .then(png => {
            fs.writeFile(barcodeFileName, png, function (err) {
                if (err) {
                    dialog.showErrorBox('Error', err)
                    return console.log(err);
                }

                doc.pipe(writeStream);
                doc.fontSize(13);
                let g = 80;

                doc.font('C:\\pos\\VT323.ttf');
                doc.image(logo, 55, 15 + g, { width: 100, height: 25 });
                doc.text('SUSPENDED TRANSACTION', 55, 40 + g);

                doc.image(barcodeFileName, 15, 65 + g, { width: 193, height: 50 });
                doc.text('Total: ' + object.total + ' ILS', 15, 130 + g);
                doc.text('Store: ' + object.store, 15, 155 + g);
                doc.text('Cashier: ' + object.cashier, 15, 175 + g);
                doc.text(object.date, 15, 190 + g);

                doc.end()

                writeStream.on('finish', () => {
                    const base64 = writeStream.toBuffer().toString('base64')
                    fs.writeFile(invoiceFileName, base64, 'base64', (err) => {
                        if (err) {
                            console.log('ERROR', err);
                        }
                        // print.print(invoiceFileName);
                        exec(
                            'ptp.exe invoice.pdf', {
                            cwd: 'C:\\pos\\',
                            windowsHide: true
                        }, (e) => {
                            if (e) {
                                throw e;
                            }
                        });
                    });
                });

            });
            // `png` is a Buffer as in the example above
        })
        .catch(err => {
            // `err` may be a string or Error object
        });
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
        console.log(e);
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
        console.log(e);
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
        console.log(e);
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

                const qrUrl = config.qrBaseUrl + '?sptr=' + trx.key + '_' + trx.nanoId;
                let date = trx.dateAsString;
                if (trx.status === 'SUSPENDED') {
                    // print suspended slip
                    printWithBarcode({
                        nanoId: trx.nanoId,
                        total: trx.totalafterdiscount,
                        discount: trx.totaldiscount,
                        paid: trx.paidamt,
                        change: trx.customerchange,
                        date,
                        store: trx.branch,
                        cashier: trx.username
                    });
                } else {
                    printWithQR({
                        qr: qrUrl,
                        total: trx.totalafterdiscount,
                        discount: trx.totaldiscount,
                        paid: trx.paidamt,
                        change: trx.customerchange,
                        date,
                        store: trx.branch,
                        cashier: trx.username
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
        console.log(e);
        dialog.showErrorBox('Error', e)
        res.send(e);
    }
})

expressApp.post('/linkTerminalWithBopVisa', async (req, res) => {
    try {

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
        const privateKeyStream = fs.createWriteStream("C:\\pos\\release\\private.key");
        privateKeyStream.write(privateKey);
        privateKeyStream.end();
        // create the public.key file
        const publicKeyStream = fs.createWriteStream("C:\\pos\\release\\public.key");
        publicKeyStream.write(publicKey);
        publicKeyStream.end();

        // open a client socket with the VISA machine and issue
        const client = new net.Socket();
        let received = '';

        console.log(bopVisaIp);

        client.connect(7800, bopVisaIp);
        client.setEncoding('utf8');
        client.setTimeout(180 * 1000); // timeout must be greater than terminal timeout

        /* begin call back events for visa socket */
        client.on('data', function (response) {
            console.log('\n[data event] => ', response);
            received += response;
        });

        client.on('error', function (response) {
            console.log('[error event] => ', response);
            throw new Error(response);
        });

        client.on('close', function (response) {
            const initResponse = JSON.parse(received);
            console.log('initResponse', initResponse);
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
                    if (error.response) {
                        dialog.showErrorBox('Error', 'Un-Authorized')
                    } else {
                        dialog.showErrorBox('Error', error.message)
                    }
                    res.send('error');
                });


            } else {
                throw new Error('invalid init response structure')
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
        console.log('Sending -> ', message)
        client.write(message);


    } catch (e) {
        console.log(e);
        dialog.showErrorBox('Error', e)
        res.status(500).send(e);
    }
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

        /* begin call back events for visa socket */
        client.on('data', function (response) {
            // console.log('\n[data event] => ', response);
            received += response;
        });

        client.on('error', function (response) {
            console.log('[error event] => ', response);
            throw new Error(response);
        });

        client.on('close', function (response) {
            const saleResponse = JSON.parse(decryptObject(received.substring(ReqRespPrefixLen), terminal.localPrivateRsa));
            // console.log(saleResponse);
            res.send(saleResponse);
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
        // console.log('Sending -> ', message);
        client.write(message);

    } catch (e) {
        console.log(e);
        res.status(500).send(e);
        dialog.showErrorBox('Error', e)
    }
})

expressApp.listen(3001, () => {
    console.log(`Terminal app listening on port 3001`)
})

autoUpdater.checkForUpdatesAndNotify();