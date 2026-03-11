import { Router } from "express";
import { stationCableController } from "../controllers/station-cable-controller.js";
import { ROLE_ACCESS } from "../lib/rbac.js";
import { allowRoles } from "../middlewares/allowRoles.js";
import { verifyToken } from "../middlewares/verifiyToken.js";

const router = Router();

router.get(
	"/station/:stationId",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	stationCableController.getByStation,
);

router.post(
	"/create",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	stationCableController.create,
);

router.delete(
	"/delete/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	stationCableController.delete,
);

export default router;
