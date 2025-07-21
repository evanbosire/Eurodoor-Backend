const express = require("express");
const router = express.Router();
const Dispatch = require("../models/Dispatch");
const Order = require("../models/Order");
const Employee = require("../models/Employee");

// // ✅ View assigned orders with full customer info
// router.get("/assigned/:driverId", async (req, res) => {
//   try {
//     const orders = await Dispatch.find({ driver: req.params.driverId })
//       .populate({
//         path: "order",
//         populate: {
//           path: "customer", // This will populate the customer inside the order
//         },
//       });

//     res.json(orders);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Server error" });
//   }
// });


// // ✅ Mark delivery complete
// router.put("/delivered/:dispatchId", async (req, res) => {
//   const dispatch = await Dispatch.findById(req.params.dispatchId);
//   if (!dispatch) return res.status(404).json({ message: "Dispatch not found" });

//   dispatch.status = "delivered";
//   await dispatch.save();

//   const order = await Order.findById(dispatch.order);
//   order.status = "delivered";
//   await order.save();

//   res.json({ message: "Order marked as delivered" });
// });

// 1. Email-based assignment lookup (recommended primary endpoint)
router.get("/assigned-by-email/:driverEmail", async (req, res) => {
  try {
    const driver = await Employee.findOne({ email: req.params.driverEmail });
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const orders = await Dispatch.find({ driver: driver._id })
      .populate({
        path: "order",
        populate: { path: "customer" }
      })
      .populate("driver");

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 2. Delivery completion endpoint (required)
router.put("/delivered/:dispatchId", async (req, res) => {
  try {
    const dispatch = await Dispatch.findById(req.params.dispatchId);
    if (!dispatch) return res.status(404).json({ message: "Dispatch not found" });

    dispatch.status = "delivered";
    await dispatch.save();

    const order = await Order.findById(dispatch.order);
    if (order) {
      order.status = "delivered";
      await order.save();
    }

    res.json({ message: "Order marked as delivered" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
