// write me a homily for pentecost sunday
// asv bible is missing "wisdom", "baruch", "sirach",  
// revelation needs a name change to 'Revelation of John'. Numbered books need to be switched to roman numerals
const fsp = require('fs').promises;
const fs = require('fs');
const path = require('path');
const bible_db = require(path.resolve(process.cwd(), 'utilities', 'initializations', 'db.js'));
const error_logger = require(path.resolve(process.cwd(), 'utilities', 'initializations', 'error_logging.js'));
const fuzzy_matcher = require(path.resolve(process.cwd(), 'utilities', 'initializations', 'fuzzy_matcher.js'));
const openai_client = require(path.resolve(process.cwd(), 'utilities', 'initializations', 'openai.js'));
const pinecone_index = require(path.resolve(process.cwd(), 'utilities', 'initializations', 'pinecone.js'));
const readings = require(path.resolve(process.cwd(), 'utilities', 'initializations', 'readings.js'));


// ========================================================================================
// ============================ Pinecone Retrieval Functions ==============================
// ========================================================================================

// Get the embedding for a query using OpenAI's embedding endpoint
async function getQueryEmbedding(userPrompt) {
  try {
    const embeddingResponse = await openai_client.embeddings.create({
      input: userPrompt,
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
async function queryPinecone(userPromptEmbedding, topK = 3) {
  try {
    const queryResponse = await pinecone_index.query({
      vector: userPromptEmbedding,
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
// ========================= Retrieving Biblical Verses  ==================================
// ========================================================================================

// Get the day that the user was most likely referring to
async function get_likely_day_mentioned(userPrompt) {
  const result = fuzzy_matcher.search(userPrompt);
  const likely_day_mentioned = result.length > 0 ? result[0].item : "No reliable match found"; 
  console.log(likely_day_mentioned)
  return likely_day_mentioned;
}

// Get the readings for a given day
// Currently gets all cycles... need to add functionality to select a specific cycle
async function get_readings_for_the_day(day) {
  const readings_list = readings[day];
  const readings_for_the_day = []
  for (let cycle of readings_list) {
    for (let reading of cycle) {
      readings_for_the_day.push(reading)
    }
  }
  return readings_for_the_day;
}

// Parses a reading and return the book, chapter, start verse and stop verse
async function get_parsed_reading(reading) {

  // Split on the colon
  const parts = reading.split(":");
  const book_and_chapter = parts.at(0);
  const verses = parts.at(1);
  
  // Getting the book and chapter
  const book_and_chapter_parts = book_and_chapter.split(" ");
  let book;
  let chapter;
  if (book_and_chapter_parts.length == 2) {
    book = book_and_chapter_parts.at(0);
  }
  else if (book_and_chapter_parts.length == 3) {
    book = book_and_chapter_parts.at(0) + " " + book_and_chapter_parts.at(1) + " ";
  } 
  else {
    book = book_and_chapter_parts.at(0) + " " + book_and_chapter_parts.at(1) + " " + book_and_chapter_parts.at(2) + " " + book_and_chapter_parts.at(3);
  }
  chapter = book_and_chapter_parts.at(-1);

  // swap digits for numerals
  if (book.at(0) == '1') {
    book = book.replace("1", "I");
  }
  else if (book.at(0) == '2') {
    book = book.replace("2", "II");
  }

  // swap book names (revelation of john, acts of apostles)
  if (book == "Acts of the Apostles") {
    book = "Acts";
  }
  if (book == "Revelation"){
    book = "Revelation of John"
  }
  book = book.trim();
  chapter = Number(chapter.trim());

  // Getting the verses
  const verse_indices = verses.split("-");
  const start_verse = Number(verse_indices.at(0));
  const end_verse = Number(verse_indices.at(-1));

  const parsed_reading = [book, chapter, start_verse, end_verse]
  return parsed_reading
}

// Gets the biblical text for a reading mentioned from the sqlite db
async function get_biblical_text(book, chapter, start_verse, stop_verse) {
  const passage = await new Promise((resolve, reject) => {
    const query = `
          SELECT text FROM ASV_verses
          WHERE book_id = (SELECT id FROM ASV_books WHERE name = ?)
          AND chapter = ?
          AND verse BETWEEN ? AND ?
          ORDER BY verse;
      `;

    bible_db.all(query, [book, chapter, start_verse, stop_verse], (err, rows) => {
        if (err) {
            reject("Database query error: " + err.message);
            return;
        }

        if (rows.length === 0) {
            resolve("No verses found.");
            return;
        }

        // Join all verses into a single passage
        const passage = rows.map(row => row.text).join(" ");
        resolve(passage);
    });
  });
  return passage;
}


// Gets the readings
async function get_bible_verses(userPrompt) {

  // Get the day that the user mentioned in their prompt
  const day_mentioned = await get_likely_day_mentioned(userPrompt)
  
  // Gets all of the readings for the day the user mentioned in their prompt
  const readings_for_the_day = await get_readings_for_the_day(day_mentioned);

  // Gets the biblical texts associated with each reading
  let biblical_texts = [];
  for (let reading of readings_for_the_day) {

    // parse the reading into its constituent parts
    const parsed_reading = await get_parsed_reading(reading);
    const book = parsed_reading.at(0);
    const chapter = parsed_reading.at(1);
    const start_verse = parsed_reading.at(2);
    const end_verse = parsed_reading.at(3);

    // retrieve the biblical text for this reading
    const biblical_text = get_biblical_text(book, chapter, start_verse, end_verse);
    
    // add the texts associated with the current day's reading to the list of texts
    biblical_texts.push(`${book} ${chapter}:${start_verse}-${end_verse}\n${biblical_text}\n`);
  }
  
  return biblical_texts
}

// ========================================================================================
// ================== LLM Response Function with RAG Functionality ========================
// ========================================================================================

// Handles API calls to ChatGPT (LLM) and integrates Pinecone retrieval
async function get_LLM_response(chat_history) {
  let response;
  try {

    // Construct the system prompt
    const systemPrompt = 'Format your responses in simple paragraphs, with clear line breaks, and indent the first line of each paragraph.\nEnsure each paragraph is separated by a blank line. \n Include no images, bullet points, or complex styling. \nIncluded in the users prompt will be two sources of information for you draw upon: relevant writings from father foley and relevant biblical texts for the day that the user mentioned in their prompt. Please use the relevant biblical texts to help you understand father foleys writings and use them to inform your own response. These writings are a crucial part of the source material for your responses. Additionally you must use the relevant father foley writings to craft your response in Father Foleys style, drawing on similar metaphors, themes, attitudes and stylistic decisions. \nThese are father foleys writings, so let their wisdom and style guide your response. Use his writings to get a sense of how father foley tends to use the biblical texts to craft a homily. His homilies are based on the biblical texts that you will receive.';
    const systemPromptList = [{role: 'system', content: systemPrompt}];

    // For RAG, we assume that "prompt" contains the user query or the primary text.
    // Get the query embedding and then retrieve context from Pinecone.
    const prompt = chat_history.at(-1).content;
    const queryEmbedding = await getQueryEmbedding(prompt);
    const matches = await queryPinecone(queryEmbedding);
    const retrievedContext = buildContextFromMatches(matches);

    // Retrieve the biblical texts associated with the day the user mentioned
    const userPrompt = chat_history.at(-1).content;
    const biblical_texts = await get_bible_verses(userPrompt);

    // Construct the full user prompt with the relevant homilies and biblical texts
    const fullUserPrompt = userPrompt + "-----------------\nRelevant Homilies From Father Foley\n-----------------" + retrievedContext + "-----------------\nBiblical Sources for the given day\n-----------------" + biblical_texts;

    // Construct the full prompt to the LLM with the system prompt, the chat history, and the new user prompt
    const finalPrompt = systemPromptList.concat(chat_history.slice(0, -1).concat({role: 'user', content: fullUserPrompt}))

    // Make our API request to ChatGPT
    const completion = await openai_client.chat.completions.create({
      model: "gpt-4o", 
      messages:  finalPrompt,
      temperature: 0.7,
    });

    response = {
      'status_code': 200, 
      'message': completion.choices[0].message.content
    };

    return response;
  } catch (error) {
    await error_logger.enqueue(async () => {
      error_logger.logToFile(error.message);
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
module.exports = {get_LLM_response, save_review};
