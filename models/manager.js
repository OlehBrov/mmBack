const { Schema, model } = require("mongoose");

const managerSchema = new Schema({
  name: String,
  login: String,
  password: String,
  token: { type: String, default: "" },
  role: { type: String, default: "admin" },
});

const Manager = model("manager", managerSchema);
module.exports = Manager;
