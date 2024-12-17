const net = require("net");
const { CLIENT_HOST, CLIENT_PORT } = process.env;
// const { disconnectDB } = require("./config/connectDB");
const EventEmitter = require("events");
const { wsServer } = require("./socket/heartbeat");

const eventEmitter = new EventEmitter();

let accumulatedBuffer = Buffer.alloc(0);

let cancelRequested = false;
const forPing = {
  method: "PingDevice",
  step: 0,
};

const forIdentify = {
  method: "ServiceMessage",
  step: 0,
  params: { msgType: "identify" },
};

const interruptMsg = {
  method: "ServiceMessage",
  step: 0,
  params: {
    msgType: "interrupt",
  },
};
let payTimer = null;
let terminalStatus = "offline";
let pingInterval = null;
let resolvePurchase = () => {};
let rejectPurchase = () => {};

const setupPurchaseHandlers = (resolve, reject) => {
  resolvePurchase = (response) => {
    if (cancelRequested) {
      console.log("Purchase cancelled");
      reject({ message: "Purchase cancelled by bad user" });
    } else {
      resolve(response);
    }
  };
  rejectPurchase = reject;
};
const client = net.createConnection(
  { port: CLIENT_PORT, host: CLIENT_HOST },
  () => {
    console.log("Connected to PAX A930 on ping");
    // sendHandshake(forPing);
    // sendHandshake(forIdentify); // Identification message
  }
);
client.on("connect", () => {
  console.log("client on connect");
  sendHandshake(forPing);
  sendHandshake(forIdentify);
  pingTerminal();
});
// Step 3: Handle the disconnect event
client.on("close", (had_error) => {
  if (had_error) {
    console.log("Connection closed due to an error.");
    terminalStatus = "offline";
    broadcastTerminalStatus();
    reconnect();
  } else {
    console.log("Connection closed cleanly.");
    terminalStatus = "offline";
    broadcastTerminalStatus();
    reconnect();
  }
});

client.on("data", (data) => {
  console.log("client.on data accumulatedBuffer", accumulatedBuffer.length);
  console.log("client.on data event", data.toString());

  accumulatedBuffer = Buffer.concat([accumulatedBuffer, data]);

  let endIdx;
  while ((endIdx = accumulatedBuffer.indexOf(0x00)) !== -1) {
    let message = accumulatedBuffer.subarray(0, endIdx); // Extract message up to delimiter
    accumulatedBuffer = accumulatedBuffer.subarray(endIdx + 1); // Remove the processed message from buffer
    // console.log("processMessage message", message);
    processMessage(message);
  }
});

client.on("error", (err) => {
  console.error("TCP error:", err);
  if (err.code === "ECONNRESET") {
    reconnect();
  }
});
// }

const processMessage = (message) => {
  try {
    const response = JSON.parse(message.toString()); // Parse the buffer to string and then to JSON
    console.log("processMessage response", response);
    if (response.error) {
      eventEmitter.emit("cancelPurchase");
    } else {
      resolvePurchase(response); // Resolve the pending promise with the response
    }
  } catch (e) {
    console.error("Failed to parse message:", e);
    // Handle parsing error or take necessary actions
  }
  if (accumulatedBuffer.length === 0) {
    accumulatedBuffer = Buffer.alloc(0);
  }
};
function reconnect() {
  if (!client.connecting) {
    // Check if the client is already attempting to connect
    console.log("Attempting to reconnect...");
    client.connect(CLIENT_PORT, CLIENT_HOST, () => {
      console.log("Reconnected to PAX A930");
      // Reinitialize any necessary state or resend handshake
      // sendHandshake(forPing);
    });
  }
}


