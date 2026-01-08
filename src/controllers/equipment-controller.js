import prisma from "../lib/prisma";

// 1. Create Equipment (with audit trail)
export const createEquipment = async (req, res) => {
	try {
		const {
			name,
			category,
			subType,
			isCoreEquipment,
			stationId,
			rackId,
			uPosition,
			uHeight,
			capacityValue,
			capacityUnit,
			ipAddress,
			installationDate,
			codalLifeYears,
			createdById,
		} = req.body;

		const equipment = await prisma.equipment.create({
			data: {
				name,
				category,
				subType,
				isCoreEquipment,
				stationId,
				rackId,
				uPosition,
				uHeight,
				capacityValue,
				capacityUnit,
				ipAddress,
				installationDate: installationDate ? new Date(installationDate) : null,
				codalLifeYears,
				createdById,
			},
		});
		res.status(201).json(equipment);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 2. Fetch all equipment for Internal XYFlow view
export const findEquipmentByStation = async (req, res) => {
	try {
		const { stationId } = req.params;
		const equipment = await prisma.equipment.findMany({
			where: { stationId },
			include: {
				ports: true, // Needed for internal wiring handles
				rack: { select: { name: true, location: { select: { name: true } } } },
			},
		});
		res.status(200).json(equipment);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 3. Fetch ONLY Core Equipment (For Inter-Station Link suggestions)
export const findCoreEquipmentByStation = async (req, res) => {
	try {
		const { stationId } = req.params;
		const coreAssets = await prisma.equipment.findMany({
			where: {
				stationId,
				isCoreEquipment: true,
			},
			include: {
				ports: {
					select: { id: true, name: true, status: true, type: true },
				},
			},
		});
		res.status(200).json(coreAssets);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 4. Update XYFlow Position (Drag & Drop)
export const updateEquipmentPosition = async (req, res) => {
	try {
		const { id } = req.params;
		const { mapX, mapY } = req.body;
		const updated = await prisma.equipment.update({
			where: { id },
			data: { mapX, mapY },
		});
		res.status(200).json(updated);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 5. Bulk Update Positions (For efficient XYFlow saving)
export const bulkUpdateEquipmentPositions = async (req, res) => {
	try {
		const { updates } = req.body; // Array of {id, mapX, mapY}
		const transactions = updates.map((u) =>
			prisma.equipment.update({
				where: { id: u.id },
				data: { mapX: u.mapX, mapY: u.mapY },
			}),
		);
		await prisma.$transaction(transactions);
		res.status(200).json({ message: "Positions updated" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const deleteEquipment = async (req, res) => {
	try {
		const { id } = req.params;
		await prisma.equipment.delete({ where: { id } });
		res.status(204).send();
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
