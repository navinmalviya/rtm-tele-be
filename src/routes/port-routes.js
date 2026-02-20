import Router from "express";
import { portController } from "../controllers/port-controller.js";
import { verifyToken } from "../middlewares/verifiyToken.js";
import { allowRoles } from "../middlewares/allowRoles.js";
import { ROLE_ACCESS } from "../lib/rbac.js";

const router = Router();

// --- Creation Routes ---

// Create a single port manually (e.g., adding a console port)
router.post(
	"/create",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	portController.createPort,
);

// Bulk create ports (e.g., generating 24 ports for a new Switch)
router.post(
	"/bulk-create",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	portController.bulkCreatePorts,
);

// --- Fetching Routes ---

// Get all ports for a specific Equipment (used for XYFlow internal handles)
// router.get("/equipment/:equipmentId", portController.getPortsByEquipment);

// Get only ports from Core Equipment for a specific station (for the linking popup)
router.get(
	"/station-core/:stationId",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	portController.getCorePortsByStation,
);

// --- Management Routes ---

// Update port config (IP Address, VLANs, Status, Name)
router.patch(
	"/update/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	portController.updatePort,
);

// Delete a port
router.delete(
	"/delete/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	portController.deletePort,
);

export default router;
