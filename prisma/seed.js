import bcrypt from "bcrypt";
import prisma from "../src/lib/prisma.js";

const COMMON_PASSWORD = "railway123";

const FAILURE_TYPES = [
	"AXLE_COUTER",
	"DATA_LOGGER",
	"VHF",
	"GPS_CLOCK",
	"BLOCK",
	"SECTION_CONTROL",
	"TPC_CONTROL",
	"SI_CONTROL",
	"UTN",
	"FOIS",
	"AUTO_PHONE",
	"RAILNET",
	"CMS_SERVER",
	"CGDB_BOARD",
	"PA_SYSTEM",
	"FARE_TERMINAL",
	"FCT_STD_PHONE",
	"MISC",
];

const FAILURE_CAUSES = [
	"EQUIPMENT_FAILURE",
	"PATCH_CORD_FAILURE",
	"CABLE_CUT",
	"CABLE_DAMAGED",
	"PORT_FAILURE",
	"KRONE_FAILURE",
	"WAGO_FAILURE",
	"LOW_INSULATION",
	"HIGH_LOSS",
];

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const TRACK_LAYOUT = [
	{
		code: "RTM",
		name: "Ratlam",
		km: 0,
		mapX: 0,
		mapY: 160,
	},
	{
		code: "MRN",
		name: "Morwani",
		km: 10,
		mapX: 220,
		mapY: 160,
	},
	{
		code: "BILD",
		name: "Bildi",
		km: 22,
		mapX: 430,
		mapY: 160,
	},
	{
		code: "NAD",
		name: "Namli",
		km: 35,
		mapX: 650,
		mapY: 160,
	},
	{
		code: "RTI",
		name: "Raoti",
		km: 50,
		mapX: 900,
		mapY: 160,
	},
];

const toUuid = (num) =>
	`00000000-0000-4000-8000-${num.toString(16).padStart(12, "0")}`;

const daysAgo = (days, hours = 0, minutes = 0) => {
	const dt = new Date();
	dt.setDate(dt.getDate() - days);
	dt.setHours(hours, minutes, 0, 0);
	return dt;
};

const addMinutes = (date, mins) => new Date(date.getTime() + mins * 60 * 1000);

const addHours = (date, hours) =>
	new Date(date.getTime() + hours * 60 * 60 * 1000);

const ensureDivision = async ({ zoneId, code, name }) => {
	const existing = await prisma.division.findFirst({
		where: { zoneId, code },
	});
	if (existing) {
		return prisma.division.update({
			where: { id: existing.id },
			data: { name, code, zoneId },
		});
	}
	return prisma.division.create({ data: { name, code, zoneId } });
};

const ensureSection = async ({ divisionId, code, name }) => {
	const existing = await prisma.section.findFirst({
		where: { divisionId, code },
	});
	if (existing) {
		return prisma.section.update({
			where: { id: existing.id },
			data: { name, code, divisionId },
		});
	}
	return prisma.section.create({ data: { name, code, divisionId } });
};

const upsertTaskHistory = async ({
	id,
	taskId,
	actorId,
	action,
	fromValue = null,
	toValue = null,
	details = null,
	createdAt,
}) => {
	await prisma.taskHistory.upsert({
		where: { id },
		update: {
			taskId,
			actorId,
			action,
			fromValue,
			toValue,
			details,
			createdAt,
		},
		create: {
			id,
			taskId,
			actorId,
			action,
			fromValue,
			toValue,
			details,
			createdAt,
		},
	});
};

