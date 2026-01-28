import Router from "express";
import {
	createEquipmentTemplate,
	deleteEquipmentTemplate,
	findAllEquipmentTemplates,
	getEquipmentTemplateDetails,
	updateEquipmentTemplate,
} from "../controllers/equipment-template-controller.js";
import { verifyToken } from "../middlewares/verifiyToken.js";

const router = Router();

// 1. CREATE - Add a new hardware blueprint to the library
router.post("/create", verifyToken, createEquipmentTemplate);

// 2. READ ALL - Get list of templates with optional category/search filters
router.get("/all", verifyToken, findAllEquipmentTemplates);

// 3. READ SINGLE - Get full details of a specific model (including port blueprint)
router.get("/:id", verifyToken, getEquipmentTemplateDetails);

// 4. UPDATE - Modify existing template specs
router.patch("/update/:id", verifyToken, updateEquipmentTemplate);

// 5. DELETE - Remove a template from the library
router.delete("/delete/:id", verifyToken, deleteEquipmentTemplate);

export default router;
