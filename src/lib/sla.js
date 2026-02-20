export const SLA_HOURS_BY_PRIORITY = {
	CRITICAL: 2,
	HIGH: 6,
	MEDIUM: 24,
	LOW: 72,
};

export const ESCALATION_MAX_LEVEL = 5;
export const ESCALATION_INTERVAL_HOURS = 4;

export const normalizePriority = (priority) => {
	if (!priority) return 'MEDIUM';
	const key = String(priority).toUpperCase();
	return SLA_HOURS_BY_PRIORITY[key] ? key : 'MEDIUM';
};

export const computeSlaDueAt = (reportedAt, priority) => {
	const normalized = normalizePriority(priority);
	const hours = SLA_HOURS_BY_PRIORITY[normalized];
	return new Date(reportedAt.getTime() + hours * 60 * 60 * 1000);
};

export const computeNextEscalationAt = (fromTime) => {
	return new Date(fromTime.getTime() + ESCALATION_INTERVAL_HOURS * 60 * 60 * 1000);
};
