import Router from "express";
import { create } from "../controllers/deviceType.js";

const router = Router();

router.post("/create", create);

export default router;
