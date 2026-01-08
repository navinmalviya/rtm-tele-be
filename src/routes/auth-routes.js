import Router from "express";
import { create, signin } from "../controllers/auth-controller.js";

const router = Router();

router.post("/sign-up", create);
router.post("/login", signin);

export default router;
