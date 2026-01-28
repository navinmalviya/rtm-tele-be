import Router from "express";
import {
	createSubSection,
	deleteSubSection,
	findAllSubSections,
	getSubSectionDetails,
	updateSubSection,
} from "../controllers/sub-section-controller.js";
import { verifyToken } from "../middlewares/verifiyToken.js";

const router = Router();

// Create a new link between two stations
router.post("/create", verifyToken, createSubSection);

// Get all sub-sections (filtered by user division)
router.get("/all", verifyToken, findAllSubSections);

// Get specific details of a sub-section (including links/fibers)
router.get("/:id", verifyToken, getSubSectionDetails);

// Update sub-section properties
router.put("/update/:id", verifyToken, updateSubSection);

// Remove a sub-section link
router.delete("/:id", verifyToken, deleteSubSection);

export default router;
