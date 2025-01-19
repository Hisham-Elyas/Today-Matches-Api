const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
exports.get_all_matches = async (req, res, next) => {
  const filePath = path.join(__dirname, "../../filter_matches.json");

  // Read the JSON file after scraping
  fs.readFile(filePath, "utf-8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return res.status(500).json({ error: "Failed to read the file" });
    }

    try {
      // Parse the JSON data and send it as the response
      const jsonData = JSON.parse(data);
      res.status(200).json(jsonData);
    } catch (parseErr) {
      console.error("Error parsing JSON:", parseErr);
      res.status(500).json({ error: "Invalid JSON format in the file" });
    }
  });
};
