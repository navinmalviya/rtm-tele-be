import Router from "express";
import {
	createMaintenanceOccurrence,
	createMaintenanceSchedule,
	listMaintenanceSchedules,
	listOverdueMaintenance,
	markMaintenanceCompleted,
	runMaintenanceReminders,
	toggleMaintenanceScheduleStatus,
	updateMaintenanceSchedule,
} from "../controllers/maintenance-schedule-controller.js";
import { verifyToken } from "../middlewares/verifiyToken.js";
import { allowRoles } from "../middlewares/allowRoles.js";
import { ROLE_ACCESS } from "../lib/rbac.js";

const router = Router();

router.post(
	"/",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	createMaintenanceSchedule,
);
router.get(
	"/",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	listMaintenanceSchedules,
);
router.patch(
	"/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	updateMaintenanceSchedule,
);
router.patch(
	"/:id/toggle-status",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	toggleMaintenanceScheduleStatus,
);
router.post(
	"/:scheduleId/occurrences",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	createMaintenanceOccurrence,
);
router.patch(
	"/occurrences/:id/complete",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	markMaintenanceCompleted,
);
router.get(
	"/overdue",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	listOverdueMaintenance,
);
router.post(
	"/run-reminders",
	verifyToken,
	allowRoles(ROLE_ACCESS.ESCALATION_RUN),
	runMaintenanceReminders,
);

export default router;
