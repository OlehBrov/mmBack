const path = require("path");
const fs = require("fs/promises");
const bufferPath = path.join(__dirname, "..", "data", "unsentFiscals.json");

// Initialize or load existing buffer
const initBuffer = async () => {
  try {
    const data = await fs.readFile(bufferPath, { encoding: "utf8" });
    return JSON.parse(data);
  } catch (error) {
    // If the file doesn't exist, start with an empty array
    return [];
  }
};

const saveBuffer = async (buffer) => {
  await fs.writeFile(bufferPath, JSON.stringify(buffer, null, 2), "utf8");
};

module.exports = { initBuffer, saveBuffer };
