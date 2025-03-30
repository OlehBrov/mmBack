const net = require("net");
const { CLIENT_HOST, CLIENT_PORT } = process.env;
// const { disconnectDB } = require("./config/connectDB");
const EventEmitter = require("events");
const { wsServer } = require("./socket/heartbeat");

const eventEmitter = new EventEmitter();

let accumulatedBuffer = Buffer.alloc(0);
const responseListeners = new Set();

let cancelRequested = false;
let reconnectInterval = null;
let isReconnecting = false;
const forPing = {
  method: "PingDevice",
  step: 0,
};
let saleInProgress = false;
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

let terminalStatus = "offline";
let pingInterval = null;
let resolvePurchase = () => {};
let rejectPurchase = () => {};
let isHandled = false;

const setupPurchaseHandlers = (resolve, reject) => {
  isHandled = false;

  resolvePurchase = (response) => {
    if (!isHandled) {
      isHandled = true;
      resolve(response);
    }
  };

  rejectPurchase = (error) => {
    if (!isHandled) {
      isHandled = true;
      reject(error);
    }
  };
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

// client.on("data", (data) => {
//   accumulatedBuffer = Buffer.concat([accumulatedBuffer, data]);

//   let endIdx;
//   while ((endIdx = accumulatedBuffer.indexOf(0x00)) !== -1) {
//     let message = accumulatedBuffer.subarray(0, endIdx); // Extract message up to delimiter
//     accumulatedBuffer = accumulatedBuffer.subarray(endIdx + 1); // Remove the processed message from buffer

//     processMessage(message);
//   }
// });
// client.on("data", (data) => {
//   accumulatedBuffer = Buffer.concat([accumulatedBuffer, data]);

//   let endIdx;
//   while ((endIdx = accumulatedBuffer.indexOf(0x00)) !== -1) {
//     let message = accumulatedBuffer.subarray(0, endIdx);
//     accumulatedBuffer = accumulatedBuffer.subarray(endIdx + 1);

//     try {
//       const json = JSON.parse(message.toString());
//       console.log("client.on json", json);

//       let matched = false;

//       for (const listener of responseListeners) {
//         if (listener.matcher(json)) {
//           responseListeners.delete(listener);
//           clearTimeout(listener.timeoutId); // Optional if you add timeout inside writer
//           if (json.error) {
//             listener.reject(
//               new Error(json.errorDescription || "Terminal returned an error")
//             );
//           } else {
//             listener.resolve(json);
//           }
//           matched = true;
//           break;
//         }
//       }

//       if (!matched) {
//         // This is a non-awaited response (ex: cancel, ping, etc.)
//         processMessage(json);
//       }
//     } catch (err) {
//       console.error("Failed to parse TCP message:", err.message);
//     }
//   }
// });
//UP with timeout
client.on("data", (data) => {
  accumulatedBuffer = Buffer.concat([accumulatedBuffer, data]);

  let endIdx;
  while ((endIdx = accumulatedBuffer.indexOf(0x00)) !== -1) {
    const message = accumulatedBuffer.subarray(0, endIdx);
    accumulatedBuffer = accumulatedBuffer.subarray(endIdx + 1);

    try {
      const parsed = JSON.parse(message.toString());
      console.log("client.on json", parsed);

      // Match listener first
      let matched = false;
      for (const listener of responseListeners) {
        if (listener.matcher(parsed)) {
          if (
            parsed.error ||
            parsed.params?.msgType === "interruptTransmitted"
          ) {
            listener.reject(
              new Error(parsed.errorDescription || "Operation cancelled")
            );
          } else {
            listener.resolve(parsed);
          }
          matched = true;
          responseListeners.delete(listener);
          break;
        }
      }

      if (!matched) {
        processMessage(parsed); // already parsed
      }
    } catch (err) {
      console.error("❌ Failed to parse TCP message:", err.message);
    }
  }
});

client.on("error", (err) => {
  console.error("TCP error:", err.message);
  if (err.code === "ECONNRESET" || err.code === "ECONNREFUSED") {
    terminalStatus = "offline";
    broadcastTerminalStatus();
    reconnect();
  }
});
// }
// const processMessage = (message) => {
//   try {
//     const response = JSON.parse(message.toString());

//     if (response.params?.msgType === "interruptTransmitted") {
//       console.warn("❌ Terminal interrupted transaction (user cancel)");
//       eventEmitter.emit("cancelPurchase");

//       rejectPurchase(
//         new Error(response.errorDescription || "Purchase cancelled")
//       );
//       return;
//     }

//     if (response.method === "Purchase" && !response.error) {
//       resolvePurchase(response);
//     } else if (response.error) {
//       rejectPurchase(
//         new Error(response.errorDescription || "Error from terminal")
//       );
//     }
//   } catch (err) {
//     console.error("Failed to parse message in processMessage:", err.message);
//     rejectPurchase(new Error("Invalid terminal response"));
//   }
// };
const processMessage = (message) => {
  console.log("processMessage message", message);
  try {
    // const response = JSON.parse(message.toString());

    if (
      message.method === "ServiceMessage" &&
      message.params?.msgType === "interruptTransmitted"
    ) {
      console.warn("❌ Terminal interrupted transaction (user cancel)");
      eventEmitter.emit("cancelPurchase");
    } else {
      console.warn("📨 Unmatched response:", message);
    }
  } catch (err) {
    console.error("Failed to parse message in processMessage:", err);
  }
};

// const processMessage = (message) => {
//   try {
//     const response = JSON.parse(message.toString()); // Parse the buffer to string and then to JSON

//     if (response.error) {
//       eventEmitter.emit("cancelPurchase");
//     } else {
//       resolvePurchase(response);
//     }
//   } catch (e) {
//     console.error("Failed to parse message:", e);
//   }
//   if (accumulatedBuffer.length === 0) {
//     accumulatedBuffer = Buffer.alloc(0);
//   }
// };

function reconnect() {
  if (isReconnecting) return;
  isReconnecting = true;
  console.log("Attempting to reconnect...");

  reconnectInterval = setInterval(() => {
    if (!client.connecting) {
      // Check if the client is already attempting to connect
      console.log("Trying to reconnect to the terminal...");
      client.connect(CLIENT_PORT, CLIENT_HOST, () => {
        console.log("Reconnected to PAX A930");

        // sendHandshake(forPing);
        clearReconnection();

        sendHandshake(forPing);
        sendHandshake(forIdentify);
        pingTerminal();
      });
    }
  }, 30000);
}

function clearReconnection() {
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
    reconnectInterval = null;
    isReconnecting = false;
  }
}

