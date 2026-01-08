import Router from "express";
import {
	bulkUpdateStations,
	createStation,
	findAllStations,
	getStationInternalTopology,
	getStationSummary,
} from "../controllers/station-controller.js";

const router = Router();

router.post("/create", createStation);
router.get("/all", findAllStations);
router.post("/bulk-update", bulkUpdateStations);
router.get("/:id", getStationSummary);
router.get("/topology/:id", getStationInternalTopology);

export default router;
