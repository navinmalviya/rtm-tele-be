import prisma from "../lib/prisma";

// 1. CREATE Station
const createStation = async (req, res) => {
	const { code, name, section, subSection, mapX, mapY, createdById } = req.body;

	// Validation
	if (!code || !name || !createdById) {
		return res
			.status(400)
			.json({ message: "Code, Name, and Creator ID are required!" });
	}

	try {
		const station = await prisma.station.create({
			data: {
				code,
				name,
				section,
				subSection,
				mapX: parseFloat(mapX), // Ensure coordinates are Floats
				mapY: parseFloat(mapY),
				createdById, // ID of the user creating the station
			},
		});

		res.status(201).json({ message: "Station created successfully!", station });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 2. GET ALL Stations (For the React Flow Canvas)
const findAllStations = async (req, res) => {
	try {
		const stations = await prisma.station.findMany({
			include: { createdBy: { select: { name: true } } }, // Optional: include creator name
		});
		res.status(200).json(stations);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 3. UPDATE Station (Used when dragging on the map)
const updateStation = async (req, res) => {
	const { id } = req.params;
	const data = req.body;

	try {
		const updatedStation = await prisma.station.update({
			where: { id },
			data: {
				...data,
				// Ensure map coordinates remain Floats if updated
				mapX: data.mapX ? parseFloat(data.mapX) : undefined,
				mapY: data.mapY ? parseFloat(data.mapY) : undefined,
			},
		});
		res.status(200).json({ message: "Station updated!", updatedStation });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 4. DELETE Station
const deleteStation = async (req, res) => {
	const { id } = req.params;

	try {
		await prisma.station.delete({
			where: { id },
		});
		res.status(200).json({ message: "Station deleted successfully!" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

const bulkUpdateStations = async (req, res) => {
	const { stations } = req.body;

	if (!Array.isArray(stations) || stations.length === 0) {
		return res
			.status(400)
			.json({ message: "No station data provided for update." });
	}

	try {
		// We use a transaction to ensure all updates are processed
		const updateOperations = stations.map((station) =>
			prisma.station.update({
				where: { id: station.id },
				data: {
					mapX: parseFloat(station.mapX),
					mapY: parseFloat(station.mapY),
				},
			}),
		);

		const updatedStations = await prisma.$transaction(updateOperations);

		res.status(200).json({
			message: `${updatedStations.length} stations updated successfully!`,
			updatedStations,
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export {
	createStation,
	findAllStations,
	updateStation,
	deleteStation,
	bulkUpdateStations,
};
