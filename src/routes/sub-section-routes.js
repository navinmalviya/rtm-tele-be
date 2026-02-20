import Router from "express";
import {
	createSubSection,
	deleteSubSection,
	findAllSubSections,
	getSubSectionDetails,
	updateSubSection,
} from "../controllers/sub-section-controller.js";
import { verifyToken } from "../middlewares/verifiyToken.js";
import { allowRoles } from "../middlewares/allowRoles.js";
import { ROLE_ACCESS } from "../lib/rbac.js";

const router = Router();

// Create a new link between two stations
router.post(
	"/create",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	createSubSection,
);

// Get all sub-sections (filtered by user division)
router.get(
	"/all",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	findAllSubSections,
);

// Get specific details of a sub-section (including links/fibers)
router.get(
	"/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	getSubSectionDetails,
);

// Update sub-section properties
router.put(
	"/update/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	updateSubSection,
);

// Remove a sub-section link
router.delete(
	"/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	deleteSubSection,
);

export default router;
