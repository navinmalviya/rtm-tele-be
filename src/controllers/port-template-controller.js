import prisma from "../lib/prisma";

// 1. CREATE Port Template
const createPortTemplate = async (req, res) => {
	const { name, category, type, speed, voltage, isSFPInserted, sfpType } =
		req.body;

	try {
		const portTemplate = await prisma.portTemplate.create({
			data: {
				name,
				category, // Enum: NETWORK | POWER
				type, // String: RJ45, SFP_SLOT, etc.
				// Logic: If it's Power, speed should always be null.
				// If it's Network, voltage should always be null.
				speed: category === "NETWORK" ? speed : null,
				voltage: category === "POWER" ? voltage : null,
				isSFPInserted: category === "NETWORK" ? !!isSFPInserted : false,
				sfpType:
					category === "NETWORK" && type === "SFP_SLOT"
						? sfpType
						: "NOT_APPLICABLE",
			},
		});
		res.status(201).json({ message: "Port Blueprint created!", portTemplate });
	} catch (error) {
		// This will now work because 'category' is recognized after generate
		res.status(500).json({ error: error.message });
	}
};

// 2. GET ALL Port Templates
const findAllPortTemplates = async (req, res) => {
	const { category } = req.query;

	try {
		const portTemplates = await prisma.portTemplate.findMany({
			where: category ? { category } : {},
			include: {
				_count: {
					select: { equipmentTemplates: true },
				},
			},
			orderBy: [{ category: "asc" }, { name: "asc" }],
		});
		res.status(200).json(portTemplates);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 3. UPDATE Port Template
const updatePortTemplate = async (req, res) => {
	const { id } = req.params;
	const data = req.body;

	try {
		// Prevent accidental data corruption if switching categories
		const updateData = { ...data };
		if (data.category === "POWER") {
			updateData.speed = null;
			updateData.isSFPInserted = false;
		} else if (data.category === "NETWORK") {
			updateData.voltage = null;
		}

		const updatedPortTemplate = await prisma.portTemplate.update({
			where: { id },
			data: {
				...updateData,
				isSFPInserted:
					data.isSFPInserted !== undefined ? !!data.isSFPInserted : undefined,
			},
		});
		res
			.status(200)
			.json({ message: "Blueprint updated!", updatedPortTemplate });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 4. DELETE Port Template (Usage Check)
const deletePortTemplate = async (req, res) => {
	const { id } = req.params;
	try {
		const usageCount = await prisma.equipmentTemplate.count({
			where: { portTemplates: { some: { id } } },
		});

		if (usageCount > 0) {
			return res.status(400).json({
				message: `Denied: This blueprint is linked to ${usageCount} hardware models.`,
			});
		}

		await prisma.portTemplate.delete({ where: { id } });
		res.status(200).json({ message: "Blueprint removed." });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export {
	createPortTemplate,
	findAllPortTemplates,
	updatePortTemplate,
	deletePortTemplate,
};
