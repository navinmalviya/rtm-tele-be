import express from "express";
import { getAllUsers } from "../controllers/user-controller";
import { verifyToken } from "../middlewares/verifiyToken";

const router = express.Router();

/**
 * @route   GET /api/user/all
 * @desc    Retrieve all users within the division for task assignment
 * @access  Private
 */
router.get("/all", verifyToken, getAllUsers);

export default router;
