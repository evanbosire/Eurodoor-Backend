const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Dispatch = require("../models/Dispatch");
const Feedback = require("../models/Feedback");
const Employee = require("../models/Employee");

// ✅ GET: View all released orders ready for dispatch
router.get("/released-orders", async (req, res) => {
  const orders = await Order.find({ status: "released" }).populate("customer items.product");
  res.json(orders);
});
// GET /api/employees/drivers - get all active drivers
router.get("/employees/drivers", async (req, res) => {
  try {
    const drivers = await Employee.find({ role: "Driver", status: "active" }).select("_id firstName lastName email");
    res.json(drivers);
  } catch (err) {
    console.error("Error fetching drivers:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/dispatch/assign/:orderId - assign a selected driver by ID
router.put("/assign/:orderId", async (req, res) => {
  const { driverId } = req.body;

  try {
    // Validate driver
    const driver = await Employee.findOne({
      _id: driverId,
      role: "Driver",
      status: "active"
    });
    if (!driver) return res.status(404).json({ message: "Driver not found or inactive" });

    // Find and validate order
    const order = await Order.findById(req.params.orderId)
      .populate("customer")         // include customer details
      .populate("items.product");   // include product info in items

    if (!order) return res.status(404).json({ message: "Order not found" });

    // Create dispatch record
    const dispatch = await Dispatch.create({
      order: order._id,
      driver: driver._id
    });

    // Update order status
    order.status = "shipped"; // or "dispatched" if you added it in your enum
    await order.save();

    res.json({
      message: `Driver ${driver.firstName} ${driver.lastName} assigned successfully`,
      dispatch,
      orderDetails: {
        orderId: order._id,
        status: order.status,
        total: order.total,
        customer: {
          name: order.customer.customerName,
          email: order.customer.email,
          phone: order.customer.phone
        },
        items: order.items.map(item => ({
          title: item.title,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.quantity * item.price,
          productId: item.product?._id || null
        }))
      }
    });

  } catch (err) {
    console.error("Error assigning driver:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ GET: View all customer feedbacks with customer & order details
router.get("/feedbacks", async (req, res) => {
  try {
    const feedbacks = await Feedback.find()
      .populate({
        path: "customer",
        select: "customerName email phone" // adjust fields as needed
      })
      .populate({
        path: "order",
        populate: {
          path: "items.product", // optional: populate product inside order
        },
      });

    res.json(feedbacks);
  } catch (error) {
    console.error("Error fetching feedbacks:", error);
    res.status(500).json({ message: "Failed to fetch feedbacks" });
  }
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

// GET /api/dispatch/dispatch-info/:orderId - get driver assignment info
router.get("/dispatch-info/:orderId", async (req, res) => {
  try {
    const dispatch = await Dispatch.findOne({ order: req.params.orderId })
      .populate('driver', 'firstName lastName email');
    
    if (!dispatch) {
      return res.status(404).json({ message: "No dispatch record found" });
    }

    res.json({
      driver: dispatch.driver
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
