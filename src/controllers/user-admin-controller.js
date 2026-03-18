import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";

const OPTIONAL_REPORTING_ROLES = new Set(["SR_DSTE"]);
const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);
const REPORTING_ALLOWED_BY_ROLE = {
	DSTE: ["SR_DSTE", "ADMIN", "SUPER_ADMIN"],
	ADSTE: ["DSTE", "SR_DSTE", "ADMIN", "SUPER_ADMIN"],
	TESTROOM: ["ADSTE", "DSTE", "SR_DSTE", "ADMIN", "SUPER_ADMIN"],
	SSE_TELE_INCHARGE: ["ADSTE", "DSTE", "SR_DSTE"],
	JE_SSE_TELE_SECTIONAL: ["SSE_TELE_INCHARGE", "ADSTE"],
	TCM: ["JE_SSE_TELE_SECTIONAL", "SSE_TELE_INCHARGE"],
	TECHNICIAN: ["JE_SSE_TELE_SECTIONAL", "SSE_TELE_INCHARGE"],
	TRC: ["TESTROOM", "ADSTE"],
	VIEWER: ["TESTROOM", "ADSTE", "DSTE", "SR_DSTE", "ADMIN"],
	SSE_SNT_OFFICE: ["SSE_TELE_INCHARGE", "ADSTE"],
	SSE_TECH: ["SSE_TELE_INCHARGE", "ADSTE"],
};

const validateReportingOfficer = async ({ inchargeId, divisionId, role }) => {
	const allowedRoles = REPORTING_ALLOWED_BY_ROLE[role] || [];
	const reportingOfficer = await prisma.user.findFirst({
		where: {
			id: inchargeId,
			divisionId,
			...(allowedRoles.length ? { role: { in: allowedRoles } } : {}),
		},
		select: { id: true },
	});

	return Boolean(reportingOfficer);
};

export const updateUser = async (req, res) => {
	const { id } = req.params;
	const { name, email, username, designation, unit, role, password, inchargeId } = req.body;

	try {
		const existingUser = await prisma.user.findUnique({
			where: { id },
			select: { id: true, divisionId: true, role: true, inchargeId: true },
		});
		if (!existingUser) {
			return res.status(404).json({ message: "User not found" });
		}

		const effectiveRole = role ?? existingUser.role;
		const isAdminRole = ADMIN_ROLES.has(effectiveRole);
		const isOptionalReportingRole = OPTIONAL_REPORTING_ROLES.has(effectiveRole);
		const targetInchargeId = inchargeId !== undefined ? inchargeId : existingUser.inchargeId;

		if (!isAdminRole && !isOptionalReportingRole) {
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
			const isReportingOfficerValid = await validateReportingOfficer({
				inchargeId: targetInchargeId,
				divisionId: existingUser.divisionId,
				role: effectiveRole,
			});
			if (!isReportingOfficerValid) {
				return res
					.status(400)
					.json({ message: "Invalid reporting_to user for this division." });
			}
		}

		if (!isAdminRole && isOptionalReportingRole && targetInchargeId) {
			if (targetInchargeId === id) {
				return res
					.status(400)
					.json({ message: "User cannot report to themselves." });
			}
			const isReportingOfficerValid = await validateReportingOfficer({
				inchargeId: targetInchargeId,
				divisionId: existingUser.divisionId,
				role: effectiveRole,
			});
			if (!isReportingOfficerValid) {
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
			unit: unit !== undefined ? unit || null : undefined,
			role: role ?? undefined,
			inchargeId: isAdminRole
				? null
				: inchargeId !== undefined
				? inchargeId || null
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
