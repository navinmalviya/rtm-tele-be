import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";

export const updateUser = async (req, res) => {
	const { id } = req.params;
	const { name, email, username, designation, role, password, inchargeId } = req.body;

	try {
		const existingUser = await prisma.user.findUnique({
			where: { id },
			select: { id: true, divisionId: true, role: true, inchargeId: true },
		});
		if (!existingUser) {
			return res.status(404).json({ message: "User not found" });
		}

		const effectiveRole = role ?? existingUser.role;
		const isAdminRole = effectiveRole === "SUPER_ADMIN" || effectiveRole === "ADMIN";
		const targetInchargeId = inchargeId !== undefined ? inchargeId : existingUser.inchargeId;

		if (!isAdminRole) {
			if (!targetInchargeId) {
				return res
					.status(400)
					.json({ message: "reporting_to is required for non-admin roles." });
			}
			if (targetInchargeId === id) {
				return res
					.status(400)
					.json({ message: "User cannot report to themselves." });
			}
			const reportingOfficer = await prisma.user.findFirst({
				where: { id: targetInchargeId, divisionId: existingUser.divisionId },
				select: { id: true },
			});
			if (!reportingOfficer) {
				return res
					.status(400)
					.json({ message: "Invalid reporting_to user for this division." });
			}
		}

		const data = {
			name: name ?? undefined,
			email: email ?? undefined,
			username: username ?? undefined,
			designation: designation ?? undefined,
			role: role ?? undefined,
			inchargeId: isAdminRole
				? null
				: inchargeId !== undefined
				? inchargeId
				: undefined,
		};

		if (password) {
			data.password = bcrypt.hashSync(password, 8);
		}

		const user = await prisma.user.update({
			where: { id },
			data,
			select: {
				id: true,
				name: true,
				username: true,
				email: true,
				designation: true,
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
			},
		});

		res.status(200).json({ message: "User updated successfully", user });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const deleteUser = async (req, res) => {
	const { id } = req.params;

	try {
		await prisma.user.delete({ where: { id } });
		res.status(200).json({ message: "User deleted successfully" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
