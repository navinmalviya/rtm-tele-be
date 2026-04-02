import {
	buildStationVisibilityWhere,
	buildSubsectionVisibilityWhere,
	buildTaskVisibilityOr,
	isFieldScopedRole,
	isSuperAdmin,
} from "../lib/access-scope.js";
import prisma from "../lib/prisma.js";

const FALLBACK_ENTRY_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "TESTROOM"]);
const SECTIONAL_REMOVE_ROLES = new Set([
	"JE_SSE_TELE_SECTIONAL",
	"JE_SECTIONAL",
	"SSE_SECTIONAL",
	"FIELD_ENGINEER",
]);
const FIELD_FEED_USER_ROLES = [
	"JE_SSE_TELE_SECTIONAL",
	"SSE_TELE_INCHARGE",
	"TCM",
	"SSE_SNT_OFFICE",
	"SSE_TECH",
];

const SECTION_LABELS = {
	CORE_FAILURE: "Core Failure",
	BSNL_FCT: "BSNL/FCT",
	OFC_DEFICIENCY: "OFC Deficiency",
	QUAD6_DEFICIENCY: "6-Quad Deficiency",
	EXPOSED_CABLE: "Exposed Cable",
	WIFI_STATUS: "Wi-Fi Status",
	CCTV_STATUS: "CCTV Status",
	WT_TESTING: "Walkie-Talkie Testing",
	MOVEMENT: "JE/SSE Movement",
	NOTE: "Notes",
	OTHER: "Other",
};

const DYNAMIC_FIELD_LABELS = {
	circuitName: "Circuit Name",
	stationSection: "Station / Section",
	failureStatus: "Failure Status",
	causeDetails: "Cause Details",
	actionTaken: "Action Taken",
	serviceName: "Service Name",
	locationName: "Location",
	lineMedia: "Line Media",
	testResult: "Test Result",
	stationLocation: "Station / Location",
	ssidOrNode: "SSID / Node",
	usersImpacted: "Users Impacted",
	vendor: "Vendor",
	totalCameras: "Total Cameras",
	failedCameras: "Failed Cameras",
	sectionName: "Section Name",
	routeKm: "Route KM",
	issueType: "Issue Type",
	exposedLengthMeters: "Exposed Length (m)",
	riskLevel: "Risk Level",
	wtSetLocation: "WT Set Location",
	totalSets: "Total Sets",
	testedSets: "Tested Sets",
	failedSets: "Failed Sets",
	testStatus: "Test Status",
	officerName: "Officer Name",
	designation: "Designation",
	movementArea: "Movement Area",
	movementStart: "Movement Start",
	movementEnd: "Movement End",
	observations: "Observations",
	summary: "Summary",
	failureInTime: "Failure In Time",
	restorationTime: "Restoration Time",
	targetDate: "Target Date",
	complianceDate: "Compliance Date",
	informedTo: "Informed To",
	responsibleDept: "Responsible Department",
};

const formatEnumLabel = (value) =>
	String(value || "")
		.toLowerCase()
		.replace(/_/g, " ")
		.replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());

const parseDateOrThrow = (value, fieldName = "date") => {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new Error(`Invalid ${fieldName}`);
	}
	return date;
};

const normalizeDayRange = (dateValue) => {
	const date = dateValue
		? parseDateOrThrow(dateValue, "reportDate")
		: new Date();
	const start = new Date(date);
	start.setHours(0, 0, 0, 0);
	const end = new Date(date);
	end.setHours(23, 59, 59, 999);
	return { start, end };
};

const hasExplicitTime = (value) =>
	typeof value === "string" && value.includes("T");

const normalizeRange = ({ date, startDate, endDate }) => {
	if (date) return normalizeDayRange(date);
	const now = new Date();
	const start = startDate
		? parseDateOrThrow(startDate, "startDate")
		: new Date(now);
	const end = endDate ? parseDateOrThrow(endDate, "endDate") : new Date(now);
	if (!hasExplicitTime(startDate)) {
		start.setHours(0, 0, 0, 0);
	}
	if (!hasExplicitTime(endDate)) {
		end.setHours(23, 59, 59, 999);
	}
	if (end < start) {
		throw new Error("endDate must be same as or after startDate.");
	}
	return { start, end };
};

const safeNormalizeRange = (query = {}) => {
	try {
		return normalizeRange(query || {});
	} catch {
		return normalizeDayRange(query?.date);
	}
};

const isFallbackRole = (req) =>
	FALLBACK_ENTRY_ROLES.has(req.user?.role) ||
	FALLBACK_ENTRY_ROLES.has(req.user?.originalRole);

const isSectionalRole = (req) =>
	SECTIONAL_REMOVE_ROLES.has(req.user?.role) ||
	SECTIONAL_REMOVE_ROLES.has(req.user?.originalRole);

const getScopedStationAndSubsectionIds = async (req) => {
	if (!isFieldScopedRole(req)) {
		return { stationIds: [], subsectionIds: [] };
	}

	const [stations, subsections] = await Promise.all([
		prisma.station.findMany({
			where: buildStationVisibilityWhere(req),
			select: { id: true },
		}),
		prisma.subsection.findMany({
			where: buildSubsectionVisibilityWhere(req),
			select: { id: true },
		}),
	]);

	return {
		stationIds: stations.map((row) => row.id),
		subsectionIds: subsections.map((row) => row.id),
	};
};

