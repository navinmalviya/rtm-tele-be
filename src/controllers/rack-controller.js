import prisma from "../lib/prisma.js";
import { buildStationVisibilityWhere } from "../lib/access-scope.js";

export const createRack = async (req, res) => {
	try {
		// 1. Destructure rackData from the body (matching your frontend payload)
		console.log("re", req.body);
		const { name, type, heightU, locationId, description } = req.body;

		// Validation: Ensure mandatory fields exist before calling Prisma
		if (!name || !locationId) {
			return res.status(400).json({
				error: "Rack Name and Location ID are required.",
			});
		}

		const location = await prisma.location.findFirst({
			where: {
				id: locationId,
				station: {
					...buildStationVisibilityWhere(req),
				},
			},
			select: { id: true },
		});
		if (!location) {
			return res.status(403).json({ message: "Forbidden" });
		}

		const rack = await prisma.rack.create({
			data: {
				name,
				type,
				heightU: Number(heightU), // Ensure this is a number
				locationId,
				description: description || "", // Fallback to empty string if missing
			},
		});

		res.status(201).json(rack);
	} catch (error) {
		// Detailed error logging for debugging
		console.error("Prisma Create Error:", error.message);
		res.status(500).json({ error: error.message });
	}
};

export const findRacksByLocation = async (req, res) => {
	try {
		const { locationId } = req.params;
		const location = await prisma.location.findFirst({
			where: {
				id: locationId,
				station: {
					...buildStationVisibilityWhere(req),
				},
			},
			select: { id: true },
		});
		if (!location) {
			return res.status(403).json({ message: "Forbidden" });
		}

		const racks = await prisma.rack.findMany({
			where: { locationId },
			include: {
				_count: { select: { equipments: true } },
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

		if (!stationId) {
			return res.status(400).json({ message: "Station ID is required!" });
		}

		const station = await prisma.station.findFirst({
			where: {
				id: stationId,
				...buildStationVisibilityWhere(req),
			},
			select: { id: true },
		});
		if (!station) {
			return res.status(403).json({ message: "Forbidden" });
		}

		const racks = await prisma.rack.findMany({
			where: {
				location: {
					stationId: stationId,
				},
			},
			include: {
				location: {
					select: { name: true },
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
		const existing = await prisma.rack.findFirst({
			where: {
				id,
				location: {
					station: {
						...buildStationVisibilityWhere(req),
					},
				},
			},
			select: { id: true },
		});
		if (!existing) {
			return res.status(403).json({ message: "Forbidden" });
		}

		const updatedRack = await prisma.rack.update({
			where: { id },
			// If updating from the drawer, wrap this in { rackData } check if needed
			data: req.body.rackData || req.body,
		});
		res.status(200).json(updatedRack);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const deleteRack = async (req, res) => {
	try {
		const { id } = req.params;
		const existing = await prisma.rack.findFirst({
			where: {
				id,
				location: {
					station: {
						...buildStationVisibilityWhere(req),
					},
				},
			},
			select: { id: true },
		});
		if (!existing) {
			return res.status(403).json({ message: "Forbidden" });
		}

		await prisma.rack.delete({ where: { id } });
		res.status(204).send();
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
