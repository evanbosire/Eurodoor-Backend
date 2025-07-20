const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const Feedback = require("../models/Feedback");
const Receipt = require("../models/Receipt");
const Payment = require("../models/Payment");
const Customer = require("../models/Customer");

// ********** SERVICE IMPORTS *********************//
const ServiceBooking = require("../models/ServiceBooking");
const ServiceFeedback = require("../models/ServiceFeedback");
const ServiceReceipt = require("../models/ServiceReceipt");



const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

// ✅ View products with merged quantities by title
router.get("/products", async (req, res) => {
  try {
    const products = await Product.aggregate([
      { $match: { status: "active" } },
      {
        $group: {
          _id: "$title",
          productId: { $first: "$_id" }, // Maintain original ObjectId
          description: { $first: "$description" },
          price: { $first: "$price" },
          status: { $first: "$status" },
          imageUrl: { $first: "$imageUrl" },
          quantity: { $sum: "$quantity" },
        },
      },
      {
        $project: {
          _id: "$productId", // Use ObjectId as primary identifier
          title: "$_id",
          description: 1,
          price: 1,
          status: 1,
          imageUrl: 1,
          quantity: 1,
        },
      },
    ]);

    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST /api/customer/get-id
router.post("/get-id", async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const customer = await Customer.findOne({ email });
  if (!customer) {
    console.log("Customer not found in DB");
    return res.status(404).json({ message: "Customer not found" });
  }
  res.json({ _id: customer._id });
});

// ✅ Add product to cart
router.post("/cart/add", async (req, res) => {
  const { customerId, productId, quantity } = req.body;

  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ message: "Product not found" });

  let cart = await Cart.findOne({ customer: customerId });
  if (!cart) {
    cart = new Cart({ customer: customerId, items: [] });
  }

  // ✅ Check if product already exists in cart
  const existingItem = cart.items.find(
    (item) => item.product.toString() === productId
  );

  if (existingItem) {
    // ✅ If exists, update quantity
    existingItem.quantity += quantity;
  } else {
    // ✅ Else, push new item
    cart.items.push({
      product: product._id,
      quantity,
      title: product.title,
      description: product.description,
      imageUrl: product.imageUrl,
      price: product.price,
    });
  }

  await cart.save();
  res.json(cart);
});

