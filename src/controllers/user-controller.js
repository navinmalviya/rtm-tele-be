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
				role: true,
				divisionId: true,
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

		const users = await prisma.user.findMany(queryOptions);

		res.status(200).json(users);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export { getAllUsers };
