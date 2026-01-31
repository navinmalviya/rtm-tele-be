import prisma from "../lib/prisma";

export const createPortLink = async (req, res) => {
	try {
		const { sourcePortId, targetPortId, mediaType, cableColor } = req.body;

		// 1. Validate that the link doesn't already exist (Prisma @unique will also catch this)
		const existingLink = await prisma.portLink.findFirst({
			where: {
				OR: [
					{ sourcePortId: sourcePortId },
					{ targetPortId: targetPortId },
					{ sourcePortId: targetPortId }, // Prevent circular or duplicate cabling
					{ targetPortId: sourcePortId },
				],
			},
		});

		if (existingLink) {
			return res.status(400).json({
				error: "One of the selected ports is already cabled.",
			});
		}

		// 2. Create the physical link
		const portLink = await prisma.portLink.create({
			data: {
				sourcePortId,
				targetPortId,
				mediaType: mediaType || "Auto-detected",
				cableColor: cableColor || "Blue",
			},
			include: {
				source: true,
				target: true,
			},
		});

		res.status(201).json(portLink);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const deletePortLink = async (req, res) => {
	try {
		const { id } = req.params;

		await prisma.portLink.delete({
			where: { id },
		});

		res.status(200).json({ message: "Cable link removed." });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const getStationLinks = async (req, res) => {
	try {
		const { stationId } = req.params;

		// Fetch all links where the source port belongs to an equipment in the station
		const links = await prisma.portLink.findMany({
			where: {
				source: {
					equipment: {
						stationId: stationId,
					},
				},
			},
			include: {
				source: true,
				target: true,
			},
		});

		res.status(200).json(links);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
