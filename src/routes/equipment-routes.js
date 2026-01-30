import Router from "express";
import {
	bulkUpdateEquipment, // New: For efficient XYFlow saving and batch edits
	createEquipment,
	deleteEquipment,
	findEquipmentByStation,
	updateEquipment, // Renamed from updateEquipmentPosition for universal use
} from "../controllers/equipment-controller.js";
import { verifyToken } from "../middlewares/verifiyToken.js";

const router = Router();

// 1. Core Asset Management
router.post("/create", verifyToken, createEquipment);
router.get("/station/:stationId", verifyToken, findEquipmentByStation);

// 2. Universal Updates
// This now handles XYFlow (mapX, mapY), status, description, and metadata
router.patch("/update/:id", verifyToken, updateEquipment);

// 3. Bulk Operations
// Optimized for saving multiple XYFlow positions or batch status changes
router.patch("/bulk-update", verifyToken, bulkUpdateEquipment);

// 4. Deletion
router.delete("/delete/:id", verifyToken, deleteEquipment);

export default router;
