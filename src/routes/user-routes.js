import express from "express";
import { getAllUsers } from "../controllers/user-controller";
import { updateUser, deleteUser } from "../controllers/user-admin-controller.js";
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

router.patch(
	"/update/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.USER_MANAGE),
	updateUser,
);

router.delete(
	"/delete/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.USER_MANAGE),
	deleteUser,
);

export default router;
