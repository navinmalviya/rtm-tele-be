import Router from "express";
import {
	createLocation,
	deleteLocation,
	// findLocationsByStation,
	findStationLocations,
	getLocationDetails,
	updateLocation,
} from "../controllers/location-controller.js";

const router = Router();

// Create a new location (OFC Hut, SM Room, etc.)
router.post("/create", createLocation);

// Fetch all locations for a specific station (e.g., /all/station-uuid)
router.get("/all/:stationId", findStationLocations);

// Fetch a single location with its racks and equipment for the internal view
router.get("/details/:id", getLocationDetails);

// Update and Delete
router.patch("/update/:id", updateLocation);
router.delete("/delete/:id", deleteLocation);

export default router;