const sendHandshake = (msg) => {
  const messageString = JSON.stringify(msg);
  const messageWithDelimiters =
    msg.method === "PingDevice"
      ? `\x00${messageString}\x00`
      : `${messageString}\x00`;
  const messageBuffer = Buffer.from(messageWithDelimiters, "utf8");

  return new Promise((resolve, reject) => {
    let timeout = setTimeout(() => {
      console.log("Terminal did not respond in time");
      terminalStatus = "offline";
      broadcastTerminalStatus(); // Notify front-end about offline status
      reject(new Error("Timeout: No response from terminal"));
    }, 5000); // Timeout in 5 seconds

    client.write(messageBuffer, (err) => {
      if (err) {
        console.error(`Failed to send ${msg.method} message:`, err);
        clearTimeout(timeout);
        terminalStatus = "offline";
        broadcastTerminalStatus();
        reject(err);
      }
    });

    client.once("data", (data) => {
      clearTimeout(timeout);
      console.log("client.once data", data.toString());

      // console.log(`${msg.method} response received:`, data.toString());
      try {
        const response = data.toString();
        if (!response.error) {
          terminalStatus = "online"; // Mark terminal as online
          broadcastTerminalStatus(); // Notify front-end about online status
          resolve(response);
        } else {
          console.error("Error in terminal response:", response.error);
          terminalStatus = "offline";
          broadcastTerminalStatus();
          reject(new Error(response.error));
        }
      } catch (err) {
        console.error("Error parsing terminal response:", err);
        terminalStatus = "offline";
        broadcastTerminalStatus();
        reject(err);
      }
    });
  });
};

const writer = (writeData, timeout = 10000) => {
  return new Promise((resolve, reject) => {
    let stringWriteData = JSON.stringify(writeData) + "\x00";

    const timer = setTimeout(() => {
      client.destroy(); // Close the connection
      reject(
        new Error(
          "Timeout: Data could not be written within the specified time"
        )
      );
    }, timeout);

    client.write(stringWriteData, (err) => {
      clearTimeout(timer);
      if (err) {
        client.destroy(); // Close the connection
        reject(new Error("Error sending purchase data: " + err.message));
      } else {
        console.log("Writer Purchase data sent", writeData);
        resolve(); // Resolve promise without data, wait for response in the event listener
      }
    });
  });
};

const paymentTimer = (payTimeout = 30) => {
  let jsonInterruptMsg = JSON.stringify(interruptMsg);

  jsonInterruptMsg += "\x00";
  payTimer = setTimeout(() => {
    client.write(jsonInterruptMsg, (err) => {
      if (err) {
        console.error("Error sending jsonInterruptMsg:", err);
        client.destroy(); // Close the connection
      } else console.log("jsonInterruptMsg sent", jsonInterruptMsg);
    });
  }, payTimeout * 1000);
};

process.on("SIGINT", async () => {
  console.log("Shutting down server...");

  await closeAll();

  setTimeout(() => {
    console.log("Exiting process ...");
    process.exit(0);
  }, 3000); // Ensure all cleanup processes complete
});

const closeAll = async () => {
  console.log("Shutting down server...");
  // await disconnectDB();
  if (client) {
    await client.end((err) => {
      if (err) {
        console.error("Error closing client:", err);
      } else {
        console.log("Gracefully disconnected from PAX A930.");
      }
      client.destroy(); // Ensure the socket is destroyed
    });
  }
  setTimeout(() => {
    console.log("Exiting process...");
    process.exit(0);
  });
};
const broadcastTerminalStatus = () => {
  wsServer.emit("terminal-status", { status: terminalStatus });
};

const pingTerminal = () => {
  if (pingInterval) clearInterval(pingInterval);

  pingInterval = setInterval(async () => {
    try {
      console.log("Sending Ping to terminal...");
      await sendHandshake(forPing); // Use the ping message
      console.log("Terminal is online");
    } catch (err) {
      console.error("Terminal is offline or not responding:", err.message);
    }
  }, 60000); // Ping every 60 seconds
};

module.exports = {
  writer,
  setupPurchaseHandlers,
  interruptMsg,
  cancelRequested,
  eventEmitter,
  sendHandshake
};
