const { SerialPort, ByteLengthParser } = require('serialport');

let port;

function createPort() {
    port = new SerialPort({
        path: 'COM4',
        baudRate: 9600,
        autoOpen: true
    });

    let parser = port.pipe(new ByteLengthParser({ length: 8 }));

    port.on('error', (err) => {
        console.log('Serial Port Error: ', err.message);
    });

    port.on('open', () => {
        console.log('Serial Port Opened');
    });

    port.on('close', () => {
        console.log('Serial Port Closed');
    });

    parser.once('data', (data) => {
        console.log('Response from scale, trying to read data');
        const buffer = Buffer.from(data, 'utf-8');
        const valueAsString = buffer.toString('utf-8');
        console.log(valueAsString);
        closePort();
    });
}

function closePort() {
    if (port && port.isOpen) {
        port.close((err) => {
            if (err) {
                console.log('Error closing port: ', err.message);
            } else {
                console.log('Port closed successfully');
            }
        });
    }
}

function sendScaleCommand(command, callback) {
    if (port && port.isOpen) {
        port.write(command, (err) => {
            if (err) {
                console.log('Error on write: ', err.message);
            } else {
                callback();
            }
        });
    }
}

// Command to get weight
function getWeight() {
    sendScaleCommand('W', () => {
        console.log('Weight command sent');
    });
}

// Command to zero the scale
function zeroScale() {
    const zeroCommand = 'Z';
    sendScaleCommand(zeroCommand, () => {
        console.log('Zero command sent');
    });
}

// Command to tare the scale
function restartScale() {
    const restartCommand = 'R';
    sendScaleCommand(restartCommand, () => {
        console.log('Tare command sent');
    });
}

// Ensure port is closed properly on exit
process.on('exit', () => {
    closePort();
});

process.on('SIGINT', () => {
    closePort();
    process.exit();
});

// Create and open the serial port
createPort();

setTimeout(getWeight, 1000)

 
/* 

let port;
let parser;

// Initialize the serial port and parser
function initSerialPort() {
    console.log('initializding port', localConfig.scaleCom);
    port = new SerialPort({
        path: localConfig.scaleCom || 'COM1',
        baudRate: localConfig.baudRate || 9600,
        autoOpen: false // Prevent auto-opening, we'll open it manually
    });

    parser = port.pipe(new ByteLengthParser({ length: 8 }));

    port.on('error', (err) => {
        console.log('Serial Port Error: ', err.message);
    });

    port.on('close', () => {
        console.log('Serial Port Closed');
    });

    port.open((err) => {
        if (err) {
            console.log('Error opening serial port: ', err.message);
        } else {
            console.log('Serial Port Opened');
        }
    });
}

// Initialize the serial port
if (localConfig.scale) {
    initSerialPort();
} else {
    console.log('scale not configured for initialization');
}

expressApp.get('/fetchFromScale', (req, res) => {
    if (!port.isOpen) {
        return res.status(500).send('Serial port not open');
    }

    parser.once('data', (data) => {
        console.log('response from scale, trying to read data');
        const buffer = Buffer.from(data, 'utf-8');
        const valueAsString = buffer.toString('utf-8');
        console.log('data returned from scale: ' + valueAsString);
        res.send(valueAsString);
    });

    port.write(localConfig.scaleCommand || '$', (err) => {
        console.log('error writing scale command ');
        if (err) {
            console.log('Error on write: ', err.message);
            res.status(500).send(err.message);
        }
    });
});



*/