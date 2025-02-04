const fs = require("fs/promises");
const path = require("path");
const dataPath = path.join(__dirname, "..", "data", "test.json");
const resPath = path.join(__dirname, "..", "data", "res.json");
const axios = require("axios");
const { saveBuffer, initBuffer } = require("../helpers");
const { FISCAL_HOST, AUTH_MERCH_TOKEN, AUTH_MERCH_TOKEN_VAT } = process.env;
const fd = require("../data/fiscalData.json");

let bufferAccess = false;

const apiInstance = axios.create({
  baseURL: `${FISCAL_HOST}`,
  timeout: 60000,

  headers: {
    "Content-Type": "application/json",
  },
});
apiInstance.interceptors.request.use(
  (config) => {

    if (config.withVat) {
      config.headers.Authorization = AUTH_MERCH_TOKEN_VAT;
    } else {
      config.headers.Authorization = AUTH_MERCH_TOKEN;
    }
    return config;
  },
  (error) => {
    // Handle errors in request setup
    return Promise.reject(error);
  }
);
const saleCheck = async (body) => {
  console.log("saleCheck runs body", body);


  bufferAccess = true;
  let buffer;
  if (!body) return { status: "Fiscal body error", error: true };
  try {
    buffer = await initBuffer();
    console.log("buffer", buffer);
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
        const useVat = body.withVat;
        console.log('useVat', useVat)
        const response = await apiInstance.post("/api/v3/fiscal/execute", body, {
          withVat: useVat,
        });

        if (response.data.res !== 0) {
          const buffer = await initBuffer();
          buffer.push(body);
          await saveBuffer(buffer);

          return response.data;
        }
        const taxCheckFiscalNumber = response.data.info.doccode;
        console.log('taxCheckFiscalNumber', taxCheckFiscalNumber)
        const fiscalData = await apiInstance.get(
          `/c/${taxCheckFiscalNumber}.json`,
          {
            withVat: useVat,
          }
        );
        console.log('fiscalData', fiscalData.data)

        console.log("response after if in saleCheck");
        response.data.fiscal = fiscalData.data;
        return response.data;
      } catch (error) {
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
        console.log("salecheck error", error);
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
        console.error(
          "error_extra.errors:",
          response.data.error_extra.errors.fiscal
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
