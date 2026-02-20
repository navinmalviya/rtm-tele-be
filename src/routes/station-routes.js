import Router from "express";
import {
	bulkUpdateStations,
	createStation,
	findAllStations,
	getStationInternalTopology,
	getStationSummary,
} from "../controllers/station-controller.js";
import { verifyToken } from "../middlewares/verifiyToken.js";
import { allowRoles } from "../middlewares/allowRoles.js";
import { ROLE_ACCESS } from "../lib/rbac.js";

const router = Router();

router.post(
	"/create",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	createStation,
);
router.get(
	"/all",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	findAllStations,
);
router.post(
	"/bulk-update",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	bulkUpdateStations,
);
router.get(
	"/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	getStationSummary,
);
router.get(
	"/topology/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	getStationInternalTopology,
);

export default router;