// ✅ View Cart with Total
router.get("/cart/view/:customerId", async (req, res) => {
  try {
    const { customerId } = req.params;
    const cart = await Cart.findOne({ customer: customerId }).populate(
      "items.product"
    );

    if (!cart || cart.items.length === 0) {
      return res
        .status(200)
        .json({ message: "Cart is empty", items: [], total: 0 });
    }

    // ✅ Calculate total price
    let total = 0;
    cart.items.forEach((item) => {
      if (item.product && item.product.price) {
        total += item.quantity * item.product.price;
      }
    });

    res.status(200).json({
      message: "Cart retrieved successfully",
      cart,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

//  customer to update the cart info
router.put("/cart/update", async (req, res) => {
  const { customerId, productId, quantity } = req.body;

  const cart = await Cart.findOne({ customer: customerId });
  if (!cart) return res.status(404).json({ message: "Cart not found" });

  const item = cart.items.find((item) => item.product.toString() === productId);
  if (!item) return res.status(404).json({ message: "Product not in cart" });

  item.quantity = quantity; // update to new quantity
  await cart.save();

  res.status(200).json({ message: "Cart updated", cart });
});
// delete from cart
router.delete("/cart/remove", async (req, res) => {
  const { customerId, productId } = req.body;

  const cart = await Cart.findOne({ customer: customerId });
  if (!cart) return res.status(404).json({ message: "Cart not found" });

  // ✅ Filter out the product
  cart.items = cart.items.filter(
    (item) => item.product.toString() !== productId
  );

  await cart.save();
  res.status(200).json({ message: "Item removed", cart });
});

// POST /api/payment
router.post("/payment", async (req, res) => {
  const { customerId, code, amountPaid } = req.body;

  const cart = await Cart.findOne({ customer: customerId }).populate(
    "items.product"
  );
  if (!cart || cart.items.length === 0) {
    return res.status(400).json({ message: "Cart is empty" });
  }

  // Calculate total
  let total = 0;
  const items = cart.items.map((item) => {
    total += item.quantity * item.product.price;
    return {
      product: item.product._id,
      quantity: item.quantity,
      title: item.product.title,
      description: item.product.description,
      imageUrl: item.product.imageUrl,
      price: item.product.price,
    };
  });

  if (amountPaid < total) {
    return res.status(400).json({ message: "Insufficient amount paid" });
  }

  // Create payment with status "paid"
  const payment = new Payment({
    customer: customerId,
    code,
    amountPaid,
    status: "paid",
  });

  // Create order with status "placed"
  const order = new Order({
    customer: customerId,
    items,
    total,
    status: "placed",
    payment: payment._id,
  });

  payment.order = order._id;

  await order.save();
  await payment.save();
  await Cart.deleteOne({ _id: cart._id });

  res.status(201).json({ message: "Payment successful. Order placed.", order });
});

// ✅ View own orders (updated version)
router.get("/orders/:customerId", async (req, res) => {
  const orders = await Order.find({ customer: req.params.customerId })
    .populate("items.product")  // Populate product details
    .populate("payment");       // Add this to populate payment details
  
  res.json(orders);
});

// ✅ Submit feedback with validation
router.post("/feedback/:orderId", async (req, res) => {
  try {
    const { customerId, message } = req.body;
    const { orderId } = req.params;

    // Validate required fields
    if (!customerId || !message) {
      return res.status(400).json({ message: "Both customerId and message are required" });
    }
    // Create and save feedback
    const feedback = await Feedback.create({
      order: orderId,
      customer: customerId,
      message: message.trim(),
    });

    // Respond with the created feedback
    res.status(201).json(feedback);

  } catch (error) {
    console.error("Error submitting feedback:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
// ✅ GET: View all feedbacks and replies for a specific customer
router.get("/replies/:customerId", async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ customer: req.params.customerId })
      .populate({
        path: "order",
        select: "items total status"
      })
      .populate({
        path: "dispatchManager",
        select: "name email role"
      });

    res.json(feedbacks);
  } catch (error) {
    console.error("Error fetching customer feedbacks:", error);
    res.status(500).json({ message: "Failed to fetch feedbacks" });
  }
});

// router.get("/receipt/:orderId", async (req, res) => {
//   try {
//     const order = await Order.findById(req.params.orderId).populate(
//       "items.product customer"
//     );
//     if (!order) return res.status(404).json({ message: "Order not found" });

//     const payment = await Payment.findOne({
//       order: order._id,
//       status: "confirmed",
//     });
//     if (!payment)
//       return res.status(400).json({ message: "Payment not confirmed yet" });

//     const receiptsDir = path.join(__dirname, "../public/receipts");
//     if (!fs.existsSync(receiptsDir)) {
//       fs.mkdirSync(receiptsDir, { recursive: true });
//     }

//     const receiptPath = path.join(receiptsDir, `${order._id}.pdf`);
//     const writeStream = fs.createWriteStream(receiptPath);
//     const doc = new PDFDocument({ size: "A4", margin: 50 });
//     doc.pipe(writeStream);

//     // === Header ===
//     doc.fontSize(22).fillColor("#003366").text("EuroDoor", { align: "center" });
//     doc.moveDown(0.5);
//     doc
//       .fontSize(18)
//       .fillColor("#000000")
//       .text("Customer Order Receipt", { align: "center" });
//     doc.moveDown();

//     // === Customer Info ===
//     const customer = order.customer;
//     doc.fontSize(12);
//     doc.text(`Receipt ID: ${order._id}`);
//     doc.text(`Customer Name: ${customer.customerName}`);
//     doc.text(`Customer Email: ${customer.email}`);
//     if (customer.phone) doc.text(`Customer Phone: ${customer.phone}`);
//     doc.moveDown();

//     // === Product Table Header ===
//     doc
//       .fontSize(13)
//       .fillColor("#003366")
//       .text("Order Details:", { underline: true });
//     doc.moveDown(0.5);

//     // Table Column Titles
//     doc.fontSize(12).fillColor("#000000");
//     const y = doc.y;
//     doc.text("No", 50, y);
//     doc.text("Product", 100, y);
//     doc.text("Qty", 300, y);
//     doc.text("Unit Price", 350, y);
//     doc.text("Subtotal", 450, y);
//     doc
//       .moveTo(50, y + 15)
//       .lineTo(550, y + 15)
//       .stroke();

//     // Table Rows
//     let total = 0;
//     let rowY = y + 20;
//     order.items.forEach((item, index) => {
//       const subtotal = item.quantity * item.price;
//       total += subtotal;

//       doc.fontSize(11);
//       doc.text(`${index + 1}`, 50, rowY);
//       doc.text(item.title, 100, rowY, { width: 180 });
//       doc.text(item.quantity.toString(), 300, rowY);
//       doc.text(`KES ${item.price}`, 350, rowY);
//       doc.text(`KES ${subtotal}`, 450, rowY);
//       rowY += 20;
//     });

//     doc.moveTo(50, rowY).lineTo(550, rowY).stroke();
//     rowY += 10;

//     // === Payment Summary ===
//     rowY += 20;
//     doc
//       .fontSize(12)
//       .text(`Total Amount Paid: KES ${payment.amountPaid}`, 350, rowY, {
//         align: "left",
//       });

//     rowY += 20;
//     doc.text(`Payment Code (M-PESA): ${payment.code}`, 350, rowY, {
//       align: "left",
//     });

//     rowY += 30;
//     doc.text(`Payment Date: ${payment.createdAt.toDateString()}`, 350, rowY, {
//       align: "left",
//     });

//     doc.moveDown(3);

//     // === Footer ===
//     doc.moveDown(2);
//     doc.fontSize(10).fillColor("gray");

//     // Use full page width and center-align
//     doc.text("Thank you for shopping with EuroDoor!", 50, doc.y, {
//       width: 500,
//       align: "center",
//     });
//     doc.text("For inquiries, contact us at eurodoor@gmail.com", 50, doc.y, {
//       width: 500,
//       align: "center",
//     });
//     doc.end();

//     writeStream.on("finish", async () => {
//       const receiptUrl = `/receipts/${order._id}.pdf`;

//       await Receipt.create({
//         customer: customer._id,
//         order: order._id,
//         payment: payment._id,
//         amountPaid: payment.amountPaid,
//         code: payment.code,
//         receiptUrl,
//         generatedAt: new Date(),
//       });

//       res.status(200).json({
//         message: "Receipt generated successfully",
//         receiptUrl,
//       });
//     });

//     writeStream.on("error", (err) => {
//       console.error("Write stream error:", err);
//       res.status(500).json({ message: "Error saving receipt file" });
//     });
//   } catch (err) {
//     console.error("Error generating receipt:", err);
//     res.status(500).json({ message: "Internal server error" });
//   }
// });

// Add this new route for generating receipts
router.post("/generate-receipt", async (req, res) => {
  try {
    const { orderId } = req.body;
    
    const order = await Order.findById(orderId).populate("items.product customer");
    if (!order) return res.status(404).json({ message: "Order not found" });

    const payment = await Payment.findOne({
      order: order._id,
      status: "confirmed",
    });
    if (!payment) {
      return res.status(400).json({ message: "Payment not confirmed yet" });
    }

    // Generate PDF (same as your existing receipt generation code)
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=receipt_${order._id}.pdf`
      });
      res.send(pdfData);
    });

    // === Header ===
    doc.fontSize(22).fillColor("#003366").text("EuroDoor", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(18)
      .fillColor("#000000")
      .text("Customer Order Receipt", { align: "center" });
    doc.moveDown();

    // === Customer Info ===
    const customer = order.customer;
    doc.fontSize(12);
    doc.text(`Receipt ID: ${order._id}`);
    doc.text(`Customer Name: ${customer.customerName}`);
    doc.text(`Customer Email: ${customer.email}`);
    if (customer.phone) doc.text(`Customer Phone: ${customer.phone}`);
    doc.moveDown();

    // === Product Table Header ===
    doc
      .fontSize(13)
      .fillColor("#003366")
      .text("Order Details:", { underline: true });
    doc.moveDown(0.5);

    // Table Column Titles
    doc.fontSize(12).fillColor("#000000");
    const y = doc.y;
    doc.text("No", 50, y);
    doc.text("Product", 100, y);
    doc.text("Qty", 300, y);
    doc.text("Unit Price", 350, y);
    doc.text("Subtotal", 450, y);
    doc
      .moveTo(50, y + 15)
      .lineTo(550, y + 15)
      .stroke();

    // Table Rows
    let total = 0;
    let rowY = y + 20;
    order.items.forEach((item, index) => {
      const subtotal = item.quantity * item.price;
      total += subtotal;

      doc.fontSize(11);
      doc.text(`${index + 1}`, 50, rowY);
      doc.text(item.title, 100, rowY, { width: 180 });
      doc.text(item.quantity.toString(), 300, rowY);
      doc.text(`KES ${item.price}`, 350, rowY);
      doc.text(`KES ${subtotal}`, 450, rowY);
      rowY += 20;
    });

    doc.moveTo(50, rowY).lineTo(550, rowY).stroke();
    rowY += 10;

    // === Payment Summary ===
    rowY += 20;
    doc
      .fontSize(12)
      .text(`Total Amount Paid: KES ${payment.amountPaid}`, 350, rowY, {
        align: "left",
      });

    rowY += 20;
    doc.text(`Payment Code (M-PESA): ${payment.code}`, 350, rowY, {
      align: "left",
    });

    rowY += 30;
    doc.text(`Payment Date: ${payment.createdAt.toDateString()}`, 350, rowY, {
      align: "left",
    });

    doc.moveDown(3);

    // === Footer ===
    doc.moveDown(2);
    doc.fontSize(10).fillColor("gray");
    doc.text("Thank you for shopping with EuroDoor!", 50, doc.y, {
      width: 500,
      align: "center",
    });
    doc.text("For inquiries, contact us at eurodoor@gmail.com", 50, doc.y, {
      width: 500,
      align: "center",
    });
    doc.end();

  } catch (err) {
    console.error("Error generating receipt:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ************ SERVICE BOOKING ROUTES *******************//


// 1. Customer creates a booking
router.post("/book", async (req, res) => {
  const { customer, doorType, locationDetails, price, paymentCode } = req.body;

  try {
    // Create the booking
    const booking = await ServiceBooking.create({
      customer,
      doorType, // ✅ this must match the schema
      locationDetails,
      price,
      paymentCode,
    });

    // Populate customer details (name, email, phone)
    const populatedBooking = await ServiceBooking.findById(booking._id)
      .populate("customer", "customerName email phone");

    res.status(201).json(populatedBooking);
  } catch (error) {
    console.error("Booking Error:", error);
    res.status(500).json({ message: "Server error creating booking" });
  }
});

// GET pending-payments for finance
router.get("/pending-payments", async (req, res) => {
  try {
    const pendingBookings = await ServiceBooking.find({ paymentStatus: "pending" })
      .populate("customer", "name email") // Optional: populate customer info
      .sort({ createdAt: -1 }); // Most recent first

    res.status(200).json(pendingBookings);
  } catch (err) {
    console.error("Error fetching pending payments:", err);
    res.status(500).json({ message: "Server error fetching pending bookings." });
  }
});


// 2. Finance manager confirms payment
router.put("/bookings/:id/confirm-payment", async (req, res) => {
  const booking = await ServiceBooking.findByIdAndUpdate(
    req.params.id,
    { paymentStatus: "confirmed", serviceStatus: "payment_confirmed" },
    { new: true }
  );
  res.json(booking);
});

// customer generate service receipt

router.get("/bookings/:id/receipt", async (req, res) => {
  try {
    const booking = await ServiceBooking.findById(req.params.id).populate("customer");
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.paymentStatus !== "confirmed") {
      return res.status(400).json({ message: "Payment not confirmed yet" });
    }

    const receiptsDir = path.join(__dirname, "../public/receipts");
    if (!fs.existsSync(receiptsDir)) {
      fs.mkdirSync(receiptsDir, { recursive: true });
    }

    const receiptPath = path.join(receiptsDir, `${booking._id}.pdf`);
    const writeStream = fs.createWriteStream(receiptPath);
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(writeStream);

    // === Header ===
    doc.fontSize(22).fillColor("#003366").text("EuroDoor", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(18)
      .fillColor("#000000")
      .text("Service Booking Receipt", { align: "center" });
    doc.moveDown();

    // === Customer Info ===
    const customer = booking.customer;
    doc.fontSize(12);
    doc.text(`Receipt ID: ${booking._id}`);
    doc.text(`Booking Date: ${booking.createdAt.toDateString()}`);
    doc.text(`Customer Name: ${customer.customerName}`);
    doc.text(`Customer Email: ${customer.email}`);
    if (customer.phone) doc.text(`Customer Phone: ${customer.phone}`);
    doc.moveDown();

    // === Service Details ===
    doc
      .fontSize(13)
      .fillColor("#003366")
      .text("Service Details:", { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(12).fillColor("#000000");
    const y = doc.y;
    
    // Table Column Titles
    doc.text("Service Type", 50, y);
    doc.text("Door Type", 300, y);
    doc.text("Price", 450, y);
    doc
      .moveTo(50, y + 15)
      .lineTo(550, y + 15)
      .stroke();

    // Service Row
    let rowY = y + 20;
    doc.fontSize(11);
    doc.text("Door Installation", 50, rowY);
    doc.text(booking.doorType, 300, rowY);
    doc.text(`KES ${booking.price}`, 450, rowY);
    rowY += 20;

    doc.moveTo(50, rowY).lineTo(550, rowY).stroke();
    rowY += 10;

    // === Payment Summary ===
    rowY += 20;
    doc
      .fontSize(12)
      .text(`Total Amount Paid: KES ${booking.price}`, 350, rowY, {
        align: "left",
      });

    rowY += 20;
    doc.text(`Payment Code (M-PESA): ${booking.paymentCode}`, 350, rowY, {
      align: "left",
    });

    rowY += 30;
    doc.text(`Payment Status: ${booking.paymentStatus}`, 350, rowY, {
      align: "left",
    });

    rowY += 20;
    doc.text(`Payment Confirmed At: ${booking.updatedAt.toDateString()}`, 350, rowY, {
      align: "left",
    });

    doc.moveDown(3);

    // === Footer ===
    doc.moveDown(2);
    doc.fontSize(10).fillColor("gray");
    doc.text("Thank you for choosing EuroDoor services!", 50, doc.y, {
      width: 500,
      align: "center",
    });
    doc.text("For inquiries, contact us at eurodoor@gmail.com", 50, doc.y, {
      width: 500,
      align: "center",
    });
    doc.end();

    writeStream.on("finish", async () => {
      const receiptUrl = `/receipts/${booking._id}.pdf`;

      await ServiceReceipt.create({
        customer: customer._id,
        booking: booking._id,
        amountPaid: booking.price,
        code: booking.paymentCode,
        receiptUrl,
        generatedAt: new Date(),
      });

      res.status(200).json({
        message: "Receipt generated successfully",
        receiptUrl,
      });
    });

    writeStream.on("error", (err) => {
      console.error("Write stream error:", err);
      res.status(500).json({ message: "Error saving receipt file" });
    });
  } catch (err) {
    console.error("Error generating receipt:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Booking service feedback
// 8. Customer submits feedback
router.post("/booking-feedback/:bookingId", async (req, res) => {
  const { customer, message } = req.body;

  // Step 1: Check if the booking is confirmed
  const booking = await ServiceBooking.findById(req.params.bookingId);
  if (!booking) return res.status(404).json({ message: "Booking not found" });

  if (booking.serviceStatus !== "service_manager_confirmed") {
    return res.status(403).json({ message: "Service not yet confirmed by service manager" });
  }

  // Step 2: Validate body
  if (!customer || !message) {
    return res.status(400).json({ message: "Both customerId and message are required" });
  }

  // Step 3: Create feedback
  const feedback = await ServiceFeedback.create({
    booking: req.params.bookingId,
    customer,
    message
  });

  // Step 4: Populate customer details in the response
  const populatedFeedback = await ServiceFeedback.findById(feedback._id)
    .populate("customer", "-password -__v") // exclude sensitive fields like password
    .populate("booking");

  res.status(201).json(populatedFeedback);
});

// 10. Customer views feedback with replies
router.get("/feedbacks/customer/:customerId", async (req, res) => {
  const feedbacks = await ServiceFeedback.find({ customer: req.params.customerId })
    .populate("booking")
    .populate("serviceManager", "name email");
  res.json(feedbacks);
});



// service manager GET/payment-confirmed
router.get("/payment-confirmed", async (req, res) => {
  try {
    const confirmedServices = await ServiceBooking.find({
      serviceStatus: "payment_confirmed",
    }).populate("customer", "customerName email phone"); // optionally include customer details

    res.status(200).json({
      message: "Confirmed services fetched successfully",
      count: confirmedServices.length,
      data: confirmedServices,
    });
  } catch (error) {
    console.error("Error fetching confirmed services:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 3. Service manager assigns to supervisor
router.put("/bookings/:id/allocate-supervisor", async (req, res) => {
  const { supervisor } = req.body;

  try {
    const updatedBooking = await ServiceBooking.findByIdAndUpdate(
      req.params.id,
      {
        supervisor,
        serviceStatus: "allocated_to_supervisor",
      },
      { new: true }
    ).populate("customer", "customerName email phone");

    if (!updatedBooking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.status(200).json({
      message: "Supervisor allocated successfully",
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("Error allocating supervisor:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/service-manager/bookings/supervisor-approved
router.get("/bookings/supervisor-approved", async (req, res) => {
  try {
    const bookings = await ServiceBooking.find({ serviceStatus: "supervisor_approved" })
      .populate("customer", "customerName phone email")
      .sort({ createdAt: -1 }); // Optional: newest first

    res.status(200).json({
      message: "Supervisor-approved bookings fetched successfully",
      bookings,
    });
  } catch (error) {
    console.error("Error fetching supervisor-approved bookings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


// PUT /api/service-manager/bookings/:id/service-manager-confirm
router.put("/bookings/:id/service-manager-confirm", async (req, res) => {
  try {
    const booking = await ServiceBooking.findByIdAndUpdate(
      req.params.id,
      { serviceStatus: "service_manager_confirmed" },
      { new: true }
    ).populate("customer", "customerName phone email");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.status(200).json({
      message: "Service confirmed by Service Manager successfully",
      booking,
    });
  } catch (error) {
    console.error("Error confirming booking:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 9. Service Manager fetches all customer feedback
router.get("/feedback-messages", async (req, res) => {
  try {
    const feedbacks = await ServiceFeedback.find()
      .populate("customer", "-password -__v") // populate customer info, exclude sensitive fields
      .populate("booking"); // optionally populate booking info

    if (!feedbacks || feedbacks.length === 0) {
      return res.status(404).json({ message: "No feedback messages found" });
    }

    res.status(200).json(feedbacks);
  } catch (error) {
    console.error("Error fetching feedback messages:", error);
    res.status(500).json({ message: "Server error while fetching feedback messages" });
  }
});


// 9. Service manager replies to feedback
router.put("/feedback/reply/:feedbackId", async (req, res) => {
  const { reply } = req.body;

  try {
    const feedback = await ServiceFeedback.findByIdAndUpdate(
      req.params.feedbackId,
      { reply },
      { new: true }
    );

    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    res.status(200).json(feedback);
  } catch (err) {
    console.error("Update error:", err.message);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});



// GET /api/supervisor/bookings
router.get("/supervisor-bookings", async (req, res) => {
  try {
    const bookings = await ServiceBooking.find({
      serviceStatus: "allocated_to_supervisor",
    }).populate("customer", "customerName email phone");

    res.status(200).json({
      message: "All bookings allocated to supervisors fetched successfully",
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 4. Supervisor assigns to technician
router.put("/bookings/:id/assign-technician", async (req, res) => {
  const { technician } = req.body;

  try {
    const booking = await ServiceBooking.findByIdAndUpdate(
      req.params.id,
      {
        technician,
        serviceStatus: "technician_assigned",
      },
      { new: true }
    ).populate("customer", "customerName email phone");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.status(200).json({
      message: "Technician assigned successfully",
      booking,
    });
  } catch (error) {
    console.error("Error assigning technician:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


// GET /api/supervisor/rendered-bookings
router.get("/rendered-bookings", async (req, res) => {
  try {
    const renderedBookings = await ServiceBooking.find({ serviceStatus: "rendered" })
      .populate("customer", "customerName email phone");

    res.status(200).json({
      message: "Rendered bookings fetched successfully",
      bookings: renderedBookings
    });
  } catch (error) {
    console.error("Error fetching rendered bookings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /api/supervisor/bookings/:id/supervisor-approve
router.put("/bookings/:id/supervisor-approve", async (req, res) => {
  try {
    // Update the serviceStatus to 'supervisor_approved'
    const booking = await ServiceBooking.findByIdAndUpdate(
      req.params.id,
      { serviceStatus: "supervisor_approved" },
      { new: true }
    ).populate("customer", "customerName phone email");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.status(200).json({
      message: "Service approved by supervisor successfully",
      booking
    });
  } catch (error) {
    console.error("Error approving service:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


// GET /api/technician gets assigned bookings
router.get("/technician/bookings", async (req, res) => {
  try {
    const bookings = await ServiceBooking.find({
      serviceStatus: "technician_assigned",
    }).populate("customer", "customerName email phone");

    res.status(200).json({
      message: "Bookings assigned to technicians fetched successfully",
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error("Error fetching technician bookings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// 5. Technician marks service as rendered
router.put("/bookings/:id/rendered", async (req, res) => {
  try {
    const booking = await ServiceBooking.findByIdAndUpdate(
      req.params.id,
      { serviceStatus: "rendered" },
      { new: true }
    ).populate("customer", "customerName email phone");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.status(200).json({
      message: "Service marked as rendered successfully",
      booking,
    });
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


module.exports = router;
