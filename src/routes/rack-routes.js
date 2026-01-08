import Router from "express";
import {
	createRack,
	deleteRack,
	findRacksByLocation,
	findRacksByStation,
	updateRack,
} from "../controllers/rack-controller.js";

const router = Router();

router.post("/create", createRack);
router.get("/location/:locationId", findRacksByLocation);
router.get("/:stationId", findRacksByStation);
router.patch("/update/:id", updateRack);
router.delete("/delete/:id", deleteRack);

export default router;
