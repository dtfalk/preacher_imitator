// Get our readings for each day from the readings file and export for use in backend
const path = require("path");
const fs = require("fs");
const error_logger = require(path.resolve(process.cwd(), "utilities", "initializations", "error_logging.js"));

// Define the path to readings.json
const readingsFilePath = path.resolve(process.cwd(), "local_data", "readings.json");

let readings = {};

try {
    // Read and parse readings.json synchronously
    const readingsData = fs.readFileSync(readingsFilePath, "utf8");
    readings = JSON.parse(readingsData);
} catch (err) {
    const errorMessage = `Error loading readings.json: ${err.message}`;
    
    // Log the error using the singleton error logger
    const logFilePath = path.resolve(process.cwd(), "logs", "errors.log");
    error_logger.logToFile(errorMessage, logFilePath);
    
    console.error(errorMessage);
}

module.exports = readings;
