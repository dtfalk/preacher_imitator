// File to initialize our pinecone client
const { Pinecone } = require("@pinecone-database/pinecone");
const path = require("path");
const error_logger = require(path.resolve(process.cwd(), "utilities", "initializations", "error_logging.js")); // Import error logger

let pineconeClient;

try {
    if (!process.env.PINECONE_API_KEY) {
        throw new Error("Missing PINECONE_API_KEY in environment variables.");
    }

    pineconeClient = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
    });

    pinecone_index = pineconeClient.Index("father-foley-homilies");

} catch (err) {
    const errorMessage = `Error initializing Pinecone client: ${err.message}`;

    // Log the error using the error logger
    error_logger.logToFile(errorMessage, logFilePath);

    // Still print to console for debugging
    console.error(errorMessage);

    // Exit since Pinecone is required for the app to function
    process.exit(1);
}

module.exports = pinecone_index;
