// write me a homily for pentecost sunday
const OpenAI = require('openai');
const fsp = require('fs').promises;
const fs = require('fs');
const path = require('path');
const { Pinecone } = require('@pinecone-database/pinecone');

const errorPath = path.join(__dirname, '..', 'consoleResponses', 'errors.txt');

// ========================================================================================================================================================================
// ==================================== CLIENT INITIALIZATIONS ============================================================================================================
// ========================================================================================================================================================================

// Initialize Pinecone client
let pineconeClient;
pineconeClient = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});
const index = pineconeClient.Index('father-foley-homilies')

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey:  process.env.OPENAI_API_KEY,
});

// ========================================================================================================================================================================
// ==================================== CLASSES ===========================================================================================================================
// ========================================================================================================================================================================

// Ensures that only one person at a time can access the error file
class FileQueueErrorFile {
  constructor() {
    this.queue = Promise.resolve();
  }
  async enqueue(task) {
    try {
      this.queue = this.queue.then(() => task());
      return this.queue;
    } catch (error) {
      console.error('error adding to the log file: ', error.message);
    }
  }
}

const fileQueueErrorFile = new FileQueueErrorFile();

// ========================================================================================
// =========================== File Writing and Logging ===================================
// ========================================================================================

// Log messages to a file
async function logToFile(message, filePath) {
  if (!fs.existsSync(path.dirname(filePath))) {
    await fsp.mkdir(path.dirname(filePath));
  }
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp}: ${message}\n`;
  await fsp.appendFile(filePath, logEntry, 'utf8', (err) => {
    if (err) {
      console.error('Error appending to log file:', err);
    }
  });
}

// ========================================================================================
// ============================ Pinecone Retrieval Functions ==============================
// ========================================================================================

// Get the embedding for a query using OpenAI's embedding endpoint
async function getQueryEmbedding(query) {
  try {
    const embeddingResponse = await openai.embeddings.create({
      input: query,
      model: "text-embedding-3-large", 
    });
    if (!embeddingResponse.data) {
      throw new Error("No embedding data returned");
    }
    return embeddingResponse.data[0].embedding;
  } catch (error) {
    console.error("Error getting query embedding:", error.message);
    throw error;
  }
}

// Query Pinecone using the provided query embedding
async function queryPinecone(queryEmbedding, topK = 3) {
  try {
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: topK,
      includeMetadata: true,
    });
    return queryResponse.matches || [];
  } catch (error) {
    console.error("Error querying Pinecone:", error.message);
    throw error;
  }
}

// Build a context string from the retrieved matches; assumes that your metadata includes a 'text' field.
function buildContextFromMatches(matches) {
  let context = "";
  matches.forEach(match => {
    if (match.metadata && match.metadata.text) {
      context += match.metadata.text + "\n\n";
    }
  });
  return context;
}


// ========================================================================================
// ================== LLM Response Function with RAG Functionality ========================
// ========================================================================================

// Handles API calls to ChatGPT (LLM) and integrates Pinecone retrieval
async function get_LLM_response(chat_history) {
  let response;
  try {
    // For RAG, we assume that "prompt" contains the user query or the primary text.
    // Get the query embedding and then retrieve context from Pinecone.
    const prompt = chat_history.at(-1).content;
    const queryEmbedding = await getQueryEmbedding(prompt);
    const matches = await queryPinecone(queryEmbedding);
    const retrievedContext = buildContextFromMatches(matches);

    // Build a new system prompt that includes the retrieved context and instructs the LLM to impersonate Father Foley.
    const systemPromptBase = process.env.SYSTEM_PROMPT;
    const systemPrompt = systemPromptBase + "\n" + retrievedContext


    // Make the system prompt a list of one so it can be concatenated with the rest of the conversational history.
    const systemPromptList = [{role: 'system', content: systemPrompt}]

    // Make our API request to ChatGPT
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", 
      messages:  systemPromptList.concat(chat_history),
      temperature: 0.7,
    });

    response = {
      'status_code': 200, 
      'message': completion.choices[0].message.content
    };

    return response;
  } catch (error) {
    await fileQueueErrorFile.enqueue(async () => {
      logToFile(error.message, errorPath);
    });
    response = {
      'status_code': 500, 
      'message': 'We are unable to complete your request at this time. Please try again later.'
    };
    return response;
  }
}


// Function to save homily review
async function save_review(review) {
    const dataSavePath = path.join(__dirname, '..', 'reviews');

    try {
        // Check if directory exists asynchronously, create it if missing
        try {
            await fsp.access(dataSavePath); // If no error, directory exists
        } catch {
            await fsp.mkdir(dataSavePath, { recursive: true }); // Create if missing
        }

        // Create unique filename based on timestamp
        const timestamp = Date.now();
        const filepath = path.join(dataSavePath, `${timestamp}.json`);

        // Convert review object to JSON
        const reviewString = JSON.stringify(review, null, 2);
        await fsp.writeFile(filepath, reviewString, 'utf8');

        return {
            status_code: 200,
            message: 'Review successfully saved'
        };
    } catch (error) {
        console.error("Error saving review:", error);

        try {
            await fileQueueErrorFile.enqueue(async () => {
                await logToFile(error.message, errorPath);
            });
        } catch (loggingError) {
            console.error("Error logging to file:", loggingError);
        }

        return {
            status_code: 500,
            message: 'Error saving review'
        };
    }
}


// Make this file's functions visible to the "routes.js" file
module.exports = { get_LLM_response, save_review, logToFile };
