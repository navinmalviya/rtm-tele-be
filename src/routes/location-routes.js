import Router from "express";
import {
	createLocation,
	deleteLocation,
	// findLocationsByStation,
	findStationLocations,
	getLocationDetails,
	updateLocation,
} from "../controllers/location-controller.js";
import { verifyToken } from "../middlewares/verifiyToken.js";
import { allowRoles } from "../middlewares/allowRoles.js";
import { ROLE_ACCESS } from "../lib/rbac.js";

const router = Router();

// Create a new location (OFC Hut, SM Room, etc.)
router.post(
	"/create",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	createLocation,
);

// Fetch all locations for a specific station (e.g., /all/station-uuid)
router.get(
	"/all/:stationId",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	findStationLocations,
);

// Fetch a single location with its racks and equipment for the internal view
router.get(
	"/details/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	getLocationDetails,
);

// Update and Delete
router.patch(
	"/update/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	updateLocation,
);
router.delete(
	"/delete/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	deleteLocation,
);

export default router;
