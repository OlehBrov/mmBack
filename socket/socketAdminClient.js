const { io } = require("socket.io-client");
const {STORE_AUTH_ID}= process.env
// Replace with the actual Admin Backend URL and port
const ADMIN_SERVER_URL = "http://localhost:7777";

// Store configuration
const storeId = STORE_AUTH_ID; // Unique identifier for the store

// const socket = io(ADMIN_SERVER_URL, {
//   transports: ["websocket"], // Force WebSocket transport
//   reconnection: true,        // Enable reconnection
//   reconnectionAttempts: 5,   // Number of retry attempts
//   timeout: 5000,             // Connection timeout in ms
// });

// socket.on("connect_error", (err) => {
//   console.error("Connection error:", err);
// });

// socket.on("connect_timeout", () => {
//   console.error("Connection timed out");
// });

// socket.on("error", (err) => {
//   console.error("Socket error:", err);
// });

// Handle connection to the admin backend
// socket.on("connect", () => {
//   console.log(`Connected to Admin Backend as Store ID: ${storeId}`);
//   socket.emit("register", storeId); // Register the store with the admin backend
// });

// Periodically send pings to the admin backend
// setInterval(() => {
//   console.log(`Sending ping from Store ID: ${storeId}`);
//   socket.emit("ping", storeId);
// }, 60000); // Ping every 10 seconds

// Handle pong response from the admin backend
// socket.on("pong", (message) => {
//   console.log(`Pong received from Admin: ${message}`);
// });

// Handle disconnection
// socket.on("disconnect", () => {
//   console.log("Disconnected from Admin Backend");
// });