const buildFailureRows = (tasks, { start, end }) => {
	const monthBuckets = new Map();
	const stationMap = new Map();
	const typeMap = new Map();
	const causeMap = new Map();
	const statusMap = new Map([
		["OPEN", 0],
		["IN_PROGRESS", 0],
		["RESOLVED", 0],
		["CLOSED", 0],
	]);

	const rows = [];
	const restorationDurations = [];
	let hqRepeated = 0;
	let icmsRepeated = 0;
	let reportedInRange = 0;
	let restoredInRange = 0;
	let openAsOfEnd = 0;

	const getMonthKey = (date) =>
		`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

	for (const task of tasks) {
		const failure = task.failure || {};
		const failureInTime = failure.failureInTime || task.createdAt;
		const restorationTime = failure.restorationTime
			? new Date(failure.restorationTime)
			: null;
		const failureDate = failureInTime ? new Date(failureInTime) : null;
		if (!failureDate || Number.isNaN(failureDate.getTime())) continue;

		const isReportedInRange = failureDate >= start && failureDate <= end;
		const isRestoredInRange =
			restorationTime &&
			!Number.isNaN(restorationTime.getTime()) &&
			restorationTime >= start &&
			restorationTime <= end;
		const isOpenAtEnd =
			failureDate <= end &&
			(task.status === "OPEN" ||
				task.status === "IN_PROGRESS" ||
				!restorationTime ||
				restorationTime > end);

		if (isReportedInRange) reportedInRange += 1;
		if (isRestoredInRange) restoredInRange += 1;
		if (isOpenAtEnd) openAsOfEnd += 1;
		if (failure.isHqRepeated) hqRepeated += 1;
		if (failure.isIcmsRepeated) icmsRepeated += 1;

		const rowIncluded = isOpenAtEnd || isReportedInRange || isRestoredInRange;
		if (!rowIncluded) continue;

		const stationName =
			failure.station?.name ||
			failure.location?.station?.name ||
			failure.location?.name ||
			"Unassigned";
		const stationKey =
			failure.stationId || failure.location?.stationId || "UNKNOWN";
		const typeKey = failure.type || "UNKNOWN";
		const causeKey = failure.cause || "UNKNOWN";

		rows.push({
			id: task.id,
			title: task.title,
			stationId: stationKey,
			station: stationName,
			type: typeKey,
			cause: causeKey,
			status: task.status || "OPEN",
			priority: task.priority || "MEDIUM",
			assignee: task.assignedTo?.name || "Unassigned",
			owner: task.owner?.name || "N/A",
			reportedAt: failureDate,
			restoredAt: restorationTime,
			informedTo: failure.informedTo || null,
			responsibleDept: failure.responsibleDept || null,
			remarks: failure.remarks || "",
			isHqRepeated: Boolean(failure.isHqRepeated),
			isIcmsRepeated: Boolean(failure.isIcmsRepeated),
		});

		statusMap.set(
			task.status || "OPEN",
			(statusMap.get(task.status || "OPEN") || 0) + 1,
		);
		stationMap.set(stationKey, {
			key: stationKey,
			label: stationName,
			value: (stationMap.get(stationKey)?.value || 0) + 1,
		});
		typeMap.set(typeKey, {
			key: typeKey,
			label: formatEnumLabel(typeKey),
			value: (typeMap.get(typeKey)?.value || 0) + 1,
		});
		causeMap.set(causeKey, {
			key: causeKey,
			label: formatEnumLabel(causeKey),
			value: (causeMap.get(causeKey)?.value || 0) + 1,
		});

		const monthKey = getMonthKey(failureDate);
		const monthBucket = monthBuckets.get(monthKey) || {
			key: monthKey,
			total: 0,
			hqRepeated: 0,
			icmsRepeated: 0,
			mttrMinutesTotal: 0,
			mttrCount: 0,
		};
		monthBucket.total += 1;
		if (failure.isHqRepeated) monthBucket.hqRepeated += 1;
		if (failure.isIcmsRepeated) monthBucket.icmsRepeated += 1;
		if (restorationTime && restorationTime > failureDate) {
			const minutes =
				(restorationTime.getTime() - failureDate.getTime()) / (1000 * 60);
			monthBucket.mttrMinutesTotal += minutes;
			monthBucket.mttrCount += 1;
			restorationDurations.push(minutes);
		}
		monthBuckets.set(monthKey, monthBucket);
	}

	rows.sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime());

	const month = Array.from(monthBuckets.values())
		.sort((a, b) => a.key.localeCompare(b.key))
		.map((bucket) => {
			const [year, monthNo] = bucket.key.split("-").map(Number);
			return {
				key: bucket.key,
				label: new Date(year, monthNo - 1, 1).toLocaleDateString("en-IN", {
					month: "short",
					year: "2-digit",
				}),
				total: bucket.total,
				hqRepeated: bucket.hqRepeated,
				icmsRepeated: bucket.icmsRepeated,
				avgMttrMinutes:
					bucket.mttrCount > 0
						? Math.round((bucket.mttrMinutesTotal / bucket.mttrCount) * 100) /
							100
						: null,
			};
		});

	const avgRestorationMinutes = restorationDurations.length
		? Math.round(
				(restorationDurations.reduce((sum, value) => sum + value, 0) /
					restorationDurations.length) *
					100,
			) / 100
		: null;

	return {
		rows,
		metrics: {
			totalFailures: rows.length,
			openAsOfEnd,
			reportedInRange,
			restoredInRange,
			hqRepeated,
			icmsRepeated,
			avgRestorationMinutes,
		},
		charts: {
			status: Array.from(statusMap.entries()).map(([key, value]) => ({
				key,
				label: formatEnumLabel(key),
				value,
			})),
			station: Array.from(stationMap.values()).sort(
				(a, b) => b.value - a.value,
			),
			type: Array.from(typeMap.values()).sort((a, b) => b.value - a.value),
			cause: Array.from(causeMap.values()).sort((a, b) => b.value - a.value),
			month,
		},
	};
};

const fetchFailureTasks = async (req, range) => {
	const where = {
		OR: [{ type: "FAILURE" }, { failure: { isNot: null } }],
		createdAt: { lte: range.end },
	};

	if (!isSuperAdmin(req)) {
		where.AND = [{ owner: { divisionId: req.user.divisionId } }];
	}

	if (isFieldScopedRole(req)) {
		const { stationIds, subsectionIds } =
			await getScopedStationAndSubsectionIds(req);
		const fieldVisibility = buildTaskVisibilityOr({
			req,
			stationIds,
			subsectionIds,
		});
		where.AND = [...(where.AND || []), { OR: fieldVisibility }];
	}

	return prisma.task.findMany({
		where,
		include: {
			owner: { select: { id: true, name: true } },
			assignedTo: { select: { id: true, name: true } },
			failure: {
				include: {
					station: { select: { id: true, name: true, code: true } },
					location: {
						select: {
							id: true,
							name: true,
							stationId: true,
							station: { select: { id: true, name: true, code: true } },
						},
					},
				},
			},
		},
		orderBy: { createdAt: "desc" },
	});
};

const buildInputVisibilityWhere = async (req, reportRange, options = {}) => {
	const { carryForward = true } = options;
	const where = {
		divisionId: req.user.divisionId,
		reportDate: carryForward
			? { lte: reportRange.end }
			: { gte: reportRange.start, lte: reportRange.end },
	};

	if (!isFieldScopedRole(req) || isFallbackRole(req)) {
		return where;
	}

	const { stationIds, subsectionIds } =
		await getScopedStationAndSubsectionIds(req);
	where.AND = [
		{
			OR: [
				{ submittedById: req.user.id },
				{ inputForUserId: req.user.id },
				...(stationIds.length ? [{ stationId: { in: stationIds } }] : []),
				...(subsectionIds.length
					? [{ subsectionId: { in: subsectionIds } }]
					: []),
			],
		},
	];

	return where;
};

const canSectionalRemoveRecord = async (req, record) => {
	if (!isSectionalRole(req)) return false;
	if (record.divisionId !== req.user.divisionId) return false;
	if (record.submittedById === req.user.id) return true;
	if (record.inputForUserId === req.user.id) return true;
	if (!isFieldScopedRole(req)) return false;

	const { stationIds, subsectionIds } =
		await getScopedStationAndSubsectionIds(req);

	if (record.stationId && stationIds.includes(record.stationId)) return true;
	if (record.subsectionId && subsectionIds.includes(record.subsectionId))
		return true;

	return false;
};

const canManageInputRecord = (req, record) => {
	if (isSuperAdmin(req)) return true;
	if (record.divisionId !== req.user.divisionId) return false;
	if (isFallbackRole(req)) return true;
	return record.submittedById === req.user.id;
};

const sanitizeDynamicFields = (value) => {
	if (value === undefined) return undefined;
	if (value === null || value === "") return null;

	let parsed = value;
	if (typeof parsed === "string") {
		try {
			parsed = JSON.parse(parsed);
		} catch {
			throw new Error("dynamicFields must be a valid JSON object.");
		}
	}

	if (typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error("dynamicFields must be an object.");
	}

	const cleaned = {};
	for (const [key, fieldValue] of Object.entries(parsed)) {
		if (fieldValue === undefined || fieldValue === null) continue;
		if (typeof fieldValue === "string") {
			const trimmed = fieldValue.trim();
			if (!trimmed) continue;
			cleaned[key] = trimmed;
			continue;
		}
		cleaned[key] = fieldValue;
	}

	return Object.keys(cleaned).length ? cleaned : null;
};

const dynamicValueToText = (value) => {
	if (value === null || value === undefined) return "";
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (Array.isArray(value)) {
		return value
			.map((item) => dynamicValueToText(item))
			.filter(Boolean)
			.join(", ");
	}
	if (typeof value === "object") {
		return Object.entries(value)
			.map(
				([key, childValue]) =>
					`${formatEnumLabel(key)}: ${dynamicValueToText(childValue)}`,
			)
			.filter(Boolean)
			.join("; ");
	}
	return String(value);
};

const buildDetailsFromDynamicFields = (dynamicFields) => {
	if (!dynamicFields || typeof dynamicFields !== "object") return "";
	const lines = Object.entries(dynamicFields)
		.map(([key, value]) => {
			const text = dynamicValueToText(value).trim();
			if (!text) return "";
			const label = DYNAMIC_FIELD_LABELS[key] || formatEnumLabel(key);
			return `${label}: ${text}`;
		})
		.filter(Boolean);
	return lines.join("\n");
};

const deriveTitleFromDynamicFields = (sectionType, dynamicFields) => {
	if (!dynamicFields || typeof dynamicFields !== "object") return "";
	const candidateKeys = [
		"summary",
		"circuitName",
		"serviceName",
		"ssidOrNode",
		"locationName",
		"stationLocation",
		"sectionName",
		"movementArea",
	];
	for (const key of candidateKeys) {
		const value = dynamicFields[key];
		if (typeof value === "string" && value.trim()) {
			return value.trim().slice(0, 120);
		}
	}
	const sectionLabel =
		SECTION_LABELS[sectionType] || formatEnumLabel(sectionType);
	return `${sectionLabel} update`;
};

const sanitizePayload = (payload) => ({
	sectionType: payload.sectionType,
	entryTitle:
		payload.entryTitle !== undefined
			? String(payload.entryTitle || "").trim()
			: undefined,
	entryDetails:
		payload.entryDetails !== undefined
			? String(payload.entryDetails || "").trim()
			: undefined,
	entryStatus:
		payload.entryStatus !== undefined
			? payload.entryStatus
				? String(payload.entryStatus).trim()
				: null
			: undefined,
	failureInTime:
		payload.failureInTime !== undefined
			? payload.failureInTime
				? parseDateOrThrow(payload.failureInTime, "failureInTime")
				: null
			: undefined,
	restorationTime:
		payload.restorationTime !== undefined
			? payload.restorationTime
				? parseDateOrThrow(payload.restorationTime, "restorationTime")
				: null
			: undefined,
	targetDate:
		payload.targetDate !== undefined
			? payload.targetDate
				? parseDateOrThrow(payload.targetDate, "targetDate")
				: null
			: undefined,
	complianceDate:
		payload.complianceDate !== undefined
			? payload.complianceDate
				? parseDateOrThrow(payload.complianceDate, "complianceDate")
				: null
			: undefined,
	informedTo:
		payload.informedTo !== undefined
			? payload.informedTo
				? String(payload.informedTo).trim()
				: null
			: undefined,
	responsibleDept:
		payload.responsibleDept !== undefined
			? payload.responsibleDept
				? String(payload.responsibleDept).trim()
				: null
			: undefined,
	sourceType:
		payload.sourceType !== undefined
			? String(payload.sourceType || "").trim()
			: undefined,
	sourceContactName:
		payload.sourceContactName !== undefined
			? payload.sourceContactName
				? String(payload.sourceContactName).trim()
				: null
			: undefined,
	sourceContactDesignation:
		payload.sourceContactDesignation !== undefined
			? payload.sourceContactDesignation
				? String(payload.sourceContactDesignation).trim()
				: null
			: undefined,
	sourceContactChannel:
		payload.sourceContactChannel !== undefined
			? payload.sourceContactChannel
				? String(payload.sourceContactChannel).trim()
				: null
			: undefined,
	dynamicFields: sanitizeDynamicFields(payload.dynamicFields),
});

const validateStationScopeForFieldUser = async ({
	req,
	stationId,
	subsectionId,
}) => {
	if (!isFieldScopedRole(req) || isFallbackRole(req)) return;
	const { stationIds, subsectionIds } =
		await getScopedStationAndSubsectionIds(req);

	if (stationId && !stationIds.includes(stationId)) {
		throw new Error("Selected station is outside your jurisdiction.");
	}
	if (subsectionId && !subsectionIds.includes(subsectionId)) {
		throw new Error("Selected subsection is outside your jurisdiction.");
	}
};

const csvEscape = (value) => {
	if (value === null || value === undefined) return "";
	const text = String(value);
	if (/[",\n]/.test(text)) {
		return `"${text.replace(/"/g, '""')}"`;
	}
	return text;
};

