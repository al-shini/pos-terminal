const path = require("path");
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser')
const fs = require('fs');
const https = require('https');
const print = require('pdf-to-printer');
const PDFDocument = require('pdfkit');
const stream = require('./stream');
const qr = require('qrcode');
const bwipjs = require('bwip-js');
const unzipper = require('unzipper');
const { app, BrowserWindow } = require("electron");
const isDev = require("electron-is-dev");
let localConfigFile = fs.readFileSync('C:/posconfig.json');
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


// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require("electron-squirrel-startup")) {
    app.quit();
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
            nodeIntegration: true
        }
    });

    win.setMenu(null);

    const params = `serverIp=${localConfig.serverIp}&deviceId=${localConfig.deviceId}`;

    // and load the index.html of the app.

    win.loadURL(
        isDev
            ? `http://127.0.0.1:3000?${params}`
            : `file://${path.join(__dirname, "../build/index.html?" + params)}`
    );

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
    const qrFileName = 'qr.png'
    const invoiceFileName = 'invoice.pdf'

    const doc = new PDFDocument({ size: 'A4' });

    qr.toFile(qrFileName, object.qr, (ex, url) => {
        if (ex) {
            console.log('ex', ex);
        }

        doc.pipe(writeStream);

        doc.font('arial.ttf')
        doc.fontSize(40);
        doc.text(object.header, 45, 10, { width: 590, features: ['rtla'] });
        doc.text('---------------------------------------', 20, 50, { width: 590 });
        doc.image(qrFileName, 135, 100, { width: 300, height: 300 });

        doc.fontSize(30);
        doc.text('( ' + object.amount + ' )', 45, 400, { width: 590, features: ['rtla'] });
        doc.text(object.date, 380, 400, { width: 590, features: ['rtla'] });

        doc.text('___________________________________', 20, 425, { width: 590 });

        for (let i = 0; i < object.lines.length; i++) {
            const line = object.lines[i];
            doc.fontSize(30);
            doc.text(line, 50, 480 + (i * 50), { width: 590, features: ['rtla'] });
        }

        doc.end()

        writeStream.on('finish', () => {
            const base64 = writeStream.toBuffer().toString('base64')
            fs.writeFile(invoiceFileName, base64, 'base64', (err) => {
                if (err) {
                    console.log('ERROR', err);
                }
                print.print(invoiceFileName);
            });
        });

    })
}

const printWithBarcode = (object) => {
    let writeStream = new stream.WritableBufferStream();
    const barcodeFileName = 'barcode.png'
    const invoiceFileName = 'invoice.pdf'
    const doc = new PDFDocument({ size: 'A4' });


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
                if (err) return console.log(err);

                doc.pipe(writeStream);

                doc.font('arial.ttf')
                doc.fontSize(40);
                doc.text(object.header, 45, 10, { width: 590, features: ['rtla'] });
                doc.text('---------------------------------------', 20, 50, { width: 590 });
                doc.image(barcodeFileName, 45, 100, { width: 500, height: 100 });

                doc.fontSize(30);
                doc.text('( ' + object.amount + ' )', 45, 220, { width: 590, features: ['rtla'] });
                doc.text(object.date, 400, 220, { width: 590, features: ['rtla'] });

                doc.text('___________________________________', 20, 240, { width: 590 });

                for (let i = 0; i < object.lines.length; i++) {
                    const line = object.lines[i];
                    doc.fontSize(30);
                    doc.text(line, 50, 280 + (i * 50), { width: 590, features: ['rtla'] });
                }

                doc.end()

                writeStream.on('finish', () => {
                    const base64 = writeStream.toBuffer().toString('base64')
                    fs.writeFile(invoiceFileName, base64, 'base64', (err) => {
                        if (err) {
                            console.log('ERROR', err);
                        }
                        print.print(invoiceFileName);
                    });
                });

            });
            // `png` is a Buffer as in the example above
        })
        .catch(err => {
            // `err` may be a string or Error object
        });
}

expressApp.get('/printTrx', async (req, res) => {
    try {
        console.log(req.query.trxKey);
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

                const amount = trx.totalafterdiscount + ' ₪';

                if (trx.status === 'SUSPENDED') {
                    // print suspended slip
                    printWithBarcode({
                        header: 'تم تعليق هذه الفاتورة - سوبرماركت الشني',
                        nanoId: trx.nanoId,
                        amount,
                        date,
                        lines: ['الرجاء الإحتفاظ بهذه القسيمة لاستكمال الفاتورة']
                    });
                } else {
                    printWithQR({
                        header: 'شكرا لتسوقكم لدى سوبرماركت الشني',
                        qr: qrUrl,
                        amount,
                        date,
                        lines: trx.type === 'Sale' ? ['لمعرفة تفاصيل فاتورتك قم بمسح رمز الـ )RQ( '] : ['لمعرفة تفاصيل فاتورتك قم بمسح رمز الـ )RQ( ', ' ************* وصل حركة إرجاع ************* ']
                    });
                }
                res.send(trx);
            }
        }).catch((error) => {
            if (error.response) {
                alert('Un-Authorized')
            } else {
                alert(error.message)
            }
            res.send('error');
        });


    } catch (e) {
        console.log(e);
        res.send(e);
    }
})

expressApp.listen(3001, () => {
    console.log(`Terminal app listening on port 3001`)
})

require('update-electron-app')({
    repo: 'al-shini/pos-terminal',
    updateInterval: '5 minutes'
})