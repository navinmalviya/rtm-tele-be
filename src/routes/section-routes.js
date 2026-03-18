import Router from "express";
import {
	createSection,
	deleteSection,
	findAllSections,
	getSectionDetails,
} from "../controllers/section-controller.js";
import { allowRoles } from "../middlewares/allowRoles.js";
import { verifyToken } from "../middlewares/verifiyToken.js";
import { ROLE_ACCESS } from "../lib/rbac.js";

const router = Router();

router.post(
	"/create",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	createSection,
);
router.get(
	"/all",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	findAllSections,
);
router.get(
	"/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	getSectionDetails,
);
router.delete(
	"/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	deleteSection,
);

export default router;
