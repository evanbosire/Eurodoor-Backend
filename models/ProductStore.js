const mongoose = require("mongoose");

const productStoreSchema = new mongoose.Schema({
  doorName: { type: String, required: true },
  description: { type: String },
  quantity: { type: Number, default: 0 },
});

module.exports = mongoose.model("ProductStore", productStoreSchema);
