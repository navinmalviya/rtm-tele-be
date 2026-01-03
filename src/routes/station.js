import Router from "express";
import {
	bulkUpdateStations,
	createStation,
	findAllStations,
} from "../controllers/stations.js";

const router = Router();

router.post("/create", createStation);
router.get("/all", findAllStations);
router.post("/bulk-update", bulkUpdateStations);

export default router;
