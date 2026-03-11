import Router from "express";
import {
	createMaintenanceOccurrence,
	createMaintenanceSchedule,
	getOccurrenceInspectionForm,
	listMaintenanceSchedules,
	listOverdueMaintenance,
	markMaintenanceCompleted,
	myMaintenanceSummary,
	runMaintenanceReminders,
	toggleMaintenanceScheduleStatus,
	updateMaintenanceSchedule,
} from "../controllers/maintenance-schedule-controller.js";
import { ROLE_ACCESS } from "../lib/rbac.js";
import { allowRoles } from "../middlewares/allowRoles.js";
import { verifyToken } from "../middlewares/verifiyToken.js";

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
router.get(
	"/my-summary",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	myMaintenanceSummary,
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
	"/occurrences/:id/inspection-form",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	getOccurrenceInspectionForm,
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
