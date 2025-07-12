const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
  title: String,
  description: String,
  price: Number,
  quantity: Number,
  status: { type: String, enum: ["active", "inactive"], default: "active" }
}, { timestamps: true });

const Product = mongoose.model("Product", ProductSchema);
module.exports = Product;
