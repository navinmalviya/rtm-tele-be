import bcrypt from "bcrypt";
import prisma from "../src/lib/prisma";

async function main() {
	console.log("--- Starting Full Seeding Process ---");
	const commonPassword = await bcrypt.hash("railway123", 10);

	// 1. ZONAL HIERARCHY
	const wr = await prisma.zone.create({
		data: { name: "Western Railway", code: "WR" },
	});

	const rtmDiv = await prisma.division.create({
		data: { name: "Ratlam", code: "RTM", zoneId: wr.id },
	});

	const brcDiv = await prisma.division.create({
		data: { name: "Baroda", code: "BRC", zoneId: wr.id },
	});

	const section = await prisma.section.create({
		data: {
			name: "Ratlam-Godhra Section",
			code: "RTM-GDA",
			divisionId: rtmDiv.id,
		},
	});

	// 2. CREATE SYSTEM ADMIN (Required for audit/createdById fields)
	const admin = await prisma.user.create({
		data: {
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
	const stnRtm = await prisma.station.create({
		data: {
			name: "Ratlam",
			code: "RTM",
			divisionId: rtmDiv.id,
			createdById: admin.id,
			mapX: 0,
			mapY: 200,
		},
	});
	const stnMrn = await prisma.station.create({
		data: {
			name: "Morwani",
			code: "MRN",
			divisionId: rtmDiv.id,
			createdById: admin.id,
			mapX: 400,
			mapY: 200,
		},
	});
	const stnBild = await prisma.station.create({
		data: {
			name: "Bildi",
			code: "BILD",
			divisionId: rtmDiv.id,
			createdById: admin.id,
			mapX: 800,
			mapY: 200,
		},
	});

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

	// 5. CREATE ALL USER TYPES
	const users = [
		{
			username: "testroom_rtm",
			role: "TESTROOM",
			name: "RTM Testroom Control",
			divId: rtmDiv.id,
		},
		{
			username: "sse_rtm",
			role: "SSE_INCHARGE",
			name: "SSE S&T Ratlam",
			divId: rtmDiv.id,
		},
		{
			username: "fe_rtm",
			role: "FIELD_ENGINEER",
			name: "Field Engineer RTM",
			divId: rtmDiv.id,
		},
		{
			username: "trc_rtm",
			role: "TRC",
			name: "Repair Center RTM",
			divId: rtmDiv.id,
		},
		{
			username: "tech_rtm",
			role: "SSE_TECH",
			name: "Technical SSE Ratlam",
			divId: rtmDiv.id,
		},
		{
			username: "maintainer_rtm",
			role: "MAINTAINER",
			name: "Maintainer Grade-I",
			divId: rtmDiv.id,
		},
		{
			username: "viewer_brc",
			role: "VIEWER",
			name: "Baroda Divisional Viewer",
			divId: brcDiv.id,
		},
		{
			username: "viewer_rtm",
			role: "VIEWER",
			name: "Ratlam Divisional Viewer",
			divId: rtmDiv.id,
		},
	];

	for (const u of users) {
		await prisma.user.create({
			data: {
				name: u.name,
				username: u.username,
				email: `${u.username}@railway.gov.in`,
				password: commonPassword,
				role: u.role,
				designation: u.role.replace("_", " "),
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
