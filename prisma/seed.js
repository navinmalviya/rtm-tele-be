import bcrypt from "bcrypt";
import prisma from "../src/lib/prisma";

async function main() {
	console.log("--- Starting Full Seeding Process ---");
	const commonPassword = await bcrypt.hash("railway123", 10);

	// 1. ZONAL HIERARCHY
	const wr = await prisma.zone.upsert({
		where: { code: "WR" },
		update: { name: "Western Railway" },
		create: { name: "Western Railway", code: "WR" },
	});

	const existingRtmDiv = await prisma.division.findFirst({
		where: { code: "RTM", zoneId: wr.id },
	});
	const rtmDiv =
		existingRtmDiv ||
		(await prisma.division.create({
			data: { name: "Ratlam", code: "RTM", zoneId: wr.id },
		}));

	const existingBrcDiv = await prisma.division.findFirst({
		where: { code: "BRC", zoneId: wr.id },
	});
	const brcDiv =
		existingBrcDiv ||
		(await prisma.division.create({
			data: { name: "Baroda", code: "BRC", zoneId: wr.id },
		}));

	const existingSection = await prisma.section.findFirst({
		where: {
			code: "RTM-GDA",
			divisionId: rtmDiv.id,
		},
	});
	const section =
		existingSection ||
		(await prisma.section.create({
			data: {
				name: "Ratlam-Godhra Section",
				code: "RTM-GDA",
				divisionId: rtmDiv.id,
			},
		}));
	void section;

	// 2. CREATE SYSTEM ADMIN (Required for audit/createdById fields)
	const admin = await prisma.user.upsert({
		where: { username: "superadmin" },
		update: {
			name: "Navin Malviya",
			email: "navinmalviya33@gmail.com",
			password: commonPassword,
			role: "SUPER_ADMIN",
			designation: "SSE/Railnet/RTM",
			divisionId: rtmDiv.id,
		},
		create: {
			name: "Navin Malviya",
			username: "superadmin",
			email: "navinmalviya33@gmail.com",
			password: commonPassword,
			role: "SUPER_ADMIN",
			designation: "SSE/Railnet/RTM",
			divisionId: rtmDiv.id,
		},
	});

	// 3. CREATE STATIONS (Nodes)
	// These must exist before we can link them via Subsections
	const stnRtm = await prisma.station.upsert({
		where: { code: "RTM" },
		update: {
			name: "Ratlam",
			division: { connect: { id: rtmDiv.id } },
			createdBy: { connect: { id: admin.id } },
			supervisor: { connect: { id: admin.id } },
			mapX: 0,
			mapY: 200,
		},
		create: {
			name: "Ratlam",
			code: "RTM",
			division: { connect: { id: rtmDiv.id } },
			createdBy: { connect: { id: admin.id } },
			supervisor: { connect: { id: admin.id } },
			mapX: 0,
			mapY: 200,
		},
	});
	const stnMrn = await prisma.station.upsert({
		where: { code: "MRN" },
		update: {
			name: "Morwani",
			division: { connect: { id: rtmDiv.id } },
			createdBy: { connect: { id: admin.id } },
			supervisor: { connect: { id: admin.id } },
			mapX: 400,
			mapY: 200,
		},
		create: {
			name: "Morwani",
			code: "MRN",
			division: { connect: { id: rtmDiv.id } },
			createdBy: { connect: { id: admin.id } },
			supervisor: { connect: { id: admin.id } },
			mapX: 400,
			mapY: 200,
		},
	});
	const stnBild = await prisma.station.upsert({
		where: { code: "BILD" },
		update: {
			name: "Bildi",
			division: { connect: { id: rtmDiv.id } },
			createdBy: { connect: { id: admin.id } },
			supervisor: { connect: { id: admin.id } },
			mapX: 800,
			mapY: 200,
		},
		create: {
			name: "Bildi",
			code: "BILD",
			division: { connect: { id: rtmDiv.id } },
			createdBy: { connect: { id: admin.id } },
			supervisor: { connect: { id: admin.id } },
			mapX: 800,
			mapY: 200,
		},
	});
	void stnRtm;
	void stnMrn;
	void stnBild;

	// 4. CREATE SUBSECTIONS (The Block Sections / Edges)
	// This explicitly creates the links you requested
	// const sub1 = await prisma.subsection.create({
	// 	data: {
	// 		name: "Ratlam-Morwani Block",
	// 		code: "RTM-MRN",
	// 		sectionId: section.id,
	// 		fromStationId: stnRtm.id,
	// 		toStationId: stnMrn.id,
	// 		createdById: admin.id,
	// 	},
	// });

	// const sub2 = await prisma.subsection.create({
	// 	data: {
	// 		name: "Morwani-Bildi Block",
	// 		code: "MRN-BILD",
	// 		sectionId: section.id,
	// 		fromStationId: stnMrn.id,
	// 		toStationId: stnBild.id,
	// 		createdById: admin.id,
	// 	},
	// });

	// console.log(`Created Subsections: ${sub1.code} and ${sub2.code}`);

	// 5. CREATE ONLY REQUIRED USER TYPES
	const users = [
		{
			username: "admin_rtm",
			role: "ADMIN",
			name: "Division Admin RTM",
			divId: rtmDiv.id,
			designation: "Admin",
		},
		{
			username: "testroom_rtm",
			role: "TESTROOM",
			name: "RTM Testroom Control",
			divId: rtmDiv.id,
			designation: "Testroom",
		},
	];

	for (const u of users) {
		await prisma.user.upsert({
			where: { username: u.username },
			update: {
				name: u.name,
				email: `${u.username}@railway.gov.in`,
				password: commonPassword,
				role: u.role,
				designation: u.designation || u.role.replace("_", " "),
				divisionId: u.divId,
			},
			create: {
				name: u.name,
				username: u.username,
				email: `${u.username}@railway.gov.in`,
				password: commonPassword,
				role: u.role,
				designation: u.designation || u.role.replace("_", " "),
				divisionId: u.divId,
			},
		});
	}

	console.log("--- All Entities Seeded Successfully ---");
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
