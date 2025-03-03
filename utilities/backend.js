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
async function queryPinecone(queryEmbedding, topK = 7) {
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
    const systemPrompt = `Format your responses in simple paragraphs, with clear line breaks, and indent the first line of each paragraph. 
Include no images, bullet points, or complex styling. 
Below is the context; craft your response in Father Foleys warm, reflective, and spiritually insightful style. 
Ensure each paragraph is separated by a blank line. 
Please react to the type of conversation that the user is trying to have. If they ask for a homily, give them a homily. If they want a conversation, then be more conversational.
Regardless, make sure that you are always keeping the Context in mind when you respond. These are father foley's writings, so let their wisdom and conversational style guide your response. 

----------
Context:
${retrievedContext}`;

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

// Make this file's functions visible to the "routes.js" file
module.exports = { get_LLM_response, logToFile };
