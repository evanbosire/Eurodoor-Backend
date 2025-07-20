const express = require("express");
const router = express.Router();
const Dispatch = require("../models/Dispatch");
const Order = require("../models/Order");

// ✅ View assigned orders with full customer info
// ✅ View assigned orders with full customer info (using email instead of driverId)
router.get("/assigned-by-email/:driverEmail", async (req, res) => {
  try {
    // First find the driver by email to get their ID
    const driver = await Driver.findOne({ email: req.params.driverEmail });
    
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    // Then find orders with the driver's ID
    const orders = await Dispatch.find({ driver: driver._id })
      .populate({
        path: "order",
        populate: {
          path: "customer",
        },
      });

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
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
