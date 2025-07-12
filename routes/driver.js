const express = require("express");
const router = express.Router();
const Dispatch = require("../models/Dispatch");
const Order = require("../models/Order");

// ✅ View assigned orders
router.get("/assigned/:driverId", async (req, res) => {
  const orders = await Dispatch.find({ driver: req.params.driverId }).populate("order");
  res.json(orders);
});

// ✅ Mark delivery complete
router.put("/delivered/:dispatchId", async (req, res) => {
  const dispatch = await Dispatch.findById(req.params.dispatchId);
  if (!dispatch) return res.status(404).json({ message: "Dispatch not found" });

  dispatch.status = "delivered";
  await dispatch.save();

  const order = await Order.findById(dispatch.order);
  order.status = "delivered";
  await order.save();

  res.json({ message: "Order marked as delivered" });
});

module.exports = router;
