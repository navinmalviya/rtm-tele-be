import Router from "express";
import {
	approveStationCircuit,
	createDivisionCircuitMaster,
	createStationCircuit,
	deactivateDivisionCircuitMaster,
	listDivisionCircuitMasters,
	listStationCircuits,
	rejectStationCircuit,
	updateDivisionCircuitMaster,
} from "../controllers/circuit-controller.js";
import { ROLE_ACCESS } from "../lib/rbac.js";
import { allowRoles } from "../middlewares/allowRoles.js";
import { verifyToken } from "../middlewares/verifiyToken.js";

const router = Router();

router.get(
	"/masters",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	listDivisionCircuitMasters,
);
router.post(
	"/masters",
	verifyToken,
	allowRoles(ROLE_ACCESS.USER_MANAGE),
	createDivisionCircuitMaster,
);
router.patch(
	"/masters/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.USER_MANAGE),
	updateDivisionCircuitMaster,
);
router.delete(
	"/masters/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.USER_MANAGE),
	deactivateDivisionCircuitMaster,
);

router.get(
	"/station",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	listStationCircuits,
);
router.post(
	"/station",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	createStationCircuit,
);
router.patch(
	"/station/:id/approve",
	verifyToken,
	allowRoles(ROLE_ACCESS.USER_MANAGE),
	approveStationCircuit,
);
router.patch(
	"/station/:id/reject",
	verifyToken,
	allowRoles(ROLE_ACCESS.USER_MANAGE),
	rejectStationCircuit,
);

export default router;
