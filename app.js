require("dotenv").config(); // import dotenv and load the various API keys
const express = require('express'); // import our express backend
const cors = require("cors"); // allows vite to talk to express and vice versa
const userRoutes = require('./utilities/routes.js'); // import the user routes

const app = express(); // initialize the express app

// Allow frontend requests from vite
app.use(cors());

// Middleware
app.use(express.json());

// API Routes (Backend only)
app.use('/api', userRoutes);

// Tell our app to listen on port 3000
const port = 3000;
app.listen(port, () => console.log(`Backend running on http://localhost:${port}`));