async function main() {
	console.log("--- Starting demo data seed for dashboard ---");
	const passwordHash = await bcrypt.hash(COMMON_PASSWORD, 10);

	// 1) Zone/Division/Section
	const zone = await prisma.zone.upsert({
		where: { code: "WR" },
		update: { name: "Western Railway" },
		create: { code: "WR", name: "Western Railway" },
	});

	const division = await ensureDivision({
		zoneId: zone.id,
		code: "RTM",
		name: "Ratlam Division",
	});

	const section = await ensureSection({
		divisionId: division.id,
		code: "RTM-RTI",
		name: "Ratlam - Raoti Main Section",
	});

	// 2) Users
	const superAdmin = await prisma.user.upsert({
		where: { username: "superadmin" },
		update: {
			name: "System Super Admin",
			email: "superadmin@railway.gov.in",
			password: passwordHash,
			role: "SUPER_ADMIN",
			designation: "Super Admin",
			divisionId: division.id,
			inchargeId: null,
		},
		create: {
			name: "System Super Admin",
			username: "superadmin",
			email: "superadmin@railway.gov.in",
			password: passwordHash,
			role: "SUPER_ADMIN",
			designation: "Super Admin",
			divisionId: division.id,
		},
	});

	const admin = await prisma.user.upsert({
		where: { username: "admin_rtm" },
		update: {
			name: "Division Admin RTM",
			email: "admin_rtm@railway.gov.in",
			password: passwordHash,
			role: "ADMIN",
			designation: "Division IT Admin",
			divisionId: division.id,
			inchargeId: superAdmin.id,
		},
		create: {
			name: "Division Admin RTM",
			username: "admin_rtm",
			email: "admin_rtm@railway.gov.in",
			password: passwordHash,
			role: "ADMIN",
			designation: "Division IT Admin",
			divisionId: division.id,
			inchargeId: superAdmin.id,
		},
	});

	const testroom = await prisma.user.upsert({
		where: { username: "testroom_rtm" },
		update: {
			name: "RTM Testroom",
			email: "testroom_rtm@railway.gov.in",
			password: passwordHash,
			role: "TESTROOM",
			designation: "Testroom Controller",
			divisionId: division.id,
			inchargeId: admin.id,
		},
		create: {
			name: "RTM Testroom",
			username: "testroom_rtm",
			email: "testroom_rtm@railway.gov.in",
			password: passwordHash,
			role: "TESTROOM",
			designation: "Testroom Controller",
			divisionId: division.id,
			inchargeId: admin.id,
		},
	});

	const sseIncharge = await prisma.user.upsert({
		where: { username: "sse_incharge_rtm" },
		update: {
			name: "SSE Telecom Incharge RTM",
			email: "sse_incharge_rtm@railway.gov.in",
			password: passwordHash,
			role: "SSE_TELE_INCHARGE",
			designation: "SSE/Tele/Incharge",
			divisionId: division.id,
			inchargeId: testroom.id,
		},
		create: {
			name: "SSE Telecom Incharge RTM",
			username: "sse_incharge_rtm",
			email: "sse_incharge_rtm@railway.gov.in",
			password: passwordHash,
			role: "SSE_TELE_INCHARGE",
			designation: "SSE/Tele/Incharge",
			divisionId: division.id,
			inchargeId: testroom.id,
		},
	});

	const jeSectional = await prisma.user.upsert({
		where: { username: "je_sectional_rtm" },
		update: {
			name: "JE Telecom Sectional RTM",
			email: "je_sectional_rtm@railway.gov.in",
			password: passwordHash,
			role: "JE_SSE_TELE_SECTIONAL",
			designation: "JE/Tele/Sectional",
			divisionId: division.id,
			inchargeId: sseIncharge.id,
		},
		create: {
			name: "JE Telecom Sectional RTM",
			username: "je_sectional_rtm",
			email: "je_sectional_rtm@railway.gov.in",
			password: passwordHash,
			role: "JE_SSE_TELE_SECTIONAL",
			designation: "JE/Tele/Sectional",
			divisionId: division.id,
			inchargeId: sseIncharge.id,
		},
	});

	const technician = await prisma.user.upsert({
		where: { username: "tech_rtm" },
		update: {
			name: "Technician RTM",
			email: "tech_rtm@railway.gov.in",
			password: passwordHash,
			role: "TECHNICIAN",
			designation: "Technician",
			divisionId: division.id,
			inchargeId: jeSectional.id,
		},
		create: {
			name: "Technician RTM",
			username: "tech_rtm",
			email: "tech_rtm@railway.gov.in",
			password: passwordHash,
			role: "TECHNICIAN",
			designation: "Technician",
			divisionId: division.id,
			inchargeId: jeSectional.id,
		},
	});

	const viewer = await prisma.user.upsert({
		where: { username: "viewer_rtm" },
		update: {
			name: "Audit Viewer RTM",
			email: "viewer_rtm@railway.gov.in",
			password: passwordHash,
			role: "VIEWER",
			designation: "Audit User",
			divisionId: division.id,
			inchargeId: admin.id,
		},
		create: {
			name: "Audit Viewer RTM",
			username: "viewer_rtm",
			email: "viewer_rtm@railway.gov.in",
			password: passwordHash,
			role: "VIEWER",
			designation: "Audit User",
			divisionId: division.id,
			inchargeId: admin.id,
		},
	});
	void viewer;

	// 3) Stations + Locations + Racks
	const stationByCode = new Map();
	const locationByStationCode = new Map();

	for (let i = 0; i < TRACK_LAYOUT.length; i += 1) {
		const st = TRACK_LAYOUT[i];
		const supervisorId = i % 2 === 0 ? jeSectional.id : sseIncharge.id;

		const station = await prisma.station.upsert({
			where: { code: st.code },
			update: {
				name: st.name,
				divisionId: division.id,
				mapX: st.mapX,
				mapY: st.mapY,
				createdById: admin.id,
				supervisorId,
			},
			create: {
				code: st.code,
				name: st.name,
				divisionId: division.id,
				mapX: st.mapX,
				mapY: st.mapY,
				createdById: admin.id,
				supervisorId,
			},
		});
		stationByCode.set(st.code, station);

		const controlRoom = await prisma.location.upsert({
			where: { id: toUuid(1000 + i * 10 + 1) },
			update: {
				name: "Control Room",
				description: `${st.code} control telecom room`,
				stationId: station.id,
			},
			create: {
				id: toUuid(1000 + i * 10 + 1),
				name: "Control Room",
				description: `${st.code} control telecom room`,
				stationId: station.id,
			},
		});

		const panelRoom = await prisma.location.upsert({
			where: { id: toUuid(1000 + i * 10 + 2) },
			update: {
				name: "Panel Room",
				description: `${st.code} panel room`,
				stationId: station.id,
			},
			create: {
				id: toUuid(1000 + i * 10 + 2),
				name: "Panel Room",
				description: `${st.code} panel room`,
				stationId: station.id,
			},
		});

		locationByStationCode.set(st.code, [controlRoom, panelRoom]);

		await prisma.rack.upsert({
			where: { id: toUuid(2000 + i) },
			update: {
				name: `${st.code}-RACK-01`,
				description: `Main telecom rack at ${st.code}`,
				heightU: 42,
				type: "FLOOR_STANDING",
				locationId: controlRoom.id,
			},
			create: {
				id: toUuid(2000 + i),
				name: `${st.code}-RACK-01`,
				description: `Main telecom rack at ${st.code}`,
				heightU: 42,
				type: "FLOOR_STANDING",
				locationId: controlRoom.id,
			},
		});
	}

	// 4) Subsections for track coverage
	for (let i = 0; i < TRACK_LAYOUT.length - 1; i += 1) {
		const from = TRACK_LAYOUT[i];
		const to = TRACK_LAYOUT[i + 1];
		await prisma.subsection.upsert({
			where: { id: toUuid(3000 + i) },
			update: {
				name: `${from.code} - ${to.code}`,
				code: `${from.code}-${to.code}`,
				sectionId: section.id,
				fromStationId: stationByCode.get(from.code).id,
				toStationId: stationByCode.get(to.code).id,
				startKm: from.km,
				endKm: to.km,
				divisionId: division.id,
				createdById: admin.id,
				supervisorId: i % 2 === 0 ? jeSectional.id : sseIncharge.id,
				stations: {
					set: [
						{ id: stationByCode.get(from.code).id },
						{ id: stationByCode.get(to.code).id },
					],
				},
			},
			create: {
				id: toUuid(3000 + i),
				name: `${from.code} - ${to.code}`,
				code: `${from.code}-${to.code}`,
				sectionId: section.id,
				fromStationId: stationByCode.get(from.code).id,
				toStationId: stationByCode.get(to.code).id,
				startKm: from.km,
				endKm: to.km,
				divisionId: division.id,
				createdById: admin.id,
				supervisorId: i % 2 === 0 ? jeSectional.id : sseIncharge.id,
				stations: {
					connect: [
						{ id: stationByCode.get(from.code).id },
						{ id: stationByCode.get(to.code).id },
					],
				},
			},
		});
	}

	// 5) Equipment templates + equipment instances (for richer environment)
	const l2Template = await prisma.equipmentTemplate.upsert({
		where: { modelName: "Cisco-2960X-24TS" },
		update: {
			make: "Cisco",
			category: "NETWORKING",
			subCategory: "L2_SWITCH",
			supply: "230V AC",
		},
		create: {
			make: "Cisco",
			modelName: "Cisco-2960X-24TS",
			category: "NETWORKING",
			subCategory: "L2_SWITCH",
			supply: "230V AC",
		},
	});

	const muxTemplate = await prisma.equipmentTemplate.upsert({
		where: { modelName: "Tejas-PD-MUX-01" },
		update: {
			make: "Tejas",
			category: "TRANSMISSION",
			subCategory: "PD_MUX",
			supply: "-48V DC",
		},
		create: {
			make: "Tejas",
			modelName: "Tejas-PD-MUX-01",
			category: "TRANSMISSION",
			subCategory: "PD_MUX",
			supply: "-48V DC",
		},
	});

	const equipmentPool = [];
	for (let i = 0; i < TRACK_LAYOUT.length; i += 1) {
		const st = TRACK_LAYOUT[i];
		const station = stationByCode.get(st.code);
		const controlRoom = locationByStationCode.get(st.code)[0];

		const eq1 = await prisma.equipment.upsert({
			where: { serialNumber: `RTM-SW-${String(i + 1).padStart(3, "0")}` },
			update: {
				name: `${st.code} L2 Switch`,
				description: "Station networking switch",
				providedBy: "RailTel",
				templateId: l2Template.id,
				stationId: station.id,
				rackId: toUuid(2000 + i),
				uPosition: 10,
				status: i % 4 === 0 ? "MAINTENANCE" : "OPERATIONAL",
				installationDate: daysAgo(700),
				DateOfLastMaintenace: daysAgo(10 + i),
				mapX: st.mapX,
				mapY: st.mapY,
				createdById: admin.id,
			},
			create: {
				name: `${st.code} L2 Switch`,
				description: "Station networking switch",
				providedBy: "RailTel",
				serialNumber: `RTM-SW-${String(i + 1).padStart(3, "0")}`,
				templateId: l2Template.id,
				stationId: station.id,
				rackId: toUuid(2000 + i),
				uPosition: 10,
				status: i % 4 === 0 ? "MAINTENANCE" : "OPERATIONAL",
				installationDate: daysAgo(700),
				DateOfLastMaintenace: daysAgo(10 + i),
				mapX: st.mapX,
				mapY: st.mapY,
				createdById: admin.id,
			},
		});

		const eq2 = await prisma.equipment.upsert({
			where: { serialNumber: `RTM-MUX-${String(i + 1).padStart(3, "0")}` },
			update: {
				name: `${st.code} PD-MUX`,
				description: "Transmission multiplexing unit",
				providedBy: "CORE",
				templateId: muxTemplate.id,
				stationId: station.id,
				rackId: toUuid(2000 + i),
				uPosition: 12,
				status: i % 3 === 0 ? "FAULTY" : "OPERATIONAL",
				installationDate: daysAgo(900),
				DateOfLastMaintenace: daysAgo(25 + i),
				mapX: st.mapX + 2,
				mapY: st.mapY + 2,
				createdById: admin.id,
			},
			create: {
				name: `${st.code} PD-MUX`,
				description: "Transmission multiplexing unit",
				providedBy: "CORE",
				serialNumber: `RTM-MUX-${String(i + 1).padStart(3, "0")}`,
				templateId: muxTemplate.id,
				stationId: station.id,
				rackId: toUuid(2000 + i),
				uPosition: 12,
				status: i % 3 === 0 ? "FAULTY" : "OPERATIONAL",
				installationDate: daysAgo(900),
				DateOfLastMaintenace: daysAgo(25 + i),
				mapX: st.mapX + 2,
				mapY: st.mapY + 2,
				createdById: admin.id,
			},
		});

		equipmentPool.push(eq1, eq2);
		void controlRoom;
	}

	// 6) Project
	const project = await prisma.project.upsert({
		where: { id: toUuid(5000) },
		update: {
			name: "RTM Telecom Reliability Drive",
			description: "Failure reduction and restoration quality tracking",
			status: "ONGOING",
			ownerId: testroom.id,
			startDate: daysAgo(90),
			endDate: daysAgo(-30),
		},
		create: {
			id: toUuid(5000),
			name: "RTM Telecom Reliability Drive",
			description: "Failure reduction and restoration quality tracking",
			status: "ONGOING",
			ownerId: testroom.id,
			startDate: daysAgo(90),
			endDate: daysAgo(-30),
		},
	});

	// 7) Circuit master + station circuits
	const vhfCircuitMaster = await prisma.divisionCircuitMaster.upsert({
		where: {
			divisionId_code: {
				divisionId: division.id,
				code: "VHF_SET",
			},
		},
		update: {
			name: "VHF Set",
			description: "Routine VHF inspection checklist",
			isActive: true,
			createdById: testroom.id,
			checklistSchema: [
				{
					key: "tx_ok",
					label: "TX OK",
					type: "BOOLEAN",
					required: true,
					order: 1,
					options: [],
				},
				{
					key: "rx_ok",
					label: "RX OK",
					type: "BOOLEAN",
					required: true,
					order: 2,
					options: [],
				},
				{
					key: "battery_voltage",
					label: "Battery Voltage",
					type: "NUMBER",
					required: true,
					order: 3,
					unit: "V",
					options: [],
				},
				{
					key: "charging_current",
					label: "Charging Current",
					type: "NUMBER",
					required: false,
					order: 4,
					unit: "A",
					options: [],
				},
			],
		},
		create: {
			code: "VHF_SET",
			name: "VHF Set",
			description: "Routine VHF inspection checklist",
			isActive: true,
			divisionId: division.id,
			createdById: testroom.id,
			checklistSchema: [
				{
					key: "tx_ok",
					label: "TX OK",
					type: "BOOLEAN",
					required: true,
					order: 1,
					options: [],
				},
				{
					key: "rx_ok",
					label: "RX OK",
					type: "BOOLEAN",
					required: true,
					order: 2,
					options: [],
				},
				{
					key: "battery_voltage",
					label: "Battery Voltage",
					type: "NUMBER",
					required: true,
					order: 3,
					unit: "V",
					options: [],
				},
				{
					key: "charging_current",
					label: "Charging Current",
					type: "NUMBER",
					required: false,
					order: 4,
					unit: "A",
					options: [],
				},
			],
		},
	});

	const controlPhoneMaster = await prisma.divisionCircuitMaster.upsert({
		where: {
			divisionId_code: {
				divisionId: division.id,
				code: "CONTROL_PHONE",
			},
		},
		update: {
			name: "Control Phone",
			description: "Control phone monthly checks",
			isActive: true,
			createdById: testroom.id,
			checklistSchema: [
				{
					key: "ringing_code",
					label: "Ringing Code Number",
					type: "TEXT",
					required: true,
					order: 1,
					options: [],
				},
				{
					key: "line_gain",
					label: "Line Gain",
					type: "NUMBER",
					required: false,
					order: 2,
					unit: "dB",
					options: [],
				},
				{
					key: "dtmf_gain",
					label: "DTMF Gain",
					type: "NUMBER",
					required: false,
					order: 3,
					unit: "dB",
					options: [],
				},
			],
		},
		create: {
			code: "CONTROL_PHONE",
			name: "Control Phone",
			description: "Control phone monthly checks",
			isActive: true,
			divisionId: division.id,
			createdById: testroom.id,
			checklistSchema: [
				{
					key: "ringing_code",
					label: "Ringing Code Number",
					type: "TEXT",
					required: true,
					order: 1,
					options: [],
				},
				{
					key: "line_gain",
					label: "Line Gain",
					type: "NUMBER",
					required: false,
					order: 2,
					unit: "dB",
					options: [],
				},
				{
					key: "dtmf_gain",
					label: "DTMF Gain",
					type: "NUMBER",
					required: false,
					order: 3,
					unit: "dB",
					options: [],
				},
			],
		},
	});

	for (let i = 0; i < TRACK_LAYOUT.length; i += 1) {
		const station = stationByCode.get(TRACK_LAYOUT[i].code);
		const [controlRoom] = locationByStationCode.get(TRACK_LAYOUT[i].code);
		const maintainedById = i % 2 === 0 ? jeSectional.id : sseIncharge.id;
		const isApproved = i % 3 !== 0;

		await prisma.stationCircuit.upsert({
			where: { id: toUuid(6000 + i * 2) },
			update: {
				stationId: station.id,
				locationId: controlRoom.id,
				circuitMasterId: vhfCircuitMaster.id,
				identifier: `VHF-${station.code}-01`,
				maintainedById,
				requestedById: jeSectional.id,
				status: isApproved ? "APPROVED" : "PENDING",
				approvedById: isApproved ? testroom.id : null,
				approvedAt: isApproved ? daysAgo(5) : null,
				rejectionReason: null,
			},
			create: {
				id: toUuid(6000 + i * 2),
				stationId: station.id,
				locationId: controlRoom.id,
				circuitMasterId: vhfCircuitMaster.id,
				identifier: `VHF-${station.code}-01`,
				maintainedById,
				requestedById: jeSectional.id,
				status: isApproved ? "APPROVED" : "PENDING",
				approvedById: isApproved ? testroom.id : null,
				approvedAt: isApproved ? daysAgo(5) : null,
			},
		});

		await prisma.stationCircuit.upsert({
			where: { id: toUuid(6000 + i * 2 + 1) },
			update: {
				stationId: station.id,
				locationId: controlRoom.id,
				circuitMasterId: controlPhoneMaster.id,
				identifier: `CP-${station.code}-A`,
				maintainedById,
				requestedById: sseIncharge.id,
				status: "APPROVED",
				approvedById: testroom.id,
				approvedAt: daysAgo(4),
				rejectionReason: null,
			},
			create: {
				id: toUuid(6000 + i * 2 + 1),
				stationId: station.id,
				locationId: controlRoom.id,
				circuitMasterId: controlPhoneMaster.id,
				identifier: `CP-${station.code}-A`,
				maintainedById,
				requestedById: sseIncharge.id,
				status: "APPROVED",
				approvedById: testroom.id,
				approvedAt: daysAgo(4),
			},
		});
	}

	// 8) Failure-heavy task dataset for dashboard analytics
	let failureCreated = 0;
	for (let i = 0; i < 120; i += 1) {
		const stationMeta = TRACK_LAYOUT[i % TRACK_LAYOUT.length];
		const station = stationByCode.get(stationMeta.code);
		const locations = locationByStationCode.get(stationMeta.code);
		const location = locations[i % locations.length];
		const assigneeId = i % 2 === 0 ? jeSectional.id : sseIncharge.id;
		const priority = PRIORITIES[i % PRIORITIES.length];
		const failureType = FAILURE_TYPES[i % FAILURE_TYPES.length];
		const cause = FAILURE_CAUSES[(i * 2) % FAILURE_CAUSES.length];

		const failureInTime = daysAgo(i % 60, 1 + ((i * 3) % 21), (i * 7) % 60);
		const createdAt = addMinutes(failureInTime, 20 + (i % 40));

		let status = "OPEN";
		if (i % 5 === 1 || i % 5 === 2) status = "IN_PROGRESS";
		if (i % 5 === 3) status = "RESOLVED";
		if (i % 5 === 4) status = "CLOSED";

		const restorationTime =
			status === "RESOLVED" || status === "CLOSED"
				? addHours(failureInTime, 2 + (i % 14))
				: null;

		const taskId = toUuid(100000 + i);
		const task = await prisma.task.upsert({
			where: { id: taskId },
			update: {
				title: `Failure Ticket ${String(i + 1).padStart(4, "0")} - ${station.code}`,
				type: "FAILURE",
				description: `${failureType} fault reported at ${station.name}`,
				status,
				priority,
				weight: 1,
				projectId: project.id,
				ownerId: testroom.id,
				assignedToId: assigneeId,
				createdAt,
			},
			create: {
				id: taskId,
				title: `Failure Ticket ${String(i + 1).padStart(4, "0")} - ${station.code}`,
				type: "FAILURE",
				description: `${failureType} fault reported at ${station.name}`,
				status,
				priority,
				weight: 1,
				projectId: project.id,
				ownerId: testroom.id,
				assignedToId: assigneeId,
				createdAt,
			},
		});

		await prisma.failure.upsert({
			where: { taskId: task.id },
			update: {
				type: failureType,
				cause,
				locationId: location.id,
				stationId: station.id,
				failureInTime,
				isHqRepeated: priority === "CRITICAL" || i % 6 === 0,
				isIcmsRepeated:
					["BLOCK", "SECTION_CONTROL", "TPC_CONTROL", "SI_CONTROL"].includes(
						failureType,
					) || i % 9 === 0,
				restorationTime,
				remarks:
					status === "RESOLVED" || status === "CLOSED"
						? "Restored after on-site diagnostics."
						: "Under troubleshooting by field team.",
			},
			create: {
				taskId: task.id,
				type: failureType,
				cause,
				locationId: location.id,
				stationId: station.id,
				failureInTime,
				isHqRepeated: priority === "CRITICAL" || i % 6 === 0,
				isIcmsRepeated:
					["BLOCK", "SECTION_CONTROL", "TPC_CONTROL", "SI_CONTROL"].includes(
						failureType,
					) || i % 9 === 0,
				restorationTime,
				remarks:
					status === "RESOLVED" || status === "CLOSED"
						? "Restored after on-site diagnostics."
						: "Under troubleshooting by field team.",
			},
		});

		await upsertTaskHistory({
			id: toUuid(200000 + i * 10 + 1),
			taskId: task.id,
			actorId: testroom.id,
			action: "CREATED",
			toValue: "OPEN",
			details: "Failure ticket logged by testroom",
			createdAt,
		});

		await upsertTaskHistory({
			id: toUuid(200000 + i * 10 + 2),
			taskId: task.id,
			actorId: testroom.id,
			action: "ASSIGNED",
			toValue: assigneeId,
			details: "Assigned to field engineer",
			createdAt: addMinutes(createdAt, 5),
		});

		if (
			status === "IN_PROGRESS" ||
			status === "RESOLVED" ||
			status === "CLOSED"
		) {
			await upsertTaskHistory({
				id: toUuid(200000 + i * 10 + 3),
				taskId: task.id,
				actorId: assigneeId,
				action: "STATUS_CHANGED",
				fromValue: "OPEN",
				toValue: "IN_PROGRESS",
				details: "Field team started rectification",
				createdAt: addMinutes(createdAt, 35),
			});
		}

		if (status === "RESOLVED" || status === "CLOSED") {
			await upsertTaskHistory({
				id: toUuid(200000 + i * 10 + 4),
				taskId: task.id,
				actorId: assigneeId,
				action: "STATUS_CHANGED",
				fromValue: "IN_PROGRESS",
				toValue: "RESOLVED",
				details: "Failure restored at site",
				createdAt: restorationTime || addHours(createdAt, 2),
			});
		}

		if (status === "CLOSED") {
			await upsertTaskHistory({
				id: toUuid(200000 + i * 10 + 5),
				taskId: task.id,
				actorId: testroom.id,
				action: "STATUS_CHANGED",
				fromValue: "RESOLVED",
				toValue: "CLOSED",
				details: "Ticket closed by control",
				createdAt: addMinutes(restorationTime || createdAt, 45),
			});
		}

		if (i % 4 === 0) {
			await prisma.comment.upsert({
				where: { id: toUuid(300000 + i) },
				update: {
					content: "Field update shared with control room.",
					taskId: task.id,
					authorId: assigneeId,
					createdAt: addMinutes(createdAt, 50),
				},
				create: {
					id: toUuid(300000 + i),
					content: "Field update shared with control room.",
					taskId: task.id,
					authorId: assigneeId,
					createdAt: addMinutes(createdAt, 50),
				},
			});
		}

		failureCreated += 1;
	}

	// 9) A few maintenance and TRC tasks for non-failure modules
	for (let i = 0; i < 20; i += 1) {
		const stationMeta = TRACK_LAYOUT[i % TRACK_LAYOUT.length];
		const station = stationByCode.get(stationMeta.code);
		const [location] = locationByStationCode.get(stationMeta.code);
		const assigneeId = i % 2 === 0 ? jeSectional.id : sseIncharge.id;
		const status =
			i % 3 === 0 ? "RESOLVED" : i % 3 === 1 ? "IN_PROGRESS" : "OPEN";
		const createdAt = daysAgo(5 + (i % 20), 9, 15);

		const task = await prisma.task.upsert({
			where: { id: toUuid(400000 + i) },
			update: {
				title: `Maintenance Activity ${String(i + 1).padStart(2, "0")} - ${station.code}`,
				type: "MAINTENANCE",
				description: "Preventive maintenance activity",
				status,
				priority: "MEDIUM",
				projectId: project.id,
				ownerId: testroom.id,
				assignedToId: assigneeId,
				createdAt,
			},
			create: {
				id: toUuid(400000 + i),
				title: `Maintenance Activity ${String(i + 1).padStart(2, "0")} - ${station.code}`,
				type: "MAINTENANCE",
				description: "Preventive maintenance activity",
				status,
				priority: "MEDIUM",
				projectId: project.id,
				ownerId: testroom.id,
				assignedToId: assigneeId,
				createdAt,
			},
		});

		await prisma.maintenance.upsert({
			where: { taskId: task.id },
			update: {
				date: createdAt,
				locationId: location.id,
				stationId: station.id,
				equipmentId: equipmentPool[i % equipmentPool.length].id,
				remarks:
					status === "RESOLVED"
						? "PM completed and checklist uploaded."
						: "Pending observations closure.",
			},
			create: {
				taskId: task.id,
				date: createdAt,
				locationId: location.id,
				stationId: station.id,
				equipmentId: equipmentPool[i % equipmentPool.length].id,
				remarks:
					status === "RESOLVED"
						? "PM completed and checklist uploaded."
						: "Pending observations closure.",
			},
		});
	}

	for (let i = 0; i < 8; i += 1) {
		const createdAt = daysAgo(2 + i, 11, 0);
		const task = await prisma.task.upsert({
			where: { id: toUuid(500000 + i) },
			update: {
				title: `TRC Request ${String(i + 1).padStart(2, "0")}`,
				type: "TRC",
				description: "Equipment TRC processing",
				status: i % 2 === 0 ? "OPEN" : "RESOLVED",
				priority: i % 3 === 0 ? "HIGH" : "MEDIUM",
				projectId: project.id,
				ownerId: testroom.id,
				assignedToId: technician.id,
				createdAt,
			},
			create: {
				id: toUuid(500000 + i),
				title: `TRC Request ${String(i + 1).padStart(2, "0")}`,
				type: "TRC",
				description: "Equipment TRC processing",
				status: i % 2 === 0 ? "OPEN" : "RESOLVED",
				priority: i % 3 === 0 ? "HIGH" : "MEDIUM",
				projectId: project.id,
				ownerId: testroom.id,
				assignedToId: technician.id,
				createdAt,
			},
		});

		await prisma.tRCRequest.upsert({
			where: { taskId: task.id },
			update: {
				equipmentId: equipmentPool[(i * 3) % equipmentPool.length].id,
				status: i % 2 === 0 ? "REQUESTED" : "CLOSED",
				certificateNo: i % 2 === 0 ? null : `TRC-${2026}-${100 + i}`,
				receivedDate: addHours(createdAt, 3),
				returnDate: i % 2 === 0 ? null : addHours(createdAt, 36),
			},
			create: {
				taskId: task.id,
				equipmentId: equipmentPool[(i * 3) % equipmentPool.length].id,
				status: i % 2 === 0 ? "REQUESTED" : "CLOSED",
				certificateNo: i % 2 === 0 ? null : `TRC-${2026}-${100 + i}`,
				receivedDate: addHours(createdAt, 3),
				returnDate: i % 2 === 0 ? null : addHours(createdAt, 36),
			},
		});
	}

	// 10) Maintenance schedules + occurrences
	for (let i = 0; i < TRACK_LAYOUT.length; i += 1) {
		const station = stationByCode.get(TRACK_LAYOUT[i].code);
		const supervisorId = station.supervisorId;
		const nextDueDate = daysAgo(-(2 + i), 0, 30);
		const scheduleId = toUuid(7000 + i);

		await prisma.maintenanceSchedule.upsert({
			where: { id: scheduleId },
			update: {
				title: `${station.code} Monthly Station Inspection`,
				scheduleType: "STATION_INSPECTION_MAINTENANCE",
				targetScope: "STATION",
				description: "Auto-generated monthly station inspection schedule",
				frequency: "MONTHLY",
				nextDueDate,
				allowedVarianceDays: 5,
				remindBeforeDays: 2,
				escalationRole: "SSE_TELE_INCHARGE",
				status: "ACTIVE",
				stationId: station.id,
				createdById: testroom.id,
				supervisorId,
			},
			create: {
				id: scheduleId,
				title: `${station.code} Monthly Station Inspection`,
				scheduleType: "STATION_INSPECTION_MAINTENANCE",
				targetScope: "STATION",
				description: "Auto-generated monthly station inspection schedule",
				frequency: "MONTHLY",
				nextDueDate,
				allowedVarianceDays: 5,
				remindBeforeDays: 2,
				escalationRole: "SSE_TELE_INCHARGE",
				status: "ACTIVE",
				stationId: station.id,
				createdById: testroom.id,
				supervisorId,
			},
		});

		await prisma.maintenanceOccurrence.upsert({
			where: { id: toUuid(7100 + i * 2) },
			update: {
				scheduleId,
				dueDate: daysAgo(25 + i, 0, 30),
				status: "COMPLETED",
				completedAt: daysAgo(23 + i, 14, 0),
				completedById: supervisorId,
				remarks: "Completed as per monthly plan.",
				proofUrls: ["https://example.com/proof/station-inspection.jpg"],
			},
			create: {
				id: toUuid(7100 + i * 2),
				scheduleId,
				dueDate: daysAgo(25 + i, 0, 30),
				status: "COMPLETED",
				completedAt: daysAgo(23 + i, 14, 0),
				completedById: supervisorId,
				remarks: "Completed as per monthly plan.",
				proofUrls: ["https://example.com/proof/station-inspection.jpg"],
			},
		});

		await prisma.maintenanceOccurrence.upsert({
			where: { id: toUuid(7100 + i * 2 + 1) },
			update: {
				scheduleId,
				dueDate: daysAgo(i, 0, 30),
				status: i % 2 === 0 ? "OPEN" : "OVERDUE",
				remarks: i % 2 === 0 ? "Due this week." : "Escalation expected.",
				completedAt: null,
				completedById: null,
			},
			create: {
				id: toUuid(7100 + i * 2 + 1),
				scheduleId,
				dueDate: daysAgo(i, 0, 30),
				status: i % 2 === 0 ? "OPEN" : "OVERDUE",
				remarks: i % 2 === 0 ? "Due this week." : "Escalation expected.",
			},
		});
	}

	console.log("--- Seed complete ---");
	console.log(`Users created/updated: 7 core users`);
	console.log(`Stations available: ${TRACK_LAYOUT.length}`);
	console.log(`Failure tasks upserted: ${failureCreated}`);
	console.log(`Default password for seeded users: ${COMMON_PASSWORD}`);
}

main()
	.catch((error) => {
		console.error("Seed failed:", error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
