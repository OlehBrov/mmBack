const { Server } = require("socket.io");
const { createServer } = require("http");
const { prisma } = require("../config/db/dbConfig");
const saveTempProductDataToDB = require("../helpers/saveTempProductDataToDB");

const httpServer = createServer();

let isSaving = false; // To avoid duplicate save operations
const wsServer = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

const forPing = {
  method: "PingDevice",
  step: 0,
};
wsServer.removeAllListeners("connect");
wsServer.on("connection", (socket) => {
  const { sendHandshake } = require("../client");
  // Send initial terminal status to the newly connected client
  // socket.emit("terminal-status", { status: terminalStatus || "offline" });
  socket.on("check-status", () => {
    console.log("Received 'check-status' from client");
    sendHandshake(forPing);
  });

  socket.on("idle-status", async (status) => {
    if (status.isIdleOpen) {
      // If idle is false, stop checking and save the data
      if (!isSaving) {
        isSaving = true; // Prevent duplicate saves

        await saveTempProductDataToDB(); // Save data
        isSaving = false; // Reset saving status
      }
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("Front-end client disconnected");
    wsServer.removeAllListeners("connect");
  });
  socket.on("admin-ping", () => {
    socket.emit("admin-pong");
    console.log('admin-pong sent')
  })
  // socket.on("screen-status", (status) => {
  //   console.log("on status", status);
  // });
});

const checkIdleFrontStatus = () => {
  if (isSaving) return; // If data is being saved, skip checks

  wsServer.emit("screen-status", () =>
    console.log("wsServer.emit screen-status")
  );
};

module.exports = { httpServer, wsServer, checkIdleFrontStatus };
