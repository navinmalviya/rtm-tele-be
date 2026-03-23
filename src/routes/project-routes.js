import express from "express";
import {
	createProject,
	deleteProject,
	getProjectDetails,
	getProjects,
	syncProjectProgress,
	updateProject,
} from "../controllers/project-controller.js";
import { verifyToken } from "../middlewares/verifiyToken.js";
import { allowRoles } from "../middlewares/allowRoles.js";
import { ROLE_ACCESS } from "../lib/rbac.js";

const router = express.Router();

// Base project management
router.post(
	"/",
	verifyToken,
	allowRoles(ROLE_ACCESS.TASK_WRITE),
	createProject,
);
router.get(
	"/all",
	verifyToken,
	allowRoles(ROLE_ACCESS.TASK_READ),
	getProjects,
);
router.get(
	"/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.TASK_READ),
	getProjectDetails,
);
router.patch(
	"/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.TASK_WRITE),
	updateProject,
);
router.delete(
	"/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.TASK_WRITE),
	deleteProject,
);

// Utility: Manually sync progress if needed
router.post(
	"/:id/sync-progress",
	verifyToken,
	allowRoles(ROLE_ACCESS.TASK_WRITE),
	syncProjectProgress,
);

export default router;
