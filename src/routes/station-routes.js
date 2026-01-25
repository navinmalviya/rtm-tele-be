import Router from "express";
import {
	bulkUpdateStations,
	createStation,
	findAllStations,
	getStationInternalTopology,
	getStationSummary,
} from "../controllers/station-controller.js";
import { verifyToken } from "../middlewares/verifiyToken.js";

const router = Router();

router.post("/create", verifyToken, createStation);
router.get("/all", verifyToken, findAllStations);
router.post("/bulk-update", verifyToken, bulkUpdateStations);
router.get("/:id", verifyToken, getStationSummary);
router.get("/topology/:id", verifyToken, getStationInternalTopology);

export default router;
