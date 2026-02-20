import express from "express";
import {
	addTaskComment,
	addSseInchargeRemark,
	createTask,
	escalateOverdueFailures,
	getTaskById,
	getTasks,
	upsertFailureForTask,
	updateTaskStatus,
} from "../controllers/task-controller";
import { verifyToken } from "../middlewares/verifiyToken";
import { allowRoles } from "../middlewares/allowRoles";
import { ROLE_ACCESS } from "../lib/rbac";

const router = express.Router();

/**
 * @route   POST /api/tasks
 * @desc    Create a new task (Failure, Maintenance, or TRC)
 * @access  Private
 */
router.post(
	"/",
	verifyToken,
	allowRoles(ROLE_ACCESS.TASK_WRITE),
	createTask,
);

/**
 * @route   GET /api/tasks/all
 * @desc    Retrieve all tasks (supports ?projectId= and ?stationId= filters)
 * @access  Private
 */
router.get(
	"/all",
	verifyToken,
	allowRoles(ROLE_ACCESS.TASK_READ),
	getTasks,
);

/**
 * @route   GET /api/tasks/:id
 * @desc    Retrieve single task with specialized details
 * @access  Private
 */
router.get(
	"/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.TASK_READ),
	getTaskById,
);

/**
 * @route   PATCH /api/tasks/:id/status
 * @desc    Update task status and trigger project progress recalculation
 * @access  Private
 */
router.patch(
	"/:id/status",
	verifyToken,
	allowRoles(ROLE_ACCESS.TASK_WRITE),
	updateTaskStatus,
);

/**
 * @route   PATCH /api/tasks/:id/failure
 * @desc    Create or update failure details for a failure task
 * @access  Private
 */
router.patch(
	"/:id/failure",
	verifyToken,
	allowRoles(ROLE_ACCESS.TASK_WRITE),
	upsertFailureForTask,
);

/**
 * @route   POST /api/tasks/:id/comments
 * @desc    Add a technical comment or site update to a task
 * @access  Private
 */
router.post(
	"/:id/comments",
	verifyToken,
	allowRoles(ROLE_ACCESS.TASK_WRITE),
	addTaskComment,
);

/**
 * @route   PATCH /api/tasks/:id/sse-remark
 * @desc    Add SSE (Incharge) remark for closure
 * @access  Private
 */
router.patch(
	"/:id/sse-remark",
	verifyToken,
	allowRoles(ROLE_ACCESS.TASK_APPROVE),
	addSseInchargeRemark,
);

/**
 * @route   POST /api/tasks/escalate-overdue
 * @desc    Escalate overdue failure tickets (cron)
 * @access  Private
 */
router.post(
	"/escalate-overdue",
	verifyToken,
	allowRoles(ROLE_ACCESS.ESCALATION_RUN),
	escalateOverdueFailures,
);

export default router;
