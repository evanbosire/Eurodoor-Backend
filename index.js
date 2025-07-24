const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();
const path = require("path");

const customerRoutes = require("./routes/customerRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const adminRoutes = require("./routes/adminRoutes");

const inventoryRoutes = require("./routes/inventory");
const customerProcessRoutes = require("./routes/customer"); // process-related customer actions (not same as customer auth)
const financeRoutes = require("./routes/finance");
const dispatchRoutes = require("./routes/dispatch");
const driverRoutes = require("./routes/driver");

const productionRoutes = require("./routes/productionRoutes");
const reportRoutes = require("./routes/reportRoutes");
const downloadReportRoutes = require("./routes/downloadReportRoutes");

const app = express();
const port = process.env.PORT || 5000;

// ✅ Connect to MongoDB using environment variable
const uri = process.env.MONGO_URL;
mongoose
  .connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ✅ Middleware
app.use(cors());
app.use(bodyParser.json());

// ✅ Root route
app.get("/", (req, res) => {
  res.send("Welcome to the Corrugated Sheets Ltd API 🚀");
});

// ✅ Authentication + Registration Routes
app.use("/api/customers", customerRoutes); // Customer signup/login
app.use("/api", employeeRoutes);           // Employee signup/login
app.use("/api/admin", adminRoutes);        // Admin auth

// ✅ System Process Routes (Order Workflow)
app.use("/api/inventory", inventoryRoutes);        // Inventory Manager actions
app.use("/api/customer", customerProcessRoutes);   // Product browsing, orders, feedback
app.use("/api/finance", financeRoutes);            // Finance Manager payment approvals
app.use("/api/dispatch", dispatchRoutes);          // Dispatch Manager duties
app.use("/api/driver", driverRoutes);              // Driver deliveries

app.use("/api/production", productionRoutes);      //production routes 

app.use("/api/reports", reportRoutes);  // reports routes
app.use("/api/reports", downloadReportRoutes);


app.use("/receipts", express.static(path.join(__dirname, "public/receipts")));


// ✅ Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
