import prisma from "../lib/prisma";

// 1. CREATE Equipment Template
const createEquipmentTemplate = async (req, res) => {
	const {
		make,
		modelName,
		category,
		subCategory,
		uHeight,
		codalLifeYears,
		isModular,
		supply,
		layer,
		isPoe,
		switchingCapacity,
		isMPLSEnables,
		capacityKva,
		operatingMode,
		batteryType,
		defaultCellCount,
		capacityAh,
		nominalCellVolt,
		isSMRBased,
		// NEW: Expecting an array of objects: [{ portTemplateId: 'uuid', quantity: 24 }]
		portConfigs,
	} = req.body;

	try {
		const equipmentTemplate = await prisma.equipmentTemplate.create({
			data: {
				make,
				modelName,
				category,
				subCategory,
				supply,
				uHeight: Number.parseInt(uHeight || 1),
				codalLifeYears: Number.parseInt(codalLifeYears || 12),
				isModular: isModular === true || isModular === "true",

				// Networking Specifics
				layer: layer ? Number.parseInt(layer) : null,
				isPoe: isPoe === true || isPoe === "true",
				switchingCapacity: switchingCapacity
					? Number.parseFloat(switchingCapacity)
					: null,
				isMPLSEnables: isMPLSEnables === true || isMPLSEnables === "true",

				// UPS Specifics
				capacityKva: capacityKva ? Number.parseFloat(capacityKva) : null,
				operatingMode: operatingMode || null,

				// Battery Specifics
				batteryType: batteryType || null,
				defaultCellCount: defaultCellCount
					? Number.parseInt(defaultCellCount)
					: 1,
				capacityAh: capacityAh ? Number.parseFloat(capacityAh) : null,
				nominalCellVolt: nominalCellVolt
					? Number.parseFloat(nominalCellVolt)
					: 2.0,

				// Charger Specifics
				isSMRBased: isSMRBased === true || isSMRBased === "true",

				// NEW: Explicit Join Table Connection
				portConfigs: {
					create:
						portConfigs?.map((cfg) => ({
							quantity: Number.parseInt(cfg.quantity || 1),
							portTemplateId: cfg.portTemplateId,
						})) || [],
				},
			},
			include: {
				portConfigs: {
					include: { portTemplate: true },
				},
			},
		});

		res.status(201).json({
			message: "Equipment Template created successfully!",
			equipmentTemplate,
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 2. GET ALL Equipment Templates
const findAllEquipmentTemplates = async (req, res) => {
	try {
		const templates = await prisma.equipmentTemplate.findMany({
			include: {
				// Include the bridge and the actual port data
				portConfigs: {
					include: { portTemplate: true },
				},
				_count: {
					select: { instances: true },
				},
			},
			orderBy: { createdAt: "desc" },
		});
		res.status(200).json(templates);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 3. UPDATE Equipment Template
const updateEquipmentTemplate = async (req, res) => {
	const { id } = req.params;
	const { portConfigs, ...updateData } = req.body;

	try {
		const updatedTemplate = await prisma.equipmentTemplate.update({
			where: { id },
			data: {
				...updateData,
				uHeight: updateData.uHeight
					? Number.parseInt(updateData.uHeight)
					: undefined,
				codalLifeYears: updateData.codalLifeYears
					? Number.parseInt(updateData.codalLifeYears)
					: undefined,
				isModular:
					updateData.isModular !== undefined
						? updateData.isModular === true || updateData.isModular === "true"
						: undefined,
				isPoe:
					updateData.isPoe !== undefined
						? updateData.isPoe === true || updateData.isPoe === "true"
						: undefined,
				isMPLSEnables:
					updateData.isMPLSEnables !== undefined
						? updateData.isMPLSEnables === true ||
							updateData.isMPLSEnables === "true"
						: undefined,
				isSMRBased:
					updateData.isSMRBased !== undefined
						? updateData.isSMRBased === true || updateData.isSMRBased === "true"
						: undefined,

				// NEW: Handle Join Table Refresh
				// We delete all existing configs for this template and create new ones
				portConfigs: portConfigs
					? {
							deleteMany: {},
							create: portConfigs.map((cfg) => ({
								quantity: Number.parseInt(cfg.quantity),
								portTemplateId: cfg.portTemplateId,
							})),
						}
					: undefined,
			},
			include: {
				portConfigs: {
					include: { portTemplate: true },
				},
			},
		});

		res.status(200).json({ message: "Template updated!", updatedTemplate });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 4. DELETE Equipment Template
const deleteEquipmentTemplate = async (req, res) => {
	const { id } = req.params;

	try {
		const template = await prisma.equipmentTemplate.findUnique({
			where: { id },
			include: { _count: { select: { instances: true } } },
		});

		if (!template)
			return res.status(404).json({ message: "Template not found" });

		if (template._count.instances > 0) {
			return res.status(400).json({
				message: `Cannot delete. Template is currently used by ${template._count.instances} live devices.`,
			});
		}

		// Note: Because of 'onDelete: Cascade' in Prisma schema,
		// portConfigs rows will be automatically deleted.
		await prisma.equipmentTemplate.delete({ where: { id } });
		res.status(200).json({ message: "Template deleted successfully!" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 5. GET SINGLE Template Details
const getEquipmentTemplateDetails = async (req, res) => {
	const { id } = req.params;
	try {
		const template = await prisma.equipmentTemplate.findUnique({
			where: { id },
			include: {
				portConfigs: {
					include: { portTemplate: true },
				},
			},
		});

		if (!template) return res.status(404).json({ error: "Template not found" });
		res.status(200).json(template);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export {
	createEquipmentTemplate,
	findAllEquipmentTemplates,
	updateEquipmentTemplate,
	deleteEquipmentTemplate,
	getEquipmentTemplateDetails,
};
