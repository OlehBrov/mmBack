const { Server } = require("socket.io");
const { createServer } = require("http");
const { prisma } = require("../config/db/dbConfig");

const httpServer = createServer();
const storeConnections = {};
const wsServer = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

wsServer.on("connection", (socket) => {
    const authId = socket.handshake.query.auth_id;
    // const authId = parseInt(authId)
  console.log("connection authId", authId);
  // Add store connection to storeConnections
  storeConnections[authId] = { socket, isAlive: true };

  // Send periodic pings to check if store is online
  const pingInterval = setInterval(() => {
    if (storeConnections[authId].isAlive === false) {
      // Store is offline, update DB and clean up
      markStoreAsOffline(authId);
      clearInterval(pingInterval);
      socket.disconnect();
    } else {
      // Ping store and reset isAlive
      storeConnections[authId].isAlive = false;
      socket.emit("ping");
    }
  }, 10000); // Ping every 10 seconds

  // Listen for pong from store (heartbeat response)
  socket.on("pong", () => {
    storeConnections[authId].isAlive = true;
    markStoreAsOnline(authId); // Update online status in DB
  });

  // Handle disconnect event
  socket.on("disconnect", () => {
    clearInterval(pingInterval);
    delete storeConnections[authId];
    markStoreAsOffline(authId); // Mark store as offline in DB
  });
});

// Update store status in the database
async function markStoreAsOnline(id) {
  await prisma.Stores.update({
    where: { auth_id: id },
    data: { isOnline: true },
  });
}

async function markStoreAsOffline(id) {
  await prisma.Stores.update({
    where: { auth_id: id },
    data: { isOnline: false },
  });
}
// wsServer.on("connection", (socket) => {
// //   console.log("frontend connected", socket.id);
//   socket.on("store-connect", (storeId) => {
//     storeConnections[storeId] = { socket, lastPing: Date.now(), isAlive: true  };
//     console.log(`Store ${storeId} connected`);

//     // Send periodic heartbeats to the store
//     const heartbeatInterval = setInterval(() => {
//       if (storeConnections[storeId]) {
//         storeConnections[storeId].socket.emit("heartbeat", { storeId });
//       }
//     }, 10000);

//     // Handle disconnection
//     socket.on("disconnect", () => {
//       clearInterval(heartbeatInterval);
//       delete storeConnections[storeId];
//       console.log(`Store ${storeId} disconnected`);
//     });
//   });

//   // Update the store's last ping time
//   socket.on("heartbeat-response", (storeId) => {
//     console.log("heartbeat-response");
//     if (storeConnections[storeId]) {
//       storeConnections[storeId].lastPing = Date.now();
//     }
//   });
// });
// Monitor stores' last heartbeat and mark them offline if needed
// setInterval(() => {
//     console.log("interval runs");
//   if (Object.keys(storeConnections).length === 0) return;
//   console.log("2interval runs2");
//   const now = Date.now();
// //   console.log("storeConnections", storeConnections);

//   Object.keys(storeConnections).forEach((storeId) => {
//     if (now - storeConnections[storeId].lastPing > 30000) {
//       // 30 seconds timeout
//       console.log(`Store ${storeId} is offline`);
//       // Handle store going offline (e.g., update database)
//       delete storeConnections[storeId];
//     }
//   });
// }, 10000);
module.exports = httpServer;
