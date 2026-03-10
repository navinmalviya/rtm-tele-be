import Router from "express";
import {
	createTnpItem,
	deleteTnpItem,
	listTnpItems,
	updateTnpItem,
} from "../controllers/tnp-controller.js";
import { verifyToken } from "../middlewares/verifiyToken.js";
import { allowRoles } from "../middlewares/allowRoles.js";
import { ROLE_ACCESS } from "../lib/rbac.js";

const router = Router();

router.get("/all", verifyToken, allowRoles(ROLE_ACCESS.ASSET_READ), listTnpItems);
router.post("/create", verifyToken, allowRoles(ROLE_ACCESS.ASSET_WRITE), createTnpItem);
router.patch("/update/:id", verifyToken, allowRoles(ROLE_ACCESS.ASSET_WRITE), updateTnpItem);
router.delete("/delete/:id", verifyToken, allowRoles(ROLE_ACCESS.ASSET_WRITE), deleteTnpItem);

export default router;
