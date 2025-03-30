const express = require("express");
const app = require("./app");

const {httpServer} = require("./socket/heartbeat");
const { checkUnsentRecipes } = require("./api/fisclalApi");

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(express.json());

app.listen(6006, '0.0.0.0', () => {
  console.log("Listening on port 6006!");
  checkUnsentRecipes();
});
httpServer.listen(5005, '0.0.0.0', () => {
  console.log("Listening on port 5005 socket!");
})

