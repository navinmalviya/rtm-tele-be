import { Router } from "express";
import { cableController } from "../controllers/cable-controller.js";

const router = Router();

// --- Fetching Routes ---

// Get all cables belonging to a specific Subsection (Inventory View)
router.get("/subsection/:subsectionId", cableController.getCablesBySubsection);

// Get full history and details of a single cable (Deep Dive View)
router.get("/:id", cableController.getCableDetails);

// --- Management Routes ---

// Register a new cable into the system
router.post("/create", cableController.createCable);

// Update cable metadata (length, maintenance authority, etc.)
router.patch("/update/:id", cableController.updateCable);

// Remove a cable record from the inventory
router.delete("/delete/:id", cableController.deleteCable);

export default router;
