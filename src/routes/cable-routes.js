import { Router } from "express";
import { cableController } from "../controllers/cable-controller.js";
import { verifyToken } from "../middlewares/verifiyToken.js";
import { allowRoles } from "../middlewares/allowRoles.js";
import { ROLE_ACCESS } from "../lib/rbac.js";

const router = Router();

// --- Fetching Routes ---

// Get all cables belonging to a specific Subsection (Inventory View)
router.get(
	"/subsection/:subsectionId",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	cableController.getCablesBySubsection,
);

// Get full history and details of a single cable (Deep Dive View)
router.get(
	"/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	cableController.getCableDetails,
);

// --- Management Routes ---

// Register a new cable into the system
router.post(
	"/create",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	cableController.createCable,
);

// Add EC socket to a cable
router.post(
	"/:id/ec-socket",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	cableController.createEcSocket,
);

// Add cable joint / EC joint
router.post(
	"/:id/joint",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	cableController.createJoint,
);

// Add cable cut entry
router.post(
	"/:id/cut",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	cableController.createCableCut,
);

// Add cable test report (scheduled / failure testing)
router.post(
	"/:id/test-report",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	cableController.createCableTestReport,
);

// Connect a pair/fiber to an equipment via a new circuit
router.post(
	"/connect-media",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	cableController.connectMediaToEquipment,
);

// Map pair/fiber with an approved station circuit
router.post(
	"/connect-station-circuit",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	cableController.connectMediaToStationCircuit,
);

// Update cable metadata (length, maintenance authority, etc.)
router.patch(
	"/update/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	cableController.updateCable,
);

// Remove a cable record from the inventory
router.delete(
	"/delete/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	cableController.deleteCable,
);

export default router;
