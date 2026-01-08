import Router from "express";
import { portController } from "../controllers/port-controller.js";

const router = Router();

// --- Creation Routes ---

// Create a single port manually (e.g., adding a console port)
router.post("/create", portController.createPort);

// Bulk create ports (e.g., generating 24 ports for a new Switch)
router.post("/bulk-create", portController.bulkCreatePorts);

// --- Fetching Routes ---

// Get all ports for a specific Equipment (used for XYFlow internal handles)
// router.get("/equipment/:equipmentId", portController.getPortsByEquipment);

// Get only ports from Core Equipment for a specific station (for the linking popup)
router.get("/station-core/:stationId", portController.getCorePortsByStation);

// --- Management Routes ---

// Update port config (IP Address, VLANs, Status, Name)
router.patch("/update/:id", portController.updatePort);

// Delete a port
router.delete("/delete/:id", portController.deletePort);

export default router;
