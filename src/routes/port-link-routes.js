import express from "express";
import {
	createPortLink,
	deletePortLink,
	getAllLinks,
	getAvailablePortsByStation,
	getLinkDetails,
	getStationLinks,
	updatePortLink,
} from "../controllers/port-link-controller";
import { verifyToken } from "../middlewares/verifiyToken";
import { allowRoles } from "../middlewares/allowRoles";
import { ROLE_ACCESS } from "../lib/rbac";

const router = express.Router();

router.post(
	"/",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	createPortLink,
);
router.get(
	"/station/:stationId",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	getStationLinks,
);
router.get(
	"/all",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	getAllLinks,
);
router.delete(
	"/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	deletePortLink,
);
router.get(
	"/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	getLinkDetails,
);
router.patch(
	"/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	updatePortLink,
);
router.get(
	"/station/:stationId/available-ports",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	getAvailablePortsByStation,
);

export default router;
