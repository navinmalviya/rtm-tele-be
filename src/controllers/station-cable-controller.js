import prisma from "../lib/prisma.js";

const getStructuralCounts = (subType) => {
	switch (subType) {
		case "QUAD_6":
			return { quadCount: 6, pairCount: 24, fiberCount: 0, tubeCount: 0 };
		case "OFC_24":
			return { quadCount: 0, pairCount: 0, fiberCount: 24, tubeCount: 6 };
		case "OFC_48":
			return { quadCount: 0, pairCount: 0, fiberCount: 48, tubeCount: 6 };
		case "PAIR_10":
			return { quadCount: 0, pairCount: 10, fiberCount: 0, tubeCount: 0 };
		default:
			return {};
	}
};

export const stationCableController = {
	getByStation: async (req, res) => {
		try {
			const { stationId } = req.params;
			const { divisionId, role } = req.user;

			const station = await prisma.station.findFirst({
				where: {
					id: stationId,
					...(role === "SUPER_ADMIN" ? {} : { divisionId }),
				},
				select: { id: true },
			});
			if (!station) {
				return res.status(404).json({ message: "Station not found or unauthorized." });
			}

			const rows = await prisma.stationCable.findMany({
				where: {
					OR: [{ fromLocation: { stationId } }, { toLocation: { stationId } }],
				},
				include: {
					fromLocation: { select: { id: true, name: true, stationId: true } },
					toLocation: { select: { id: true, name: true, stationId: true } },
				},
				orderBy: { createdAt: "desc" },
			});
			res.status(200).json(rows);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},

	create: async (req, res) => {
		try {
			const {
				type,
				subType,
				maintenanceBy,
				length,
				dateOfCommissioning,
				fromLocationId,
				toLocationId,
			} = req.body;
			const { divisionId, role } = req.user;

			if (!type || !subType || !maintenanceBy || !length || !fromLocationId || !toLocationId) {
				return res.status(400).json({
					message:
						"type, subType, maintenanceBy, length, fromLocationId and toLocationId are required.",
				});
			}
			if (fromLocationId === toLocationId) {
				return res.status(400).json({ message: "From and To locations must be different." });
			}

			const [fromLocation, toLocation] = await Promise.all([
				prisma.location.findFirst({
					where: {
						id: fromLocationId,
						...(role === "SUPER_ADMIN" ? {} : { station: { divisionId } }),
					},
					select: { id: true, stationId: true, station: { select: { divisionId: true } } },
				}),
				prisma.location.findFirst({
					where: {
						id: toLocationId,
						...(role === "SUPER_ADMIN" ? {} : { station: { divisionId } }),
					},
					select: { id: true, stationId: true, station: { select: { divisionId: true } } },
				}),
			]);

			if (!fromLocation || !toLocation) {
				return res.status(400).json({ message: "Invalid from/to location for your division." });
			}

			if (fromLocation.stationId !== toLocation.stationId) {
				return res.status(400).json({
					message: "Station cable must connect locations of the same station.",
				});
			}

			const structural = getStructuralCounts(subType);

			const created = await prisma.stationCable.create({
				data: {
					type,
					subType,
					maintenanceBy,
					length,
					dateOfCommissioning: dateOfCommissioning ? new Date(dateOfCommissioning) : null,
					fromLocationId,
					toLocationId,
					quadCount: structural.quadCount || 0,
					pairCount: structural.pairCount || 0,
					fiberCount: structural.fiberCount || 0,
					tubeCount: structural.tubeCount || 0,
				},
				include: {
					fromLocation: { select: { id: true, name: true, stationId: true } },
					toLocation: { select: { id: true, name: true, stationId: true } },
				},
			});

			res.status(201).json(created);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},

	delete: async (req, res) => {
		try {
			const { id } = req.params;
			await prisma.stationCable.delete({ where: { id } });
			res.status(200).json({ message: "Station cable deleted." });
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},
};
