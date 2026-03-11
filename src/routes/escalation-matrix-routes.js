import Router from "express";
import {
	createEscalationMatrix,
	deleteEscalationMatrix,
	listEscalationMatrix,
	updateEscalationMatrix,
} from "../controllers/escalation-matrix-controller.js";
import { ROLE_ACCESS } from "../lib/rbac.js";
import { allowRoles } from "../middlewares/allowRoles.js";
import { verifyToken } from "../middlewares/verifiyToken.js";

const router = Router();

router.get(
	"/all",
	verifyToken,
	allowRoles(ROLE_ACCESS.USER_MANAGE),
	listEscalationMatrix,
);

router.post(
	"/create",
	verifyToken,
	allowRoles(ROLE_ACCESS.USER_MANAGE),
	createEscalationMatrix,
);

router.patch(
	"/update/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.USER_MANAGE),
	updateEscalationMatrix,
);

router.delete(
	"/delete/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.USER_MANAGE),
	deleteEscalationMatrix,
);

export default router;
