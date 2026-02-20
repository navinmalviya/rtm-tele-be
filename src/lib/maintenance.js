export const addFrequency = (date, frequency) => {
	const d = new Date(date);
	switch (frequency) {
		case "DAILY":
			d.setDate(d.getDate() + 1);
			break;
		case "WEEKLY":
			d.setDate(d.getDate() + 7);
			break;
		case "MONTHLY":
			d.setMonth(d.getMonth() + 1);
			break;
		case "QUARTERLY":
			d.setMonth(d.getMonth() + 3);
			break;
		case "HALFYEARLY":
			d.setMonth(d.getMonth() + 6);
			break;
		case "YEARLY":
			d.setFullYear(d.getFullYear() + 1);
			break;
		default:
			d.setMonth(d.getMonth() + 1);
	}
	return d;
};

export const normalizeRemindBeforeDays = (value) => {
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed)) return 3;
	return Math.max(0, Math.min(parsed, 30));
};
