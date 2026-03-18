import Router from "express";
import {
	addWorkProgress,
	createDemandRound,
	createWorkExecution,
	createWorkItem,
	deleteWorkExecution,
	getWorkExecutionById,
	listDemandRounds,
	listWorkAllocations,
	listWorkDemands,
	listWorkExecutions,
	listWorkItems,
	listWorkProgress,
	listWorkScope,
	saveWorkScope,
	saveWorkAllocations,
	submitWorkDemands,
	updateDemandRound,
	updateWorkExecution,
	updateWorkItem,
} from "../controllers/work-execution-controller.js";
import { ROLE_ACCESS } from "../lib/rbac.js";
import { allowRoles } from "../middlewares/allowRoles.js";
import { verifyToken } from "../middlewares/verifiyToken.js";

const router = Router();

router.post(
	"/create",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	createWorkExecution,
);
router.get(
	"/all",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	listWorkExecutions,
);
router.get(
	"/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	getWorkExecutionById,
);
router.patch(
	"/update/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	updateWorkExecution,
);
router.delete(
	"/delete/:id",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	deleteWorkExecution,
);

router.post(
	"/:workId/items/create",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	createWorkItem,
);
router.get(
	"/:workId/items",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	listWorkItems,
);
router.patch(
	"/:workId/items/update/:itemId",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	updateWorkItem,
);

router.get(
	"/:workId/scope",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	listWorkScope,
);
router.post(
	"/:workId/scope/save",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	saveWorkScope,
);

router.post(
	"/:workId/rounds/create",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	createDemandRound,
);
router.get(
	"/:workId/rounds",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	listDemandRounds,
);
router.patch(
	"/:workId/rounds/update/:roundId",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	updateDemandRound,
);

router.post(
	"/:workId/demands/submit",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	submitWorkDemands,
);
router.get(
	"/:workId/demands",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	listWorkDemands,
);

router.post(
	"/:workId/allocations/save",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	saveWorkAllocations,
);
router.get(
	"/:workId/allocations",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	listWorkAllocations,
);

router.get(
	"/:workId/progress",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_READ),
	listWorkProgress,
);
router.post(
	"/:workId/progress/add",
	verifyToken,
	allowRoles(ROLE_ACCESS.ASSET_WRITE),
	addWorkProgress,
);

export default router;
