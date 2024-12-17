const { sendHandshake } = require("../client");
const { wsServer } = require("../socket/heartbeat");

const forPing = {
  method: "PingDevice",
  step: 0,
};

  // Listen for 'check-status' event from the front-end

const checkTerminalConnection  = async ()=>{
    try {
      await sendHandshake(forPing); // Perform the ping handshake
      socket.emit("terminal-status", { status: "online" }); // Emit online status to the front-end
      console.log("Sent 'terminal-status': online");
    } catch (err) {
      console.error("Error checking terminal status:", err.message);
      socket.emit("terminal-status", { status: "offline" }); // Emit offline status to the front-end
      console.log("Sent 'terminal-status': offline");
      }
      }


module.exports = {checkTerminalConnection}
