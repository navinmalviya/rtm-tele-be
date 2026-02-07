import express from "express";
import {
	addTaskComment,
	createTask,
	getTasks,
	updateTaskStatus,
} from "../controllers/task-controller";
import { verifyToken } from "../middlewares/verifiyToken";

const router = express.Router();

/**
 * @route   POST /api/tasks
 * @desc    Create a new task (Failure, Maintenance, or TRC)
 * @access  Private
 */
router.post("/", verifyToken, createTask);

/**
 * @route   GET /api/tasks/all
 * @desc    Retrieve all tasks (supports ?projectId= and ?stationId= filters)
 * @access  Private
 */
router.get("/all", verifyToken, getTasks);

/**
 * @route   PATCH /api/tasks/:id/status
 * @desc    Update task status and trigger project progress recalculation
 * @access  Private
 */
router.patch("/:id/status", verifyToken, updateTaskStatus);

/**
 * @route   POST /api/tasks/:id/comments
 * @desc    Add a technical comment or site update to a task
 * @access  Private
 */
router.post("/:id/comments", verifyToken, addTaskComment);

export default router;
