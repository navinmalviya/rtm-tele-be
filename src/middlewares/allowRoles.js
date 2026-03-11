const normalizeRole = (role) => String(role || "").trim().toUpperCase();

const ROLE_ALIASES = {
	SR_DSTE: ["SR_DSTE", "SR_DSTE_CO"],
	JE_SSE_TELE_SECTIONAL: [
		"JE_SSE_TELE_SECTIONAL",
		"FIELD_ENGINEER",
		"JE_SECTIONAL",
		"SSE_SECTIONAL",
		"JE/SSE_TELE_SECTIONAL",
	],
	TCM: ["TCM", "TECHNICIAN", "MAINTAINER"],
	SSE_TELE_INCHARGE: ["SSE_TELE_INCHARGE", "SSE_INCHARGE"],
};

const expandRole = (role) => {
	const normalized = normalizeRole(role);
	const mapped = ROLE_ALIASES[normalized] || [normalized];
	return mapped.map(normalizeRole);
};

export const allowRoles = (...roles) => {
	const allowed = new Set(roles.flat().map(normalizeRole));
	return (req, res, next) => {
		const role = normalizeRole(req.user?.role);
		if (!role) {
			return res.status(403).json({ message: 'Forbidden: Missing role' });
		}
		if (role === 'SUPER_ADMIN') return next();

		const roleVariants = expandRole(role);
		const isAllowed = roleVariants.some((variant) => allowed.has(variant));

		if (!isAllowed) {
			return res.status(403).json({ message: 'Forbidden: Insufficient role' });
		}
		return next();
	};
};
