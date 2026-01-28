import Router from "express";
import {
	createPortTemplate,
	deletePortTemplate,
	findAllPortTemplates,
	updatePortTemplate,
} from "../controllers/port-template-controller.js";
import { verifyToken } from "../middlewares/verifiyToken.js";

const router = Router();

// 1. CREATE a new port blueprint
router.post("/create", verifyToken, createPortTemplate);

// 2. GET ALL port blueprints (for the "Port Templates" tab)
router.get("/all", verifyToken, findAllPortTemplates);

// 3. UPDATE an existing blueprint
router.put("/update/:id", verifyToken, updatePortTemplate);

// 4. DELETE a blueprint
router.delete("/delete/:id", verifyToken, deletePortTemplate);

export default router;
