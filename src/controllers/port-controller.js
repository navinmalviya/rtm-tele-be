import prisma from "../lib/prisma.js";

export const portController = {
	// 1. Create a single port manually
	createPort: async (req, res) => {
		try {
			const { name, type, equipmentId, ipAddress, vlanMode, vlanIds } =
				req.body;
			const port = await prisma.port.create({
				data: {
					name,
					type,
					equipmentId,
					ipAddress: ipAddress || null,
					vlanMode: vlanMode || "ACCESS",
					vlanIds: vlanIds || null,
				},
			});
			res.status(201).json(port);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},

	// 2. Bulk create ports (e.g., adding 24 ports at once for a switch)
	bulkCreatePorts: async (req, res) => {
		try {
			const { equipmentId, ports } = req.body;
			// ports array: [{ name: "Gi0/1", type: "SFP" }, { name: "Gi0/2", type: "SFP" }]

			const created = await prisma.port.createMany({
				data: ports.map((p) => ({
					...p,
					equipmentId,
				})),
			});
			res.status(201).json(created);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},

	// 3. Update Port configuration (Networking, IP, VLAN, Status)
	updatePort: async (req, res) => {
		try {
			const { id } = req.params;
			const { name, type, status, ipAddress, vlanMode, vlanIds, speed } =
				req.body;

			const updated = await prisma.port.update({
				where: { id },
				data: {
					name,
					type,
					status,
					speed,
					ipAddress: ipAddress || null,
					vlanMode: vlanMode || "ACCESS",
					vlanIds: vlanIds || null,
				},
			});
			res.status(200).json(updated);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},

	// 4. Get all ports for a specific Equipment (for internal XYFlow view)
	getEquipmentPorts: async (req, res) => {
		try {
			const { equipmentId } = req.params;
			const ports = await prisma.port.findMany({
				where: { equipmentId },
				include: {
					// Include links to show which ports are already connected
					linksAsSource: true,
					linksAsTarget: true,
				},
				orderBy: { name: "asc" },
			});
			res.status(200).json(ports);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},

	// 5. Get specifically "Core" ports for inter-station link suggestions
	getCorePortsByStation: async (req, res) => {
		try {
			const { stationId } = req.params;
			const corePorts = await prisma.port.findMany({
				where: {
					equipment: {
						stationId,
						isCoreEquipment: true,
					},
				},
				include: {
					equipment: {
						select: { name: true, subType: true },
					},
				},
			});
			res.status(200).json(corePorts);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},

	// 6. Delete a port
	deletePort: async (req, res) => {
		try {
			const { id } = req.params;
			await prisma.port.delete({ where: { id } });
			res.status(204).send();
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	},
};
