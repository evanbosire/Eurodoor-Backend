const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const Order = require("../models/Order");
const InventoryLog = require("../models/InventoryLog");
const Payment = require("../models/Payment");

// ✅ POST: Add or update product by title
router.post("/products", async (req, res) => {
  try {
    const { title, description, price, quantity, status } = req.body;

    // Check if a product with the same title exists
    const existingProduct = await Product.findOne({ title });

    if (existingProduct) {
      // ✅ Product exists — increase quantity
      existingProduct.quantity += quantity;
      await existingProduct.save();
      return res.status(200).json({
        message: "Product already exists. Quantity updated.",
        product: existingProduct,
      });
    }

    // ✅ Product does not exist — create new
    const newProduct = new Product({ title, description, price, quantity, status });
    await newProduct.save();

    res.status(201).json({
      message: "New product created.",
      product: newProduct,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});


// ✅ GET: View merged active products by title
router.get("/products", async (req, res) => {
  try {
    const mergedProducts = await Product.aggregate([
      { $match: { status: "active" } },
      {
        $group: {
          _id: "$title", // Group by title
          description: { $first: "$description" },
          price: { $first: "$price" },
          status: { $first: "$status" },
          totalQuantity: { $sum: "$quantity" },
        },
      },
      {
        $project: {
          _id: 0,
          title: "$_id",
          description: 1,
          price: 1,
          status: 1,
          quantity: "$totalQuantity",
        },
      },
    ]);

    res.status(200).json(mergedProducts);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


// ✅ GET: View all paid orders to release
router.get("/confirmed-payments", async (req, res) => {
  try {
    const confirmedPayments = await Payment.find({ status: "confirmed" })
      .populate("order")
      .populate("customer"); // optional, if you want customer info too

    res.status(200).json(confirmedPayments);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
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
