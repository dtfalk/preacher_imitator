// File to initialize the error logging queue
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");

class FileQueueErrorFile {
  constructor() {
    this.queue = Promise.resolve();
  }

  async enqueue(task) {
    try {
      this.queue = this.queue.then(() => task());
      return this.queue;
    } catch (error) {
      console.error("Error adding to the log file:", error.message);
    }
  }

  // log to the error file as a method
  async logToFile(message) {
    try {
      const filepath = path.resolve(process.cwd(), 'consoleResponses', 'errors.txt');
      // Ensure directory exists
      if (!fs.existsSync(path.dirname(filepath))) {
        await fsp.mkdir(path.dirname(filepath), {recursive: true});
      }

      const timestamp = new Date().toISOString();
      const logEntry = `${timestamp}: ${message}\n`;

      await fsp.appendFile(filepath, logEntry, "utf8");
    } catch (err) {
      console.error("Error appending to log file:", err);
    }
  }
}

const errorLogger = new FileQueueErrorFile();
module.exports = errorLogger;