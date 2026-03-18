import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

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

const create = async (req, res) => {
	const {
		email,
		name,
		designation,
		unit,
		password,
		role,
		username,
		divisionId,
		inchargeId,
	} =
		req.body;
	const isAdminRole = ADMIN_ROLES.has(role);
	const isOptionalReportingRole = OPTIONAL_REPORTING_ROLES.has(role);

	// Basic validation
	if (!email || !name || !password || !username || !divisionId) {
		return res.status(400).send({
			message:
				"Required fields are missing! (Email, Name, Password, Username, DivisionId)",
		});
	}

	try {
		if (!isAdminRole && !isOptionalReportingRole) {
			if (!inchargeId) {
				return res
					.status(400)
					.json({ message: "reporting_to is required for non-admin roles." });
			}

			const isReportingOfficerValid = await validateReportingOfficer({
				inchargeId,
				divisionId,
				role,
			});
			if (!isReportingOfficerValid) {
				return res
					.status(400)
					.json({ message: "Invalid reporting_to user for this division." });
			}
		}

		if (!isAdminRole && isOptionalReportingRole && inchargeId) {
			const isReportingOfficerValid = await validateReportingOfficer({
				inchargeId,
				divisionId,
				role,
			});
			if (!isReportingOfficerValid) {
				return res
					.status(400)
					.json({ message: "Invalid reporting_to user for this division." });
			}
		}

		const user = await prisma.user.create({
			data: {
				name,
				email,
				username,
				password: bcrypt.hashSync(password, 8),
				designation,
				unit: unit || null,
				role,
				divisionId, // Now linking user to their Railway Division
				inchargeId: isAdminRole ? null : inchargeId || null,
			},
		});

		return res.status(201).json({
			message: "User registered successfully!!",
			user: {
				id: user.id,
				username: user.username,
				divisionId: user.divisionId,
			},
		});
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
};

const signin = async (req, res) => {
	const { username, password } = req.body;

	if (!username || !password) {
		return res
			.status(400)
			.json({ message: "Username and password are required!" });
	}

	try {
		const user = await prisma.user.findUnique({
			where: { username: username },
			include: {
				division: true, // This fetches the full Division object
			},
		});

		// ... (keep your password validation logic)
		const effectiveRole =
			user.role === "JE_SSE_TELE_SECTIONAL" ? "FIELD_ENGINEER" : user.role;

		const token = jwt.sign(
			{
				id: user.id,
				role: effectiveRole,
				originalRole: user.role,
				username: user.username,
				divisionId: user.divisionId, // This is the UUID string from the User table
			},
			process.env.API_SECRET,
			{ expiresIn: "24h" },
		);

		return res.status(200).json({
				user: {
					id: user.id,
					username: user.username,
					fullName: user.name,
					designation: user.designation || null,
					unit: user.unit || null,
					role: effectiveRole,
					originalRole: user.role,
					// Accessing the ID directly from the user record
					divisionId: user.divisionId,
				// Accessing the code from the nested 'division' object fetched via 'include'
				divisionCode: user.division?.code || "N/A",
				divisionName: user.division?.name || "N/A",
			},
			message: "Login successful",
			accessToken: token,
		});
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
};

export { create, signin };
