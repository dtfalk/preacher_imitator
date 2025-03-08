// Initializes the SQLite database for the bible readings
const path = require("path");
const sqlite3 = require("sqlite3");
const error_logger = require(path.resolve(process.cwd(), "utilities", "initializations" ,"error_logging.js"));

// Initialize the database
const database_path = path.resolve(process.cwd(), "local_data", "ASV.db");
const bible_db = new sqlite3.Database(database_path, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        const errorMessage = `Error opening database: ${err.message}`;
        
        // Log the error in errors.txt
        error_logger.logToFile(errorMessage);
        
        // print to console for immediate debugging
        console.error(errorMessage);
    }
});

module.exports = bible_db;
