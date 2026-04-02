import express from "express";
import {
	createDailyReportInput,
	deleteDailyReportInput,
	exportDailyReport,
	getDailyInputCoverage,
	getDailyReportDashboard,
	listDailyReportInputs,
	listDailyReportRuns,
	updateDailyReportInput,
} from "../controllers/daily-report-controller.js";
import { ROLE_ACCESS } from "../lib/rbac.js";
import { allowRoles } from "../middlewares/allowRoles.js";
import { verifyToken } from "../middlewares/verifiyToken.js";

const router = express.Router();

router.get(
	"/dashboard",
	verifyToken,
	allowRoles(ROLE_ACCESS.TASK_READ),
	getDailyReportDashboard,
);

router.get(
	"/inputs",
	verifyToken,
	allowRoles(ROLE_ACCESS.TASK_READ),
	listDailyReportInputs,
);

router.post(
	"/input",
	verifyToken,
	allowRoles(ROLE_ACCESS.TASK_WRITE),
	createDailyReportInput,
);

router.patch(
	"/input/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.TASK_WRITE),
	updateDailyReportInput,
);

router.delete(
	"/input/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.TASK_WRITE),
	deleteDailyReportInput,
);

router.get(
	"/coverage",
	verifyToken,
	allowRoles(["SUPER_ADMIN", "ADMIN", "TESTROOM"]),
	getDailyInputCoverage,
);

router.get(
	"/runs",
	verifyToken,
	allowRoles(["SUPER_ADMIN", "ADMIN", "TESTROOM"]),
	listDailyReportRuns,
);

router.get(
	"/export",
	verifyToken,
	allowRoles(ROLE_ACCESS.TASK_READ),
	exportDailyReport,
);

export default router;
