const { SerialPort, ByteLengthParser } = require('serialport');
const WebSocket = require('ws');

const port = new SerialPort({
    path: 'COM4',
    baudRate: 9600,
    autoOpen: true
});

const parser = port.pipe(new ByteLengthParser({ length: 10 }));

port.on('error', (err) => {
    console.log('Serial Port Error: ', err.message);
});

port.on('open', () => {
    console.log('Serial Port Opened');
});

port.on('close', () => {
    console.log('Serial Port Closed');
});

// Setup WebSocket server
const wss = new WebSocket.Server({ port: 8089 });

wss.on('connection', (ws) => {
    console.log('WebSocket connection established');
});

function sendScaleCommand(command) {
    return new Promise((resolve, reject) => {
        parser.once('data', (data) => {
            const buffer = Buffer.from(data, 'utf-8');
            const valueAsString = buffer.toString('utf-8');
            resolve(valueAsString);
        });

        port.write(command, (err) => {
            if (err) {
                reject('Error on write: ' + err.message);
            }
        });
    });
}

async function continuouslyReadWeight() {
    while (true) {
        try {
            const weight = await sendScaleCommand('W');
            console.log(weight.substr(2));
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(weight);
                }
            });
            await new Promise(resolve => setTimeout(resolve, 500)); // 1-second interval
        } catch (error) {
            console.log('Error reading weight:', error);
        }
    }
}

// Start reading weight continuously
continuouslyReadWeight();
