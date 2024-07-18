const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize } = format;
const path = require('path');
const fs = require('fs');

// Ensure the logs directory exists
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

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
        new transports.File({ filename: path.join(logDir, 'app.log'), level: 'info' })
    ]
});

module.exports = logger;
