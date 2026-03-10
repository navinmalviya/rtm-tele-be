import prisma from "../lib/prisma.js";
import { ROLE_GROUPS } from "../lib/rbac.js";

const FIELD_ROLES = new Set([
	...ROLE_GROUPS.FIELD,
	"FIELD_ENGINEER",
	"SSE_SECTIONAL",
	"JE_SECTIONAL",
]);

export const createTnpItem = async (req, res) => {
	const { tnpNumber, name, description, type, stationId, locationId } = req.body;
	const { id: userId, divisionId, role } = req.user;

	if (!tnpNumber || !name || !type || !stationId) {
		return res.status(400).json({ message: "tnpNumber, name, type, stationId are required" });
	}

	try {
		const station = await prisma.station.findFirst({
			where: role === "SUPER_ADMIN" ? { id: stationId } : { id: stationId, divisionId },
			select: { id: true },
		});

		if (!station) {
			return res.status(403).json({ message: "Invalid station access" });
		}

		if (locationId) {
			const location = await prisma.location.findFirst({
				where: { id: locationId, stationId },
				select: { id: true },
			});

			if (!location) {
				return res.status(400).json({ message: "Selected location does not belong to selected station" });
			}
		}

		const item = await prisma.tnpItem.create({
			data: {
				tnpNumber,
				name,
				description: description || null,
				type,
				station: { connect: { id: stationId } },
				location: locationId ? { connect: { id: locationId } } : undefined,
				createdBy: { connect: { id: userId } },
			},
		});

		res.status(201).json(item);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const listTnpItems = async (req, res) => {
	const { divisionId, role, id: userId } = req.user;

	try {
		const where = role === "SUPER_ADMIN"
			? {}
			: {
					station: { divisionId },
			  };

		if (FIELD_ROLES.has(role)) {
			where.createdById = userId;
		}

		const items = await prisma.tnpItem.findMany({
			where,
			include: {
				station: { select: { id: true, name: true, code: true } },
				location: { select: { id: true, name: true } },
				createdBy: { select: { id: true, name: true } },
			},
			orderBy: { createdAt: "desc" },
		});

		res.status(200).json(items);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const updateTnpItem = async (req, res) => {
	const { id } = req.params;
	const { tnpNumber, name, description, type, stationId, locationId } = req.body;
	const { divisionId, role, id: userId } = req.user;

	try {
		const current = await prisma.tnpItem.findFirst({
			where: {
				id,
				...(role === "SUPER_ADMIN" ? {} : { station: { divisionId } }),
				...(FIELD_ROLES.has(role) ? { createdById: userId } : {}),
			},
			select: { id: true, stationId: true },
		});

		if (!current) {
			return res.status(404).json({ message: "T&P item not found" });
		}

		const nextStationId = stationId ?? current.stationId;

		if (locationId) {
			const location = await prisma.location.findFirst({
				where: { id: locationId, stationId: nextStationId },
				select: { id: true },
			});

			if (!location) {
				return res.status(400).json({ message: "Selected location does not belong to selected station" });
			}
		}

		const updated = await prisma.tnpItem.update({
			where: { id },
			data: {
				tnpNumber: tnpNumber ?? undefined,
				name: name ?? undefined,
				description: description ?? undefined,
				type: type ?? undefined,
				station: stationId ? { connect: { id: stationId } } : undefined,
				location:
					locationId === null
						? { disconnect: true }
						: locationId
						? { connect: { id: locationId } }
						: undefined,
			},
		});

		res.status(200).json(updated);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const deleteTnpItem = async (req, res) => {
	const { id } = req.params;
	const { divisionId, role, id: userId } = req.user;

	try {
		const current = await prisma.tnpItem.findFirst({
			where: {
				id,
				...(role === "SUPER_ADMIN" ? {} : { station: { divisionId } }),
				...(FIELD_ROLES.has(role) ? { createdById: userId } : {}),
			},
			select: { id: true },
		});

		if (!current) {
			return res.status(404).json({ message: "T&P item not found" });
		}

		await prisma.tnpItem.delete({ where: { id } });
		res.status(200).json({ message: "T&P item deleted successfully" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
