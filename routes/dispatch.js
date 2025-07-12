const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Dispatch = require("../models/Dispatch");
const Feedback = require("../models/Feedback");

// ✅ GET: View all released orders ready for dispatch
router.get("/released-orders", async (req, res) => {
  const orders = await Order.find({ status: "released" }).populate("customer items.product");
  res.json(orders);
});

// ✅ PUT: Assign a driver to an order (no need for dispatchedBy)
router.put("/assign/:orderId", async (req, res) => {
  const { driverId } = req.body;

  const dispatch = await Dispatch.create({
    order: req.params.orderId,
    driver: driverId
  });

  const order = await Order.findById(req.params.orderId);
  order.status = "dispatched";
  await order.save();

  res.json({ message: "Driver assigned successfully", dispatch });
});

// ✅ GET: View all customer feedbacks
router.get("/feedbacks", async (req, res) => {
  const feedbacks = await Feedback.find().populate("customer order");
  res.json(feedbacks);
});

// ✅ PUT: Reply to a feedback
router.put("/reply/:feedbackId", async (req, res) => {
  const { reply } = req.body;

  const feedback = await Feedback.findByIdAndUpdate(
    req.params.feedbackId,
    { reply },
    { new: true }
  );

  res.json(feedback);
});

module.exports = router;
