import prisma from "../lib/prisma.js";

// 1. CREATE Location
const createLocation = async (req, res) => {
	const { name, description, stationId } = req.body;

	// Validation
	if (!name || !stationId) {
		return res
			.status(400)
			.json({ message: "Location name and Station ID are required!" });
	}

	try {
		const newLocation = await prisma.location.create({
			data: {
				name,
				description,
				stationId,
			},
		});

		res
			.status(201)
			.json({ message: "Location created successfully!", newLocation });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 2. GET ALL Locations for a specific station
const findStationLocations = async (req, res) => {
	const { stationId } = req.params;

	try {
		const locations = await prisma.location.findMany({
			where: { stationId },
			include: {
				_count: {
					select: { racks: true }, // Show how many racks are in each room
				},
			},
		});
		res.status(200).json(locations);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 3. GET Location Details (Racks -> Equipment -> Ports)
const getLocationDetails = async (req, res) => {
	const { id } = req.params;

	try {
		const location = await prisma.location.findUnique({
			where: { id },
			include: {
				racks: {
					include: {
						equipments: {
							include: {
								ports: true,
							},
						},
					},
				},
			},
		});

		if (!location) {
			return res.status(404).json({ error: "Location not found" });
		}

		res.status(200).json(location);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 4. UPDATE Location details
const updateLocation = async (req, res) => {
	const { id } = req.params;
	const { name, description } = req.body;

	try {
		const updatedLocation = await prisma.location.update({
			where: { id },
			data: { name, description },
		});

		res
			.status(200)
			.json({ message: "Location updated successfully!", updatedLocation });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

// 5. DELETE Location
const deleteLocation = async (req, res) => {
	const { id } = req.params;

	try {
		await prisma.location.delete({
			where: { id },
		});
		res.status(200).json({ message: "Location deleted successfully!" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export {
	createLocation,
	findStationLocations,
	getLocationDetails,
	updateLocation,
	deleteLocation,
};
