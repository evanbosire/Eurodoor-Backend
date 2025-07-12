const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const Order = require("../models/Order");
const InventoryLog = require("../models/InventoryLog");

// ✅ POST: Add new product
router.post("/products", async (req, res) => {
  try {
    const { title, description, price, quantity, status } = req.body;
    const product = new Product({ title, description, price, quantity, status });
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ✅ GET: View all active products
router.get("/products", async (req, res) => {
  const products = await Product.find({ status: "active" });
  res.json(products);
});

// ✅ GET: View all paid orders to release
router.get("/orders/paid", async (req, res) => {
  const orders = await Order.find({ status: "paid" }).populate("customer items.product");
  res.json(orders);
});

// ✅ PUT: Release products for dispatch (decrease quantity)
router.put("/release/:orderId", async (req, res) => {
  const order = await Order.findById(req.params.orderId).populate("items.product");
  if (!order) return res.status(404).json({ message: "Order not found" });

  for (const item of order.items) {
    const product = await Product.findById(item.product._id);
    if (!product) continue;

    product.quantity -= item.quantity;
    await product.save();

    await InventoryLog.create({
      product: product._id,
      quantity: item.quantity,
      type: "release",
      relatedOrder: order._id
    });
  }

  order.status = "released";
  await order.save();

  res.json({ message: "Order released for dispatch" });
});

module.exports = router;
