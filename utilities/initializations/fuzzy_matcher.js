// Initializes the Fuse fuzzy matching object for finding which day the program needs readings from
const path = require("path");
const Fuse = require("fuse.js");
const error_logger = require(path.resolve(process.cwd(), "utilities", "initializations", "error_logging.js"));
const readings = require(path.resolve(process.cwd(), "utilities", "initializations", "readings.js"));

let fuzzy_matcher;

try {
    // Ensure readings are available
    const readingKeys = Object.keys(readings);

    // Initialize the Fuse fuzzy matching object synchronously
    fuzzy_matcher = new Fuse(readingKeys, {
        includeScore: true,
        threshold: 0.9
    });

} catch (err) {
    const errorMessage = `Error initializing Fuse.js: ${err.message}`;
    
    // Log the error using the error logger
    error_logger.logToFile(errorMessage);

    console.error(errorMessage);
}

module.exports = fuzzy_matcher;

