const fs = require("fs/promises");
const path = require("path");
const dataPath = path.join(__dirname, "..", "data", "test.json");
const resPath = path.join(__dirname, "..", "data", "res.json");
const axios = require("axios");
const { saveBuffer, initBuffer } = require("../helpers");
const { FISCAL_HOST, AUTH_MERCH_TOKEN } = process.env;
const fd = require("../data/fiscalData.json");
let bufferAccess = false;

const apiInstance = axios.create({
  baseURL: `${FISCAL_HOST}/api/v3/fiscal/execute`,
  method: "POST",
  timeout: 60000,

  headers: {
    "Content-Type": "application/json",
    Authorization: AUTH_MERCH_TOKEN,
  },
});

const saleCheck = async (body) => {
  console.log("saleCheck runs");
  bufferAccess = true;
  let buffer;
  try {
    buffer = await initBuffer();
    if (buffer.length > 0) {
      // Buffer is not empty, append new data and save
      buffer.push(body);
      await saveBuffer(buffer);

      return {
        status: "Receipt pending",
        message: "Your receipt  will be registered soon afr.",
      };
    } else {
      try {
        const response = await apiInstance.post("", body);
        console.log("saleCheck response", response.data);

        if (response.data.res !== 0) {
          const buffer = await initBuffer();
          buffer.push(body);
          await saveBuffer(buffer);
          console.log("response.data.res !== 0");
          return response.data
        }
        console.log("response after if in saleCheck");
        return response.data;
      } catch (error) {
        console.log("saleCheck error", error);
        const buffer = await initBuffer();
        buffer.push(body);
        await saveBuffer(buffer);
        if (
          error.code === "ECONNABORTED" &&
          error.message.includes("timeout")
        ) {
          console.error("The request timed out. Please try again later.");
        } else if (error.response) {
          console.error("Error Status:", error.response.status);
          console.error("Error Data:", error.response.data);
        } else if (error.request) {
          console.error("No response was received:", error.request);
        } else {
          console.error("Error Message:", error.message);
        }
        console.log('salecheck error', error)
        return null; // Returning null to indicate failure
      }
    }
  } finally {
    bufferAccess = false; // Reset access when done
    buffer = await initBuffer();

    if (buffer.length > 0) {
      // Check if new items were added during the operation
      startRetryProcess(); // Optionally, trigger retries immediately if needed
    }
  }
};
let retryInterval;

const startRetryProcess = () => {
  if (!retryInterval) {
    console.log("startRetryProcess");
    retryInterval = setInterval(retryFailedRequests, 10000); // Retry every 10 seconds
  }
};

const stopRetryProcess = () => {
  if (retryInterval) {
    clearInterval(retryInterval);
    retryInterval = null;
  }
};

const retryFailedRequests = async () => {
  console.log("Attempting to retry failed requests...");
  if (!bufferAccess) {
    const buffer = await initBuffer();
    if (buffer.length === 0) {
      stopRetryProcess();
      console.log("No more items to retry, stopping retry process.");
      return;
    }

    const entry = buffer.shift();
    try {
      const response = await apiInstance.post("", entry);
      console.log("Response received:", response.data);
      if (response.data && response.data.res !== 0) {
        console.error(
          "Server reported an error, re-buffering data:",
          response.data
        );
        buffer.unshift(entry); // Re-add the entry at the start if error
      } else {
        console.log("Successfully sent buffered data:", response.data);
      }
      await saveBuffer(buffer); // Save the modified buffer
    } catch (error) {
      console.error("Retry failed, re-buffering entry:", error.message);
      buffer.unshift(entry);
      await saveBuffer(buffer);
    }
  }
};

// module.exports = {
//   saleCheck,
//   startRetryProcess,
//   stopRetryProcess,
// };

// saleCheck(fd);

module.exports = saleCheck;
