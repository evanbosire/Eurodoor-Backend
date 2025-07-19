// 2. RawMaterialStock.js

const mongoose = require("mongoose");

const rawMaterialStockSchema = new mongoose.Schema({
  materialName: String,
  quantity: Number,
  unit: { type: String, required: false },
});
module.exports = mongoose.model("RawMaterialStock", rawMaterialStockSchema);
