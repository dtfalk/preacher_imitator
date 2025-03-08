const express = require('express');
const router = express.Router();
const path = require('path');
const backend = require(path.resolve(process.cwd(), "utilities", "backend.js"));
router.use(express.json());


// Routing function to handle incoming requests for responses from the LLM
router.post('/get_LLM_response', async (req, res) => {
  
  // Extract the data from the user's API call request
  var chat_history = req.body.chat_history;

  // Send data to the "get_LLM_response" function in the backend file to get a response from our LLM
  var response = await backend.get_LLM_response(chat_history);

  // Send the response (regardless of success or failure) back to the user
  // This response and error handling gets managed in the backend code as not to expose any info about our setup to the user
  res.status(response.status_code).json(response);
});


// Routing function to store a review of a homily response
router.post('/submit_review', async (req, res) => {
  
  // Extract the data from the user's API call request
  var review = req.body.review;

  // Send data to the "get_LLM_response" function in the backend file to get a response from our LLM
  var response = await backend.save_review(review);

  // Send the response (regardless of success or failure) back to the user
  // This response and error handling gets managed in the backend code as not to expose any info about our setup to the user
  res.status(response.status_code).json(response);
});

module.exports = router;