// const sendHandshake = (msg) => {
//   const messageString = JSON.stringify(msg);
//   const messageWithDelimiters =
//     msg.method === "PingDevice"
//       ? `\x00${messageString}\x00`
//       : `${messageString}\x00`;
//   const messageBuffer = Buffer.from(messageWithDelimiters, "utf8");

//   return new Promise((resolve) => {
//     let isResolved = false;
//     const timeout = setTimeout(() => {
//       if (!isResolved) {
//         console.log("Terminal did not respond in time");
//         terminalStatus = "offline";
//         broadcastTerminalStatus();
//         isResolved = true;
//         resolve({
//           success: false,
//           message: "Timeout: No response from terminal",
//         });
//       }
//     }, 5000);

//     client.write(messageBuffer, (err) => {
//       if (err) {
//         console.error(`Failed to send ${msg.method} message:`, err);
//         clearTimeout(timeout);
//         terminalStatus = "offline";
//         broadcastTerminalStatus();
//         if (!isResolved) {
//           isResolved = true;
//           resolve({
//             success: false,
//             message: `Error writing message: ${err.message}`,
//           });
//         }
//       }
//     });

//     client.once("data", (data) => {
//       if (!isResolved) {
//         clearTimeout(timeout);
//         isResolved = true;
//         console.log("client.once data", data.toString());

