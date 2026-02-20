import express from "express";
import { getAllUsers } from "../controllers/user-controller";
import { verifyToken } from "../middlewares/verifiyToken";
import { allowRoles } from "../middlewares/allowRoles";
import { ROLE_ACCESS } from "../lib/rbac";

const router = express.Router();

/**
 * @route   GET /api/user/all
 * @desc    Retrieve all users within the division for task assignment
 * @access  Private
 */
router.get(
	"/all",
	verifyToken,
	allowRoles(ROLE_ACCESS.USER_MANAGE),
	getAllUsers,
);

export default router;
