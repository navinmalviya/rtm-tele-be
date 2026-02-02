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

export const getLinkDetails = async (req, res) => {
	try {
		const { id } = req.params;

		const link = await prisma.portLink.findUnique({
			where: { id },
			include: {
				source: {
					include: {
						equipment: true, // Get the device name/info
					},
				},
				target: {
					include: {
						equipment: true,
					},
				},
			},
		});

		if (!link) {
			return res.status(404).json({ error: "Port link not found." });
		}

		res.status(200).json(link);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const updatePortLink = async (req, res) => {
	try {
		const { id } = req.params;
		const { mediaType, cableColor, length, circuitId } = req.body;

		// Verify existence first
		const linkExists = await prisma.portLink.findUnique({
			where: { id },
		});

		if (!linkExists) {
			return res.status(404).json({ error: "Port link not found." });
		}

		const updatedLink = await prisma.portLink.update({
			where: { id },
			data: {
				mediaType,
				cableColor,
				length: length ? Number.parseFloat(length) : null,
				circuitId,
			},
			include: {
				source: {
					include: { equipment: true },
				},
				target: {
					include: { equipment: true },
				},
			},
		});

		res.status(200).json(updatedLink);
	} catch (error) {
		console.error("Update PortLink Error:", error);
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

export const getAvailablePortsByStation = async (req, res) => {
	try {
		const { stationId } = req.params;

		// Using your schema's specific relation names: linkAsSource and linkAsTarget
		const availablePorts = await prisma.port.findMany({
			where: {
				equipment: {
					stationId: stationId,
				},
				// A port is available only if both link relations are null
				linkAsSource: null,
				linkAsTarget: null,
			},
			include: {
				equipment: {
					select: {
						id: true,
						name: true,
					},
				},
			},
			orderBy: [
				{
					equipment: {
						name: "asc",
					},
				},
				{
					name: "asc",
				},
			],
		});

		res.status(200).json(availablePorts);
	} catch (error) {
		console.error("Error in getAvailablePortsByStation:", error);
		res.status(500).json({ error: error.message });
	}
};
