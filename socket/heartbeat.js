const { Server } = require("socket.io");
const { createServer } = require("http");
const { prisma } = require("../config/db/dbConfig");
const saveTempProductDataToDB = require("../helpers/saveTempProductDataToDB");
const processSubcategoryMove = require("../helpers/processSubcategoryMove");


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

  // socket.emit("terminal-status", { status: terminalStatus || "offline" });
  socket.on("check-status", () => {
    console.log("Received 'check-status' from client");
    sendHandshake(forPing);
  });

  socket.on("idle-status", async (status) => {
    console.log("idle-status status", status);
    if (status.isIdleOpen) {
     
      if (!isSaving) {
        isSaving = true;

        await saveTempProductDataToDB(); 
        await processSubcategoryMove();
        isSaving = false; 
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
  socket.on("screen-status", (status) => {
    console.log("on status", status);
  });
});

const checkIdleFrontStatus = () => {
  console.log("checkIdleFrontStatus isSaving", isSaving);
  if (isSaving) return; 

  wsServer.emit("screen-status", () =>
    console.log("wsServer.emit screen-status")
  );
};

module.exports = { httpServer, wsServer, checkIdleFrontStatus };