//         try {
//           const response = data.toString();
//           if (!response.error) {
//             terminalStatus = "online"; // Mark terminal as online
//             broadcastTerminalStatus();
//             resolve({
//               success: true,
//               response,
//             });
//           } else {
//             console.error("Error in terminal response:", response.error);
//             terminalStatus = "offline";
//             broadcastTerminalStatus();
//             resolve({
//               success: false,
//               message: `Error in terminal response: ${response.error}`,
//             });
//           }
//         } catch (err) {
//           console.error("Error parsing terminal response:", err);
//           terminalStatus = "offline";
//           broadcastTerminalStatus();
//           resolve({
//             success: false,
//             message: "Invalid response format from terminal",
//           });
//         }
//       }
//     });
//   });
// };
const sendHandshake = (msg) => {
  const messageString = JSON.stringify(msg);
  const messageWithDelimiters = `\x00${messageString}\x00`;
  const messageBuffer = Buffer.from(messageWithDelimiters, "utf8");

  return new Promise((resolve, reject) => {
    let isResolved = false;

    const timeout = setTimeout(() => {
      responseListeners.delete(listener);
      terminalStatus = "offline";
      broadcastTerminalStatus();
      reject(new Error("⏳ Timeout: No response from terminal"));
    }, 5000);

    const listener = {
      matcher: (data) =>
        data?.method === msg.method && // match on method: e.g., PingDevice or ServiceMessage
        (msg.params?.msgType
          ? data?.params?.msgType === msg.params?.msgType // match msgType if present
          : true),
      resolve: (response) => {
        clearTimeout(timeout);
        terminalStatus = "online";
        broadcastTerminalStatus();
        responseListeners.delete(listener);
        resolve({
          success: true,
          response,
        });
      },
    };

    responseListeners.add(listener);

    client.write(messageBuffer, (err) => {
      if (err && !isResolved) {
        clearTimeout(timeout);
        responseListeners.delete(listener);
        terminalStatus = "offline";
        broadcastTerminalStatus();
        reject(new Error(`❌ Write error: ${err.message}`));
      }
    });
  });
};

const sendGetMerchants = () => {
  return new Promise((resolve, reject) => {
    const msg = {
      method: "ServiceMessage",
      step: 0,
      params: {
        msgType: "getMerchantList",
      },
    };

    const message = `\x00${JSON.stringify(msg)}\x00`;

    const timeout = setTimeout(() => {
      responseListeners.delete(listener);
      reject(new Error("Timeout waiting for merchant list"));
    }, 5000);

    const listener = {
      matcher: (data) =>
        data?.method === "ServiceMessage" &&
        data?.params?.msgType === "getMerchantList",
      resolve: (response) => {
        clearTimeout(timeout);
        resolve({
          success: true,
          response,
        });
      },
    };

    responseListeners.add(listener);

    client.write(message, (err) => {
      if (err) {
        responseListeners.delete(listener);
        clearTimeout(timeout);
        return reject(err);
      }
    });
  });
};

// const writer = (writeData, timeout = 10000) => {
//   return new Promise((resolve, reject) => {
//     let stringWriteData = JSON.stringify(writeData) + "\x00";

//     const timer = setTimeout(() => {
//       client.destroy();
//       reject(
//         new Error(
//           "Timeout: Data could not be written within the specified time"
//         )
//       );
//     }, timeout);

//     client.write(stringWriteData, (err) => {
//       clearTimeout(timer);
//       if (err) {
//         client.destroy();
//         reject(new Error("Error sending purchase data: " + err.message));
//       } else {
//         console.log("Writer Purchase data sent", writeData);
//         resolve(); // Resolve promise without data, wait for response in the event listener
//       }
//     });
//   });
// };

