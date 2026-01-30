import prisma from "../lib/prisma.js";

/**
 * 1. CREATE EQUIPMENT
 * Logic: Spawns an equipment instance and automatically generates
 * physical Ports based on the EquipmentTemplate's PortConfigs.
 */
export const createEquipment = async (req, res) => {
	try {
		const {
			name,
			description,
			providedBy,
			serialNumber,
			templateId,
			stationId,
			rackId,
			uPosition,
			installationDate,
		} = req.body;

		const userId = req.user.id;

		// 1. Fetch Template FIRST to verify it exists and has port configs
		const template = await prisma.equipmentTemplate.findUnique({
			where: { id: templateId },
			include: {
				portConfigs: {
					include: { portTemplate: true },
				},
			},
		});

		if (!template) {
			return res.status(404).json({ error: "Equipment Template not found" });
		}

		// 2. The Atomic Transaction
		const result = await prisma.$transaction(async (tx) => {
			// A. Create the Equipment
			const createData = {
				name,
				description: description || "",
				providedBy: providedBy || "Indian Railways",
				serialNumber: serialNumber || null,
				uPosition: uPosition ? Number.parseInt(uPosition) : null,
				installationDate: installationDate ? new Date(installationDate) : null,
				status: "OPERATIONAL",
				// Connect Relations (Required by your strict schema)
				template: { connect: { id: templateId } },
				station: { connect: { id: stationId } },
				createdBy: { connect: { id: userId } },
			};

			// Handle optional Rack connection
			if (rackId && rackId !== "") {
				createData.rack = { connect: { id: rackId } };
			}

			const equipment = await tx.equipment.create({
				data: createData,
			});

			// B. Prepare Port Data based on the Template Blueprint
			const portData = [];
			template.portConfigs.forEach((config) => {
				for (let i = 1; i <= config.quantity; i++) {
					portData.push({
						name: `${config.portTemplate.name} ${i}`,
						equipmentId: equipment.id, // Linking to the just-created ID
						templateId: config.portTemplateId,
						status: "FREE",
					});
				}
			});

			// C. Create Ports (Inside the same transaction)
			if (portData.length > 0) {
				await tx.port.createMany({
					data: portData,
				});
			}

			// Return the equipment with its newly minted ports included
			return await tx.equipment.findUnique({
				where: { id: equipment.id },
				include: { ports: true },
			});
		});

		res.status(201).json(result);
	} catch (error) {
		console.error("Atomic Transaction Failed:", error.message);
		res.status(500).json({ error: error.message });
	}
};

/**
 * 2. FIND EQUIPMENT BY STATION
 * Includes Template specs (uHeight, supply, etc.) and Rack/Location info.
 */
export const findEquipmentByStation = async (req, res) => {
	try {
		const { stationId } = req.params;
		const equipment = await prisma.equipment.findMany({
			where: { stationId },
			include: {
				template: true, // Access uHeight, isPoe, switchingCapacity etc.
				ports: true,
				rack: {
					select: {
						name: true,
						location: { select: { name: true } },
					},
				},
			},
			orderBy: { createdAt: "desc" },
		});
		res.status(200).json(equipment);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

/**
 * 3. UPDATE EQUIPMENT (Universal)
 * Handles XYFlow positions, status changes, and metadata updates.
 */
export const updateEquipment = async (req, res) => {
	try {
		const { id } = req.params;
		const updateData = { ...req.body };

		// Ensure numeric fields are correctly cast if they are being updated
		if (updateData.uPosition !== undefined) {
			updateData.uPosition = updateData.uPosition
				? Number.parseInt(updateData.uPosition)
				: null;
		}
		if (updateData.mapX !== undefined) {
			updateData.mapX = Number.parseFloat(updateData.mapX);
		}
		if (updateData.mapY !== undefined) {
			updateData.mapY = Number.parseFloat(updateData.mapY);
		}

		// Date handling for Prisma
		if (updateData.installationDate) {
			updateData.installationDate = new Date(updateData.installationDate);
		}
		if (updateData.DateOfLastMaintenace) {
			updateData.DateOfLastMaintenace = new Date(
				updateData.DateOfLastMaintenace,
			);
		}

		const updated = await prisma.equipment.update({
			where: { id },
			data: updateData,
		});

		res.status(200).json(updated);
	} catch (error) {
		console.error("Equipment Update Error:", error.message);
		res.status(500).json({ error: error.message });
	}
};

/**
 * 4. BULK UPDATE POSITIONS (XYFlow)
 */
export const bulkUpdateEquipment = async (req, res) => {
	try {
		const { updates } = req.body; // Array of { id, mapX, mapY }

		const transactions = updates.map((u) => {
			const { id, ...data } = u;

			if (data.mapX !== undefined) data.mapX = Number.parseFloat(data.mapX);
			if (data.mapY !== undefined) data.mapY = Number.parseFloat(data.mapY);

			return prisma.equipment.update({
				where: { id },
				data: data,
			});
		});

		await prisma.$transaction(transactions);
		res.status(200).json({ message: "Bulk update successful" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

/**
 * 5. DELETE EQUIPMENT
 */
export const deleteEquipment = async (req, res) => {
	try {
		const { id } = req.params;
		await prisma.equipment.delete({ where: { id } });
		res.status(204).send();
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
