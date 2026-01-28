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
		capacityKva,
		operatingMode,
		chemistry,
		defaultCellCount,
		capacityAh,
		nominalCellVolt,
		portTemplateIds, // Array of UUIDs
	} = req.body;

	try {
		const equipmentTemplate = await prisma.equipmentTemplate.create({
			data: {
				make,
				modelName,
				category,
				subCategory,
				supply,
				uHeight: parseInt(uHeight || 1),
				codalLifeYears: parseInt(codalLifeYears || 12),
				isModular: isModular === true || isModular === "true",

				// Networking Specifics
				layer: layer ? parseInt(layer) : null,
				isPoe: isPoe === true || isPoe === "true",
				switchingCapacity: switchingCapacity
					? parseFloat(switchingCapacity)
					: null,

				// UPS Specifics
				capacityKva: capacityKva ? parseFloat(capacityKva) : null,
				operatingMode: operatingMode || null,

				// Battery Specifics
				chemistry: chemistry || null,
				defaultCellCount: defaultCellCount ? parseInt(defaultCellCount) : 1,
				capacityAh: capacityAh ? parseFloat(capacityAh) : null,
				nominalCellVolt: nominalCellVolt ? parseFloat(nominalCellVolt) : 2.0,

				// Many-to-Many Connection
				portTemplates: {
					connect: portTemplateIds?.map((id) => ({ id })) || [],
				},
			},
			include: {
				portTemplates: true,
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
				portTemplates: true,
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
	const { portTemplateIds, ...updateData } = req.body;

	try {
		const updatedTemplate = await prisma.equipmentTemplate.update({
			where: { id },
			data: {
				...updateData,
				// Ensure proper typing for updates
				uHeight: updateData.uHeight ? parseInt(updateData.uHeight) : undefined,
				codalLifeYears: updateData.codalLifeYears
					? parseInt(updateData.codalLifeYears)
					: undefined,
				isModular:
					updateData.isModular !== undefined
						? updateData.isModular === true || updateData.isModular === "true"
						: undefined,

				// Handle Many-to-Many Port Refresh
				portTemplates: portTemplateIds
					? {
							set: [], // Clear old relationships
							connect: portTemplateIds.map((pid) => ({ id: pid })),
						}
					: undefined,
			},
			include: {
				portTemplates: true,
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

		await prisma.equipmentTemplate.delete({ where: { id } });
		res.status(200).json({ message: "Template deleted successfully!" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 5. GET SINGLE Template
const getEquipmentTemplateDetails = async (req, res) => {
	const { id } = req.params;
	try {
		const template = await prisma.equipmentTemplate.findUnique({
			where: { id },
			include: { portTemplates: true },
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
