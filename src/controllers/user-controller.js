import prisma from "../lib/prisma";

/**
 * GET ALL USERS (Filtered by Division)
 * Used to populate the "Assign To" lists for work orders and task dispatching.
 */
const getAllUsers = async (req, res) => {
	const { divisionId, role } = req.user;

	try {
		const queryOptions = {
			where: {},
			select: {
				id: true,
				name: true,
				username: true,
				email: true,
				designation: true,
				unit: true,
				role: true,
				inchargeId: true,
				divisionId: true,
				incharge: {
					select: {
						id: true,
						name: true,
						designation: true,
						role: true,
					},
				},
				// Sensitive data like passwords must be excluded here
			},
			orderBy: {
				name: "asc",
			},
		};

		// Strictly filter by division unless the requester is a SUPER_ADMIN
		if (role !== "SUPER_ADMIN") {
			queryOptions.where.divisionId = divisionId;
		}

		// Never return SUPER_ADMIN entries in the list for settings views
		queryOptions.where.role = { not: "SUPER_ADMIN" };

		const users = await prisma.user.findMany(queryOptions);

		res.status(200).json(users);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export { getAllUsers };
