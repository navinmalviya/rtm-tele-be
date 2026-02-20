import Router from "express";
import {
	createRack,
	deleteRack,
	findRacksByLocation,
	findRacksByStation,
	updateRack,
} from "../controllers/rack-controller.js";
import { verifyToken } from "../middlewares/verifiyToken.js";
import { allowRoles } from "../middlewares/allowRoles.js";
import { ROLE_ACCESS } from "../lib/rbac.js";

const router = Router();

router.post(
	"/create",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	createRack,
);
router.get(
	"/location/:locationId",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	findRacksByLocation,
);
router.get(
	"/:stationId",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	findRacksByStation,
);
router.patch(
	"/update/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	updateRack,
);
router.delete(
	"/delete/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	deleteRack,
);

export default router;
