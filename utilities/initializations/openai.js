// File to initialize our openai client
const OpenAI = require("openai");
const path = require("path");
const error_logger = require(path.resolve(process.cwd(), "utilities", "initializations", "error_logging.js"));

let openai_client;

try {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("Missing OPENAI_API_KEY in environment variables.");
    }

    openai_client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

} catch (err) {
    const errorMessage = `Error initializing OpenAI client: ${err.message}`;

    // Log the error using the error logger
    error_logger.logToFile(errorMessage);

    // Still print to console for debugging
    console.error(errorMessage);

    // Exit since OpenAI client is required for the app to function
    process.exit(1);
}

module.exports = openai_client;
