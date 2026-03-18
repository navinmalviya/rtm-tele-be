const FIELD_SCOPE_ROLES = new Set([
	"FIELD_ENGINEER",
	"JE_SSE_TELE_SECTIONAL",
	"SSE_TELE_INCHARGE",
	"JE_SECTIONAL",
	"SSE_SECTIONAL",
	"TCM",
	"TECHNICIAN",
]);

export const getEffectiveRole = (req) =>
	req?.user?.originalRole || req?.user?.role || "";

export const isSuperAdmin = (req) => getEffectiveRole(req) === "SUPER_ADMIN";

export const isFieldScopedRole = (req) =>
	FIELD_SCOPE_ROLES.has(getEffectiveRole(req));

export const buildStationScopeClause = (req) => {
	if (!req?.user?.id) return null;
	return {
		OR: [
			{ supervisorId: req.user.id },
			{ supervisors: { some: { supervisorId: req.user.id } } },
		],
	};
};

export const buildStationVisibilityWhere = (req) => {
	if (isSuperAdmin(req)) return {};
	const where = { divisionId: req.user.divisionId };
	if (isFieldScopedRole(req)) {
		where.AND = [buildStationScopeClause(req)];
	}
	return where;
};

export const buildSubsectionVisibilityWhere = (req) => {
	if (isSuperAdmin(req)) return {};
	const where = { divisionId: req.user.divisionId };
	if (isFieldScopedRole(req)) {
		where.AND = [{ supervisorId: req.user.id }];
	}
	return where;
};

export const buildTaskVisibilityOr = ({ req, stationIds = [], subsectionIds = [] }) => {
	if (!isFieldScopedRole(req)) return [];

	const visibility = [
		{ assignedToId: req.user.id },
		{ ownerId: req.user.id },
	];

	if (stationIds.length) {
		visibility.push(
			{ failure: { stationId: { in: stationIds } } },
			{ failure: { location: { stationId: { in: stationIds } } } },
			{ maintenance: { stationId: { in: stationIds } } },
			{ maintenance: { location: { stationId: { in: stationIds } } } },
			{ trcRequest: { equipment: { stationId: { in: stationIds } } } },
		);
	}

	if (subsectionIds.length) {
		visibility.push({ maintenance: { subsectionId: { in: subsectionIds } } });
	}

	return visibility;
};