// const paymentTimer = (payTimeout = 30) => {
//   let jsonInterruptMsg = JSON.stringify(interruptMsg);

//   jsonInterruptMsg += "\x00";
//   payTimer = setTimeout(() => {
//     client.write(jsonInterruptMsg, (err) => {
//       if (err) {
//         console.error("Error sending jsonInterruptMsg:", err);
//         client.destroy(); // Close the connection
//       } else console.log("jsonInterruptMsg sent", jsonInterruptMsg);
//     });
//   }, payTimeout * 1000);
// };
// const writer = (writeData, timeout = 60000) => {
//   return new Promise((resolve, reject) => {
//     const messageString = JSON.stringify(writeData) + "\x00";

//     const timeoutId = setTimeout(() => {
//       responseListeners.delete(listener);
//       reject(new Error("Timeout: No response from terminal"));
//     }, timeout);

//     const listener = {
//       matcher: (response) =>
//         response.method === "Purchase" &&
//         !response.error &&
//         response.params?.trnStatus === "1", // Ensure it's a completed transaction
//       resolve: (response) => {
//         clearTimeout(timeoutId);
//         responseListeners.delete(listener);
//         resolve(response);
//       },
//       reject: (error) => {
//         clearTimeout(timeoutId);
//         responseListeners.delete(listener);
//         reject(error);
//       },
//       timeoutId,
//     };

//     responseListeners.add(listener);

//     client.write(messageString, (err) => {
//       if (err) {
//         clearTimeout(timeoutId);
//         responseListeners.delete(listener);
//         reject(new Error("Failed to send data: " + err.message));
//       } else {
//         console.log("✅ Purchase data sent to terminal");
//       }
//     });
//   });
// };

const writer = (dataToSend, matcher, timeout = 60000) => {
  const json = JSON.stringify(dataToSend) + "\x00";

  return new Promise((resolve, reject) => {
    const listener = {
      matcher,
      resolve: (msg) => {
        clearTimeout(timer);
        responseListeners.delete(listener);
        resolve(msg);
      },
      reject: (err) => {
        clearTimeout(timer);
        responseListeners.delete(listener);
        reject(err);
      },
    };

    responseListeners.add(listener);

    const timer = setTimeout(() => {
      responseListeners.delete(listener);
      reject(new Error("Timeout waiting for terminal response"));
    }, timeout);

    client.write(json, (err) => {
      if (err) {
        clearTimeout(timer);
        responseListeners.delete(listener);
        reject(new Error("Failed to send data to terminal"));
      } else {
        console.log("✅ Purchase data sent to terminal");
      }
    });
  });
};

process.on("SIGINT", async () => {
  console.log("Shutting down server...");

  await closeAll();

  setTimeout(() => {
    console.log("Exiting process ...");
    process.exit(0);
  }, 3000);
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
      client.destroy();
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
eventEmitter.on("sale-active", () => {
  console.log("sale-active");
  saleInProgress = true;
});
eventEmitter.on("sale-closed", () => {
  console.log("sale-closed");
  saleInProgress = false;
});

const pingTerminal = () => {
  console.log("func pingTerminal");
  console.log("saleInProgress", saleInProgress);

  if (saleInProgress) {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    return;
  }

  if (pingInterval) clearInterval(pingInterval);

  pingInterval = setInterval(async () => {
    if (saleInProgress) {
      console.log("Sale started during ping interval — stopping ping...");
      clearInterval(pingInterval);
      pingInterval = null;
      return;
    }

    try {
      console.log("Sending Ping to terminal...");
      await sendHandshake(forPing);
      console.log("Terminal is online");
    } catch (err) {
      console.error("Terminal is offline or not responding:", err.message);
    }
  }, 60000);
};

module.exports = {
  writer,
  setupPurchaseHandlers,
  interruptMsg,
  cancelRequested,
  eventEmitter,
  sendHandshake,
  sendGetMerchants,
  responseListeners
};
