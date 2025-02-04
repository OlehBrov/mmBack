const { sendHandshake } = require("../client");
const { wsServer } = require("../socket/heartbeat");

const forPing = {
  method: "PingDevice",
  step: 0,
};

 

const checkTerminalConnection  = async ()=>{
    try {
      await sendHandshake(forPing); 
      socket.emit("terminal-status", { status: "online" }); 
      console.log("Sent 'terminal-status': online");
    } catch (err) {
      console.error("Error checking terminal status:", err.message);
      socket.emit("terminal-status", { status: "offline" }); 
      console.log("Sent 'terminal-status': offline");
      }
      }


module.exports = {checkTerminalConnection}
