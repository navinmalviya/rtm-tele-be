import express from "express";
import {
	createProject,
	getProjectDetails,
	getProjects,
	syncProjectProgress,
	updateProject,
} from "../controllers/project-controller";
import { verifyToken } from "../middlewares/verifiyToken";

const router = express.Router();

// Base project management
router.post("/", verifyToken, createProject);
router.get("/all", verifyToken, getProjects);
router.get("/:id", verifyToken, getProjectDetails);
router.patch("/:id", verifyToken, updateProject);

// Utility: Manually sync progress if needed
router.post("/:id/sync-progress", syncProjectProgress);

export default router;
