const express = require("express");
const app = require("./app");

// const httpServer = require("./socket/heartbeat");

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(express.json());
// connectDB();
// connectSQLDB();
app.listen(6006, '0.0.0.0', () => {
  console.log("Example app listening on port 6006!");
});
// httpServer.listen(5005)