// models/Tool.js
const mongoose = require("mongoose");

const toolSchema = new mongoose.Schema({
  name: { type: String, required: true },
  unit: { type: String, required: true },
  quantityAvailable: { type: Number, default: 0 },
});

module.exports = mongoose.model("Tool", toolSchema);