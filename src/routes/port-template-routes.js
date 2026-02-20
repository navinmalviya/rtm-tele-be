import Router from "express";
import {
	createPortTemplate,
	deletePortTemplate,
	findAllPortTemplates,
	updatePortTemplate,
} from "../controllers/port-template-controller.js";
import { verifyToken } from "../middlewares/verifiyToken.js";
import { allowRoles } from "../middlewares/allowRoles.js";
import { ROLE_ACCESS } from "../lib/rbac.js";

const router = Router();

// 1. CREATE a new port blueprint
router.post(
	"/create",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	createPortTemplate,
);

// 2. GET ALL port blueprints (for the "Port Templates" tab)
router.get(
	"/all",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	findAllPortTemplates,
);

// 3. UPDATE an existing blueprint
router.put(
	"/update/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	updatePortTemplate,
);

// 4. DELETE a blueprint
router.delete(
	"/delete/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	deletePortTemplate,
);

export default router;
