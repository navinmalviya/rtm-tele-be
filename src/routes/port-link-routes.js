import express from "express";
import {
	createPortLink,
	deletePortLink,
	getStationLinks,
} from "../controllers/port-link-controller";

const router = express.Router();

router.post("/", createPortLink);
router.get("/station/:stationId", getStationLinks);
router.delete("/:id", deletePortLink);

export default router;
