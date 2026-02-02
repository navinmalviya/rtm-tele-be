import express from "express";
import {
	createPortLink,
	deletePortLink,
	getAvailablePortsByStation,
	getLinkDetails,
	getStationLinks,
	updatePortLink,
} from "../controllers/port-link-controller";

const router = express.Router();

router.post("/", createPortLink);
router.get("/station/:stationId", getStationLinks);
router.get("/station/:stationId", getStationLinks);
router.delete("/:id", deletePortLink);
router.get("/:id", getLinkDetails);
router.patch("/:id", updatePortLink);
router.get("/station/:stationId/available-ports", getAvailablePortsByStation);

export default router;
