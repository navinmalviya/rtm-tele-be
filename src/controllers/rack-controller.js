import prisma from "../lib/prisma.js";

export const createRack = async (req, res) => {
	try {
		const { name, type, heightU, locationId } = req.body;
		const rack = await prisma.rack.create({
			data: { name, type, heightU, locationId },
		});
		res.status(201).json(rack);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const findRacksByLocation = async (req, res) => {
	try {
		const { locationId } = req.params;
		const racks = await prisma.rack.findMany({
			where: { locationId },
			include: {
				_count: { select: { equipments: true } }, // Quick view of rack load
			},
			orderBy: { name: "asc" },
		});
		res.status(200).json(racks);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const findRacksByStation = async (req, res) => {
	try {
		const { stationId } = req.params;

		// Validation
		if (!stationId) {
			return res.status(400).json({ message: "Station ID is required!" });
		}

		const racks = await prisma.rack.findMany({
			where: {
				location: {
					stationId: stationId,
				},
			},
			include: {
				location: {
					select: { name: true }, // Helpful to know which room the rack is in
				},
				_count: {
					select: { equipments: true },
				},
			},
			orderBy: { name: "asc" },
		});

		res.status(200).json(racks);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const updateRack = async (req, res) => {
	try {
		const { id } = req.params;
		const updatedRack = await prisma.rack.update({
			where: { id },
			data: req.body,
		});
		res.status(200).json(updatedRack);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const deleteRack = async (req, res) => {
	try {
		const { id } = req.params;
		await prisma.rack.delete({ where: { id } });
		res.status(204).send();
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