const dateToIso = (value) => {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toISOString();
};

const durationLabel = (minutes) => {
	if (!Number.isFinite(minutes) || minutes <= 0) return "N/A";
	const totalMinutes = Math.round(minutes);
	const hours = Math.floor(totalMinutes / 60);
	const mins = totalMinutes % 60;
	return `${hours}h ${mins}m`;
};

const getReportInputs = async (req, range, options = {}) => {
	const where = await buildInputVisibilityWhere(req, range, {
		carryForward: true,
	});
	if (options.sectionType) where.sectionType = options.sectionType;

	return prisma.dailyReportInput.findMany({
		where,
		include: {
			station: { select: { id: true, name: true, code: true } },
			subsection: { select: { id: true, name: true, code: true } },
			submittedBy: { select: { id: true, name: true, designation: true } },
		},
		orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
	});
};

export const getDailyReportDashboard = async (req, res) => {
	try {
		const range = safeNormalizeRange(req.query || {});
		let failureTasks = [];
		try {
			failureTasks = await fetchFailureTasks(req, range);
		} catch (failureError) {
			console.error("daily-report dashboard failure fetch failed:", failureError?.message);
		}
		let inputs = [];
		try {
			inputs = await getReportInputs(req, range);
		} catch (inputError) {
			console.error("daily-report dashboard input fetch failed:", inputError?.message);
		}

		const failureBundle = buildFailureRows(failureTasks, range);

		const inputSectionCounts = new Map();
		for (const entry of inputs) {
			const sectionKey = entry.sectionType;
			inputSectionCounts.set(sectionKey, {
				key: sectionKey,
				label: SECTION_LABELS[sectionKey] || formatEnumLabel(sectionKey),
				value: (inputSectionCounts.get(sectionKey)?.value || 0) + 1,
			});
		}

		return res.status(200).json({
			range: {
				startDate: range.start.toISOString(),
				endDate: range.end.toISOString(),
			},
			summary: failureBundle.metrics,
			charts: failureBundle.charts,
			failureRows: failureBundle.rows,
			inputSectionCounts: Array.from(inputSectionCounts.values()).sort(
				(a, b) => b.value - a.value,
			),
			inputs,
		});
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const listDailyReportInputs = async (req, res) => {
	try {
		const range = safeNormalizeRange(req.query || {});
		const inputs = await getReportInputs(req, range, {
			sectionType: req.query?.sectionType,
		});
		return res.status(200).json(inputs);
	} catch (error) {
		console.error("daily-report inputs fetch failed:", error?.message);
		return res.status(200).json([]);
	}
};

export const createDailyReportInput = async (req, res) => {
	try {
		const payload = sanitizePayload(req.body || {});
		const entryTitle =
			payload.entryTitle ||
			deriveTitleFromDynamicFields(payload.sectionType, payload.dynamicFields);
		const entryDetails =
			payload.entryDetails ||
			buildDetailsFromDynamicFields(payload.dynamicFields);
		if (!payload.sectionType || !entryTitle || !entryDetails) {
			return res.status(400).json({
				message:
					"sectionType is required and at least one meaningful summary/detail value must be provided.",
			});
		}

		const reportDay = normalizeDayRange(req.body?.reportDate);
		const reportDate = reportDay.start;
		const stationId = req.body?.stationId || null;
		const subsectionId = req.body?.subsectionId || null;

		await validateStationScopeForFieldUser({ req, stationId, subsectionId });

		let inputForUserId = req.body?.inputForUserId || null;
		let isFallbackEntry = Boolean(req.body?.isFallbackEntry);
		const sourceType = payload.sourceType || "FIELD_APP";

		if (!isFallbackRole(req)) {
			inputForUserId = req.user.id;
			isFallbackEntry = false;
		} else if (inputForUserId) {
			const assignee = await prisma.user.findFirst({
				where: {
					id: inputForUserId,
					...(isSuperAdmin(req) ? {} : { divisionId: req.user.divisionId }),
				},
				select: { id: true },
			});
			if (!assignee) {
				return res
					.status(400)
					.json({ message: "Invalid on-behalf user selection." });
			}
		}

		if (isFallbackEntry || sourceType !== "FIELD_APP") {
			if (!payload.sourceContactName || !payload.sourceContactDesignation) {
				return res.status(400).json({
					message:
						"sourceContactName and sourceContactDesignation are required for fallback/manual entries.",
				});
			}
		}

		const entry = await prisma.dailyReportInput.create({
			data: {
				divisionId: req.user.divisionId,
				reportDate,
				sectionType: payload.sectionType,
				stationId,
				subsectionId,
				entryTitle,
				entryDetails,
				entryStatus: payload.entryStatus,
				failureInTime: payload.failureInTime,
				restorationTime: payload.restorationTime,
				targetDate: payload.targetDate,
				complianceDate: payload.complianceDate,
				informedTo: payload.informedTo,
				responsibleDept: payload.responsibleDept,
				isFallbackEntry,
				sourceType,
				sourceContactName: payload.sourceContactName,
				sourceContactDesignation: payload.sourceContactDesignation,
				sourceContactChannel: payload.sourceContactChannel,
				dynamicFields: payload.dynamicFields,
				submittedById: req.user.id,
				inputForUserId,
			},
			include: {
				station: { select: { id: true, name: true, code: true } },
				subsection: { select: { id: true, name: true, code: true } },
				submittedBy: { select: { id: true, name: true, designation: true } },
				inputForUser: { select: { id: true, name: true, designation: true } },
			},
		});

		return res.status(201).json({
			message: "Daily report input saved.",
			entry,
		});
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const updateDailyReportInput = async (req, res) => {
	try {
		const record = await prisma.dailyReportInput.findUnique({
			where: { id: req.params.id },
		});
		if (!record) return res.status(404).json({ message: "Entry not found." });
		if (!canManageInputRecord(req, record)) {
			return res.status(403).json({ message: "Forbidden" });
		}

		const payload = sanitizePayload(req.body || {});
		const stationId =
			req.body?.stationId !== undefined
				? req.body.stationId || null
				: record.stationId;
		const subsectionId =
			req.body?.subsectionId !== undefined
				? req.body.subsectionId || null
				: record.subsectionId;

		await validateStationScopeForFieldUser({ req, stationId, subsectionId });

		let inputForUserId =
			req.body?.inputForUserId !== undefined
				? req.body.inputForUserId || null
				: record.inputForUserId;
		let isFallbackEntry =
			req.body?.isFallbackEntry !== undefined
				? Boolean(req.body.isFallbackEntry)
				: record.isFallbackEntry;

		if (!isFallbackRole(req)) {
			inputForUserId = req.user.id;
			isFallbackEntry = false;
		}
		const mergedSourceType =
			payload.sourceType || record.sourceType || "FIELD_APP";
		const mergedSectionType = payload.sectionType || record.sectionType;
		const mergedDynamicFields =
			payload.dynamicFields !== undefined
				? payload.dynamicFields
				: record.dynamicFields;
		const mergedEntryTitle =
			payload.entryTitle !== undefined ? payload.entryTitle : record.entryTitle;
		const mergedEntryDetails =
			payload.entryDetails !== undefined
				? payload.entryDetails
				: record.entryDetails;
		const finalEntryTitle =
			mergedEntryTitle ||
			deriveTitleFromDynamicFields(mergedSectionType, mergedDynamicFields);
		const finalEntryDetails =
			mergedEntryDetails || buildDetailsFromDynamicFields(mergedDynamicFields);
		if (!finalEntryTitle || !finalEntryDetails) {
			return res.status(400).json({
				message:
					"At least one meaningful summary/detail value is required to update the entry.",
			});
		}

		if (isFallbackEntry || mergedSourceType !== "FIELD_APP") {
			const sourceContactName =
				payload.sourceContactName ?? record.sourceContactName;
			const sourceContactDesignation =
				payload.sourceContactDesignation ?? record.sourceContactDesignation;
			if (!sourceContactName || !sourceContactDesignation) {
				return res.status(400).json({
					message:
						"sourceContactName and sourceContactDesignation are required for fallback/manual entries.",
				});
			}
		}

		const data = {
			sectionType: mergedSectionType,
			stationId,
			subsectionId,
			entryTitle: finalEntryTitle,
			entryDetails: finalEntryDetails,
			entryStatus:
				payload.entryStatus !== undefined
					? payload.entryStatus
					: record.entryStatus,
			failureInTime:
				payload.failureInTime !== undefined
					? payload.failureInTime
					: record.failureInTime,
			restorationTime:
				payload.restorationTime !== undefined
					? payload.restorationTime
					: record.restorationTime,
			targetDate:
				payload.targetDate !== undefined
					? payload.targetDate
					: record.targetDate,
			complianceDate:
				payload.complianceDate !== undefined
					? payload.complianceDate
					: record.complianceDate,
			informedTo:
				payload.informedTo !== undefined
					? payload.informedTo
					: record.informedTo,
			responsibleDept:
				payload.responsibleDept !== undefined
					? payload.responsibleDept
					: record.responsibleDept,
			isFallbackEntry,
			sourceType: mergedSourceType,
			sourceContactName:
				payload.sourceContactName !== undefined
					? payload.sourceContactName
					: record.sourceContactName,
			sourceContactDesignation:
				payload.sourceContactDesignation !== undefined
					? payload.sourceContactDesignation
					: record.sourceContactDesignation,
			sourceContactChannel:
				payload.sourceContactChannel !== undefined
					? payload.sourceContactChannel
					: record.sourceContactChannel,
			dynamicFields: mergedDynamicFields,
			inputForUserId,
		};

		const entry = await prisma.dailyReportInput.update({
			where: { id: req.params.id },
			data,
			include: {
				station: { select: { id: true, name: true, code: true } },
				subsection: { select: { id: true, name: true, code: true } },
				submittedBy: { select: { id: true, name: true, designation: true } },
				inputForUser: { select: { id: true, name: true, designation: true } },
			},
		});

		return res.status(200).json({ message: "Entry updated.", entry });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const deleteDailyReportInput = async (req, res) => {
	try {
		const record = await prisma.dailyReportInput.findUnique({
			where: { id: req.params.id },
		});
		if (!record) return res.status(404).json({ message: "Entry not found." });
		if (!(await canSectionalRemoveRecord(req, record))) {
			return res.status(403).json({
				message:
					"Only sectional JE/SSE can remove carry-forward input entries within their jurisdiction.",
			});
		}

		await prisma.dailyReportInput.delete({ where: { id: req.params.id } });
		return res.status(200).json({ message: "Entry deleted." });
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const getDailyInputCoverage = async (req, res) => {
	try {
		if (!isFallbackRole(req) && !isSuperAdmin(req)) {
			return res.status(403).json({ message: "Forbidden" });
		}
		const range = safeNormalizeRange(req.query || {});
		const whereDivision = isSuperAdmin(req)
			? {}
			: { divisionId: req.user.divisionId };
		const [users, inputs] = await Promise.all([
			prisma.user.findMany({
				where: {
					...whereDivision,
					role: { in: FIELD_FEED_USER_ROLES },
				},
				select: {
					id: true,
					name: true,
					designation: true,
					role: true,
					unit: true,
				},
				orderBy: { name: "asc" },
			}),
			prisma.dailyReportInput.findMany({
				where: {
					divisionId: req.user.divisionId,
					reportDate: { gte: range.start, lte: range.end },
				},
				select: {
					id: true,
					submittedById: true,
					inputForUserId: true,
				},
			}),
		]);

		const counts = new Map();
		for (const row of inputs) {
			const ownerId = row.inputForUserId || row.submittedById;
			counts.set(ownerId, (counts.get(ownerId) || 0) + 1);
		}

		const coverage = users.map((user) => {
			const count = counts.get(user.id) || 0;
			return {
				userId: user.id,
				name: user.name,
				designation: user.designation,
				role: user.role,
				unit: user.unit,
				entryCount: count,
				status: count > 0 ? "SUBMITTED" : "MISSING",
			};
		});

		return res.status(200).json(coverage);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

const buildExportCsv = ({ dateLabel, summary, failureRows, inputs }) => {
	const lines = [];
	lines.push(csvEscape("Daily Telecom Position Report"));
	lines.push(csvEscape(`Report Range: ${dateLabel}`));
	lines.push("");
	lines.push("Summary Metric,Value");
	lines.push(`Total Failures,${summary.totalFailures}`);
	lines.push(`Open As Of End,${summary.openAsOfEnd}`);
	lines.push(`Reported In Range,${summary.reportedInRange}`);
	lines.push(`Restored In Range,${summary.restoredInRange}`);
	lines.push(`HQ Repeated,${summary.hqRepeated}`);
	lines.push(`ICMS Repeated,${summary.icmsRepeated}`);
	lines.push(`Avg Restoration (mins),${summary.avgRestorationMinutes ?? ""}`);
	lines.push("");
	lines.push(
		[
			"Failure ID",
			"Title",
			"Station",
			"Type",
			"Cause",
			"Status",
			"Priority",
			"Assignee",
			"Reported At",
			"Restored At",
			"Informed To",
			"Responsible Dept",
			"HQ Repeated",
			"ICMS Repeated",
			"Remarks",
		].join(","),
	);

	for (const row of failureRows) {
		lines.push(
			[
				csvEscape(row.id),
				csvEscape(row.title),
				csvEscape(row.station),
				csvEscape(formatEnumLabel(row.type)),
				csvEscape(formatEnumLabel(row.cause)),
				csvEscape(formatEnumLabel(row.status)),
				csvEscape(formatEnumLabel(row.priority)),
				csvEscape(row.assignee),
				csvEscape(dateToIso(row.reportedAt)),
				csvEscape(dateToIso(row.restoredAt)),
				csvEscape(row.informedTo),
				csvEscape(row.responsibleDept),
				csvEscape(row.isHqRepeated ? "YES" : "NO"),
				csvEscape(row.isIcmsRepeated ? "YES" : "NO"),
				csvEscape(row.remarks),
			].join(","),
		);
	}

	lines.push("");
	lines.push(
		[
			"Input ID",
			"Section",
			"Title",
			"Station",
			"Subsection",
			"Status",
			"Failure In",
			"Restoration",
			"Target",
			"Compliance",
			"Submitted By",
			"On Behalf Of",
			"Source",
			"Source Contact",
			"Structured Details",
			"Details",
		].join(","),
	);

	for (const entry of inputs) {
		lines.push(
			[
				csvEscape(entry.id),
				csvEscape(
					SECTION_LABELS[entry.sectionType] ||
						formatEnumLabel(entry.sectionType),
				),
				csvEscape(entry.entryTitle),
				csvEscape(entry.station?.name || ""),
				csvEscape(entry.subsection?.name || ""),
				csvEscape(entry.entryStatus || ""),
				csvEscape(dateToIso(entry.failureInTime)),
				csvEscape(dateToIso(entry.restorationTime)),
				csvEscape(dateToIso(entry.targetDate)),
				csvEscape(dateToIso(entry.complianceDate)),
				csvEscape(entry.submittedBy?.name || ""),
				csvEscape(entry.inputForUser?.name || ""),
				csvEscape(formatEnumLabel(entry.sourceType)),
				csvEscape(
					[entry.sourceContactName, entry.sourceContactDesignation]
						.filter(Boolean)
						.join(" / "),
				),
				csvEscape(buildDetailsFromDynamicFields(entry.dynamicFields)),
				csvEscape(entry.entryDetails),
			].join(","),
		);
	}

	return lines.join("\n");
};

const buildGraphicalHtml = ({
	dateLabel,
	summary,
	charts,
	failureRows,
	inputs,
}) => {
	const statusMax = Math.max(
		1,
		...(charts.status || []).map((item) => item.value || 0),
	);
	const stationMax = Math.max(
		1,
		...(charts.station || []).map((item) => item.value || 0),
	);

	const statusRows = (charts.status || [])
		.map(
			(item) => `
				<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
					<div style="width:160px;font-size:13px;color:#111827;">${item.label}</div>
					<div style="flex:1;background:#e5e7eb;border-radius:999px;height:10px;overflow:hidden;">
						<div style="height:10px;border-radius:999px;background:#2563eb;width:${Math.round(
							(item.value / statusMax) * 100,
						)}%;"></div>
					</div>
					<div style="width:36px;text-align:right;font-weight:700;font-size:13px;">${item.value}</div>
				</div>
			`,
		)
		.join("");

	const stationRows = (charts.station || [])
		.slice(0, 10)
		.map(
			(item) => `
				<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
					<div style="width:180px;font-size:13px;color:#111827;">${item.label}</div>
					<div style="flex:1;background:#f3f4f6;border-radius:999px;height:10px;overflow:hidden;">
						<div style="height:10px;border-radius:999px;background:#059669;width:${Math.round(
							(item.value / stationMax) * 100,
						)}%;"></div>
					</div>
					<div style="width:36px;text-align:right;font-weight:700;font-size:13px;">${item.value}</div>
				</div>
			`,
		)
		.join("");

	return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Daily Telecom Position - ${dateLabel}</title>
</head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;padding:24px;">
  <h1 style="margin:0 0 6px;">Daily Telecom Position</h1>
  <div style="font-size:14px;color:#475569;margin-bottom:18px;">Report Date: ${dateLabel}</div>

  <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px;">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;">
      <div style="font-size:12px;color:#64748b;">Total Failures</div>
      <div style="font-size:24px;font-weight:700;">${summary.totalFailures}</div>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;">
      <div style="font-size:12px;color:#64748b;">Open As Of End</div>
      <div style="font-size:24px;font-weight:700;">${summary.openAsOfEnd}</div>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;">
      <div style="font-size:12px;color:#64748b;">HQ / ICMS Repeated</div>
      <div style="font-size:24px;font-weight:700;">${summary.hqRepeated} / ${summary.icmsRepeated}</div>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;">
      <div style="font-size:12px;color:#64748b;">Avg Restoration</div>
      <div style="font-size:24px;font-weight:700;">${durationLabel(summary.avgRestorationMinutes)}</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px;">
    <section style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;">
      <h3 style="margin:0 0 12px;">Status Distribution</h3>
      ${statusRows || '<div style="color:#64748b;">No data</div>'}
    </section>
    <section style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;">
      <h3 style="margin:0 0 12px;">Top Station Failures</h3>
      ${stationRows || '<div style="color:#64748b;">No data</div>'}
    </section>
  </div>

  <section style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:18px;">
    <h3 style="margin:0 0 12px;">Failure Register</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="text-align:left;padding:8px;border-bottom:1px solid #e2e8f0;">Title</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid #e2e8f0;">Station</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid #e2e8f0;">Type</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid #e2e8f0;">Status</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid #e2e8f0;">Reported</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid #e2e8f0;">Restored</th>
        </tr>
      </thead>
      <tbody>
        ${failureRows
					.slice(0, 150)
					.map(
						(row) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${row.title || "-"}</td>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${row.station || "-"}</td>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${formatEnumLabel(row.type)}</td>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${formatEnumLabel(row.status)}</td>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${dateToIso(row.reportedAt) || "-"}</td>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${dateToIso(row.restoredAt) || "-"}</td>
          </tr>
        `,
					)
					.join("")}
      </tbody>
    </table>
  </section>

  <section style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;">
    <h3 style="margin:0 0 12px;">Field Daily Inputs</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="text-align:left;padding:8px;border-bottom:1px solid #e2e8f0;">Section</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid #e2e8f0;">Title</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid #e2e8f0;">Station/Subsection</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid #e2e8f0;">Submitted By</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid #e2e8f0;">Source</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid #e2e8f0;">Details</th>
        </tr>
      </thead>
      <tbody>
        ${inputs
					.slice(0, 200)
					.map(
						(entry) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${
							SECTION_LABELS[entry.sectionType] ||
							formatEnumLabel(entry.sectionType)
						}</td>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${entry.entryTitle || "-"}</td>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${
							entry.station?.name || entry.subsection?.name || "-"
						}</td>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${
							entry.inputForUser?.name || entry.submittedBy?.name || "-"
						}</td>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${formatEnumLabel(
							entry.sourceType,
						)}</td>
            <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${
							buildDetailsFromDynamicFields(entry.dynamicFields) ||
							entry.entryDetails ||
							"-"
						}</td>
          </tr>
        `,
					)
					.join("")}
      </tbody>
    </table>
  </section>
</body>
</html>`;
};

export const exportDailyReport = async (req, res) => {
	try {
		const range = safeNormalizeRange(req.query || {});
		const format =
			String(req.query?.format || "excel").toLowerCase() === "graphical"
				? "GRAPHICAL"
				: "EXCEL";

		let failureTasks = [];
		let inputs = [];
		try {
			failureTasks = await fetchFailureTasks(req, range);
		} catch (failureError) {
			console.error("daily-report export failure fetch failed:", failureError?.message);
		}
		try {
			inputs = await getReportInputs(req, range);
		} catch (inputError) {
			console.error("daily-report export input fetch failed:", inputError?.message);
		}

		const bundle = buildFailureRows(failureTasks, range);
		const startLabel = range.start.toLocaleDateString("en-IN");
		const endLabel = range.end.toLocaleDateString("en-IN");
		const dateLabel =
			startLabel === endLabel ? startLabel : `${startLabel} to ${endLabel}`;
		const fileDateRange = `${range.start.toISOString().slice(0, 10)}_to_${range.end.toISOString().slice(0, 10)}`;

		await prisma.dailyReportRun.create({
			data: {
				divisionId: req.user.divisionId,
				reportDate: range.end,
				format,
				generatedById: req.user.id,
				entryCount: inputs.length,
				failureCount: bundle.rows.length,
				filters: {
					startDate: range.start.toISOString(),
					endDate: range.end.toISOString(),
				},
				summary: bundle.metrics,
				fileName:
					format === "EXCEL"
						? `daily-telecom-position-${fileDateRange}.csv`
						: `daily-telecom-position-${fileDateRange}.html`,
			},
		});

		if (format === "EXCEL") {
			const csv = buildExportCsv({
				dateLabel,
				summary: bundle.metrics,
				failureRows: bundle.rows,
				inputs,
			});
			res.setHeader(
				"Cache-Control",
				"no-store, no-cache, must-revalidate, proxy-revalidate",
			);
			res.setHeader("Pragma", "no-cache");
			res.setHeader("Expires", "0");
			res.setHeader("Content-Type", "text/csv; charset=utf-8");
			res.setHeader(
				"Content-Disposition",
				`attachment; filename="daily-telecom-position-${fileDateRange}.csv"`,
			);
			return res.status(200).send(csv);
		}

		const html = buildGraphicalHtml({
			dateLabel,
			summary: bundle.metrics,
			charts: bundle.charts,
			failureRows: bundle.rows,
			inputs,
		});
		res.setHeader(
			"Cache-Control",
			"no-store, no-cache, must-revalidate, proxy-revalidate",
		);
		res.setHeader("Pragma", "no-cache");
		res.setHeader("Expires", "0");
		res.setHeader("Content-Type", "text/html; charset=utf-8");
		res.setHeader(
			"Content-Disposition",
			`attachment; filename="daily-telecom-position-${fileDateRange}.html"`,
		);
		return res.status(200).send(html);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};

export const listDailyReportRuns = async (req, res) => {
	try {
		const where = {
			divisionId: req.user.divisionId,
		};
		if (req.query?.date || req.query?.startDate || req.query?.endDate) {
			const range = safeNormalizeRange(req.query || {});
			where.reportDate = { gte: range.start, lte: range.end };
		}
		const runs = await prisma.dailyReportRun.findMany({
			where,
			include: {
				generatedBy: { select: { id: true, name: true, designation: true } },
			},
			orderBy: { createdAt: "desc" },
			take: 100,
		});
		return res.status(200).json(runs);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
};
