import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";

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

const getMyProfile = async (req, res) => {
	try {
		const user = await prisma.user.findUnique({
			where: { id: req.user.id },
			select: {
				id: true,
				name: true,
				username: true,
				email: true,
				designation: true,
				unit: true,
				role: true,
				divisionId: true,
				inchargeId: true,
				incharge: {
					select: { id: true, name: true, designation: true, role: true },
				},
			},
		});

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		return res.status(200).json(user);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

const updateMyProfile = async (req, res) => {
	const { email, designation, unit } = req.body || {};
	if (email !== undefined && !String(email).trim()) {
		return res.status(400).json({ message: "Email cannot be empty." });
	}

	try {
		const updated = await prisma.user.update({
			where: { id: req.user.id },
			data: {
				email: email !== undefined ? String(email).trim() : undefined,
				designation: designation !== undefined ? String(designation).trim() : undefined,
				unit: unit !== undefined ? unit || null : undefined,
			},
			select: {
				id: true,
				name: true,
				username: true,
				email: true,
				designation: true,
				unit: true,
				role: true,
				divisionId: true,
			},
		});
		return res.status(200).json({ message: "Profile updated successfully", user: updated });
	} catch (error) {
		if (error.code === "P2002") {
			return res.status(409).json({ message: "Email is already in use." });
		}
		return res.status(500).json({ error: error.message });
	}
};

const updateMyPassword = async (req, res) => {
	const { currentPassword, newPassword } = req.body || {};

	if (!currentPassword || !newPassword) {
		return res
			.status(400)
			.json({ message: "currentPassword and newPassword are required." });
	}
	if (String(newPassword).length < 6) {
		return res
			.status(400)
			.json({ message: "New password must be at least 6 characters long." });
	}

	try {
		const existing = await prisma.user.findUnique({
			where: { id: req.user.id },
			select: { id: true, password: true },
		});
		if (!existing) {
			return res.status(404).json({ message: "User not found" });
		}

		const isValid = bcrypt.compareSync(currentPassword, existing.password);
		if (!isValid) {
			return res.status(401).json({ message: "Current password is incorrect." });
		}

		await prisma.user.update({
			where: { id: req.user.id },
			data: { password: bcrypt.hashSync(newPassword, 8) },
		});
		return res.status(200).json({ message: "Password updated successfully." });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export { getAllUsers, getMyProfile, updateMyPassword, updateMyProfile };
