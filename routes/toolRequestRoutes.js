// --- ROUTES ---

const express = require("express");
const router = express.Router();
const Tool = require("../models/Tool");
const ToolRequest = require("../models/ToolRequest");
const Employee = require("../models/Employee");

// 1. POST: Inventory Manager adds tools to the store
router.post("/tools", async (req, res) => {
  try {
    const { name, unit, quantityAvailable } = req.body;
    const tool = await Tool.create({ name, unit, quantityAvailable });
    res.status(201).json(tool);
  } catch (error) {
    res.status(500).json({ message: "Failed to add tool", error });
  }
});

// 2. GET: Inventory Manager views all tools in the store
router.get("/tools", async (req, res) => {
  try {
    const tools = await Tool.find();
    res.json(tools);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch tools", error });
  }
});



// 4. Inventory Manager views all tool requests
router.get("/tool-requests", async (req, res) => {
  try {
    const requests = await ToolRequest.find().populate("tools.toolId");

    // Manually format each request with tool details
    const formattedRequests = requests.map((request) => ({
      _id: request._id,
      technicianEmail: request.technicianEmail,
      status: request.status,
      requestDate: request.requestDate,
      tools: request.tools.map((tool) => ({
        toolId: tool.toolId?._id,
        name: tool.toolId?.name,
        unit: tool.toolId?.unit,
        quantityRequested: tool.quantityRequested,
        quantityApproved: tool.quantityApproved,
        quantityReturned: tool.quantityReturned,
        returnStatus: tool.returnStatus
      }))
    }));

    res.json(formattedRequests);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch requests", error });
  }
});


// 5. Inventory Manager approves tool requests
router.put("/tool-requests/:id/approve", async (req, res) => {
  try {
    const requestId = req.params.id;
    const { tools } = req.body; // each tool includes quantityApproved

    const request = await ToolRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    for (const approvedTool of tools) {
      const toolInStore = await Tool.findById(approvedTool.toolId);
      const toolInRequest = request.tools.find(t => t.toolId.toString() === approvedTool.toolId);

      if (toolInStore.quantityAvailable < approvedTool.quantityApproved) {
        return res.status(400).json({ message: `Not enough ${toolInStore.name} in inventory` });
      }

      toolInRequest.quantityApproved = approvedTool.quantityApproved;
      toolInStore.quantityAvailable -= approvedTool.quantityApproved;
      await toolInStore.save();
    }

    request.status = "Approved";
    await request.save();

    res.json({ message: "Request approved", request });
  } catch (error) {
    res.status(500).json({ message: "Failed to approve request", error });
  }
});

// 3. Technician requests tools from inventory
router.post("/tool-requests", async (req, res) => {
  try {
    const { email, tools } = req.body;
    const technician = await Employee.findOne({ email, role: "Technician", status: "active" });
    if (!technician) return res.status(404).json({ message: "Technician not found or inactive" });

    const request = await ToolRequest.create({ technicianEmail: email, tools });
    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ message: "Failed to request tools", error });
  }
});


// 6. Technician gets their approved tool requests
router.get("/tool-requests/approved/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const technician = await Employee.findOne({ email, role: "Technician", status: "active" });
    if (!technician) {
      return res.status(404).json({ message: "Technician not found or inactive" });
    }

    const approvedRequests = await ToolRequest.find({
      technicianEmail: email,
      status: "Approved"
    }).populate("tools.toolId", "name");

    res.json({ approvedRequests });
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve approved requests", error });
  }
});

// Technician returns tools
router.put("/tool-requests/:id/return", async (req, res) => {
  try {
    const requestId = req.params.id;
    const { tools } = req.body;

    // Validate input
    if (!tools || !Array.isArray(tools)) {
      return res.status(400).json({ message: "Invalid tools data format" });
    }

    const request = await ToolRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    let allReturned = true;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      for (const returnedTool of tools) {
        // Convert toolId to string for comparison
        const toolIdString = returnedTool.toolId.toString();
        
        // Find the tool in the request
        const toolInRequest = request.tools.find(t => 
          t.toolId.toString() === toolIdString
        );
        
        if (!toolInRequest) {
          throw new Error(`Tool with ID ${toolIdString} not found in request`);
        }

        // Initialize quantityReturned if undefined
        if (typeof toolInRequest.quantityReturned !== 'number') {
          toolInRequest.quantityReturned = 0;
        }

        // Update inventory
        const toolInStore = await Tool.findById(toolIdString).session(session);
        if (!toolInStore) {
          throw new Error(`Tool with ID ${toolIdString} not found in inventory`);
        }

        toolInStore.quantityAvailable += returnedTool.quantityReturned;
        await toolInStore.save();

        // Update request
        toolInRequest.quantityReturned += returnedTool.quantityReturned;
        
        // Update return status
        if (toolInRequest.quantityReturned < toolInRequest.quantityApproved) {
          toolInRequest.returnStatus = "Partially Returned";
          allReturned = false;
        } else {
          toolInRequest.returnStatus = "Fully Returned";
        }
      }

      // Update overall request status if all returned
      if (allReturned) {
        request.status = "Returned";
      }

      await request.save({ session });
      await session.commitTransaction();
      res.json({ 
        message: "Tools returned successfully", 
        request 
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("Return error:", error);
    res.status(400).json({ 
      message: error.message || "Failed to return tools"
    });
  }
});


module.exports = router;