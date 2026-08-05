const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize } = format;
const path = require('path');
const fs = require('fs');
const os = require('os');

// Where to write log files.
//
// In development __dirname/logs works and is where everyone expects the logs
// to be. In a PACKAGED build __dirname is inside app.asar, a read-only
// archive: the file transport dies silently and every production log line is
// simply lost — which is exactly the situation in which logs are needed most.
// So each candidate is probed with a real write, and the first one that takes
// it wins. C:\pos is already this app's home for its config and BOP keys.
const candidateDirs = [
    path.join(__dirname, 'logs'),
    process.platform === 'win32' ? 'C:\\pos\\logs' : null,
    path.join(os.homedir(), '.dazzle-pos', 'logs')
].filter(Boolean);

const logDir = candidateDirs.find((dir) => {
    try {
        fs.mkdirSync(dir, { recursive: true });
        const probe = path.join(dir, '.write-probe');
        fs.writeFileSync(probe, String(Date.now()));
        fs.unlinkSync(probe);
        return true;
    } catch (ignored) {
        return false;
    }
});

// Custom log format
const logFormat = printf(({ level, message, timestamp }) => {
    return `[${level}] [${timestamp}] - ${message}`;
});

// Create the logger
const logger = createLogger({
    format: combine(
        timestamp(),
        // colorize(),
        logFormat
    ),
    transports: [
        new transports.Console(),
        ...(logDir
            ? [new transports.File({ filename: path.join(logDir, 'app.log'), level: 'info' })]
            : [])
    ]
});

if (logDir) {
    logger.info('log file: ' + path.join(logDir, 'app.log'));
} else {
    logger.warn('no writable log directory found — file logging disabled');
}

module.exports = logger;
