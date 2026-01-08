import Router from "express";
import {
	createEquipment,
	deleteEquipment,
	findCoreEquipmentByStation, // New: For Inter-Station linking
	findEquipmentByStation,
	// getEquipmentPorts, // New: To list ports for linking
	updateEquipmentPosition, // New: For XYFlow drag-and-drop
} from "../controllers/equipment-controller.js";

const router = Router();

router.post("/create", createEquipment);
router.get("/station/:stationId", findEquipmentByStation);
router.get("/core/:stationId", findCoreEquipmentByStation);
// router.get("/:id/ports", getEquipmentPorts);

// XYFlow specific: Update mapX and mapY when dragging in the station view
router.patch("/update-position/:id", updateEquipmentPosition);

router.delete("/delete/:id", deleteEquipment);

export default router;
