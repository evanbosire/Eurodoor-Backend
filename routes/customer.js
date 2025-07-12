const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const Feedback = require("../models/Feedback");
const Receipt = require("../models/Receipt");
const Payment = require("../models/Payment");

// ✅ View products
router.get("/products", async (req, res) => {
  const products = await Product.find({ status: "active" });
  res.json(products);
});

// ✅ Add product to cart
router.post("/cart/add", async (req, res) => {
  const { customerId, productId, quantity } = req.body;
  let cart = await Cart.findOne({ customer: customerId });

  if (!cart) cart = new Cart({ customer: customerId, items: [] });

  cart.items.push({ product: productId, quantity });
  await cart.save();
  res.json(cart);
});

// ✅ Checkout to create an order
router.post("/checkout", async (req, res) => {
  const { customerId } = req.body;
  const cart = await Cart.findOne({ customer: customerId }).populate("items.product");

  if (!cart || cart.items.length === 0) {
    return res.status(400).json({ message: "Cart is empty" });
  }

  let total = 0;
  const items = cart.items.map(item => {
    total += item.quantity * item.product.price;
    return {
      product: item.product._id,
      quantity: item.quantity
    };
  });

  const order = new Order({ customer: customerId, items, total });
  await order.save();
  await Cart.deleteOne({ _id: cart._id });

  res.status(201).json(order);
});

// ✅ View own orders
router.get("/orders/:customerId", async (req, res) => {
  const orders = await Order.find({ customer: req.params.customerId }).populate("items.product");
  res.json(orders);
});

// ✅ Submit feedback
router.post("/feedback/:orderId", async (req, res) => {
  const { customerId, message } = req.body;
  const feedback = await Feedback.create({
    order: req.params.orderId,
    customer: customerId,
    message
  });
  res.status(201).json(feedback);
});

// ✅ Generate receipt if payment is approved
router.get("/receipt/:orderId", async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  if (order.status !== "paid") return res.status(400).json({ message: "Not paid" });

  const payment = await Payment.findOne({ order: order._id, status: "approved" });
  if (!payment) return res.status(404).json({ message: "Payment not found" });

  const existing = await Receipt.findOne({ order: order._id });
  if (existing) return res.json(existing);

  const receipt = await Receipt.create({
    customer: order.customer,
    order: order._id,
    payment: payment._id,
    amountPaid: payment.amountPaid,
    code: payment.code
  });

  res.status(201).json(receipt);
});

module.exports = router;
