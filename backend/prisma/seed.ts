import { PrismaClient, CoachType, ClassType, BookingStatus } from '@prisma/client';

const prisma = new PrismaClient();

const STATIONS = [
  { name: 'Colombo Fort', code: 'FOT', sequenceNumber: 1, distanceKm: 0.0 },
  { name: 'Ragama', code: 'RGM', sequenceNumber: 2, distanceKm: 16.0 },
  { name: 'Gampaha', code: 'GPH', sequenceNumber: 3, distanceKm: 28.0 },
  { name: 'Veyangoda', code: 'VGD', sequenceNumber: 4, distanceKm: 38.0 },
  { name: 'Polgahawela', code: 'PLW', sequenceNumber: 5, distanceKm: 73.0 },
  { name: 'Rambukkana', code: 'RBK', sequenceNumber: 6, distanceKm: 84.0 },
  { name: 'Peradeniya Junction', code: 'PDA', sequenceNumber: 7, distanceKm: 115.0 },
  { name: 'Kandy', code: 'KDY', sequenceNumber: 8, distanceKm: 120.0 },
  { name: 'Nawalapitiya', code: 'NVP', sequenceNumber: 9, distanceKm: 140.0 },
  { name: 'Hatton', code: 'HTN', sequenceNumber: 10, distanceKm: 175.0 },
  { name: 'Nanu Oya (Nuwara Eliya)', code: 'NOA', sequenceNumber: 11, distanceKm: 206.0 },
  { name: 'Ambewela', code: 'ABL', sequenceNumber: 12, distanceKm: 222.0 },
  { name: 'Pattipola', code: 'PTP', sequenceNumber: 13, distanceKm: 226.0 },
  { name: 'Haputale', code: 'HPT', sequenceNumber: 14, distanceKm: 247.0 },
  { name: 'Diyatalawa', code: 'DLA', sequenceNumber: 15, distanceKm: 253.0 },
  { name: 'Bandarawela', code: 'BDA', sequenceNumber: 16, distanceKm: 258.0 },
  { name: 'Ella', code: 'ELA', sequenceNumber: 17, distanceKm: 271.0 },
  { name: 'Badulla', code: 'BAD', sequenceNumber: 18, distanceKm: 292.0 },
];

const COACHES = [
  { name: 'Coach A - Observation Car', type: CoachType.RESERVED, classType: ClassType.FIRST_CLASS, totalSeats: 24, prefix: 'A' },
  { name: 'Coach B - Air Conditioned', type: CoachType.RESERVED, classType: ClassType.FIRST_CLASS, totalSeats: 24, prefix: 'B' },
  { name: 'Coach C - 2nd Class Reserved', type: CoachType.RESERVED, classType: ClassType.SECOND_CLASS, totalSeats: 24, prefix: 'C' },
  { name: 'Coach D - 2nd Class Open', type: CoachType.UNRESERVED, classType: ClassType.SECOND_CLASS, totalSeats: 30, prefix: 'D' },
  { name: 'Coach E - 3rd Class Open', type: CoachType.UNRESERVED, classType: ClassType.THIRD_CLASS, totalSeats: 40, prefix: 'E' },
  { name: 'Coach F - 3rd Class Open', type: CoachType.UNRESERVED, classType: ClassType.THIRD_CLASS, totalSeats: 40, prefix: 'F' },
  { name: 'Coach G - 3rd Class Open', type: CoachType.UNRESERVED, classType: ClassType.THIRD_CLASS, totalSeats: 40, prefix: 'G' },
  { name: 'Coach H - 3rd Class Open', type: CoachType.UNRESERVED, classType: ClassType.THIRD_CLASS, totalSeats: 40, prefix: 'H' },
];

async function main() {
  console.log('Seeding Sri Lanka Railway Colombo Fort - Badulla line...');

  // 1. Seed Stations
  for (const st of STATIONS) {
    await prisma.station.upsert({
      where: { code: st.code },
      update: { name: st.name, sequenceNumber: st.sequenceNumber, distanceKm: st.distanceKm },
      create: st,
    });
  }
  const createdStations = await prisma.station.findMany({ orderBy: { sequenceNumber: 'asc' } });
  console.log(`Seeded ${createdStations.length} stations.`);

  // 2. Seed Coaches & Seats
  for (const ch of COACHES) {
    const coach = await prisma.coach.create({
      data: {
        name: ch.name,
        type: ch.type,
        classType: ch.classType,
        totalSeats: ch.totalSeats,
      },
    });

    if (ch.type === CoachType.RESERVED) {
      for (let i = 1; i <= ch.totalSeats; i++) {
        const numStr = i < 10 ? `0${i}` : `${i}`;
        await prisma.seat.create({
          data: {
            seatNumber: `${ch.prefix}-${numStr}`,
            coachId: coach.id,
          },
        });
      }
    }
  }
  const seatCount = await prisma.seat.count();
  console.log(`Seeded coaches and ${seatCount} reserved seats.`);

  // 3. Seed Demo Segment Bookings to showcase seat reuse
  const today = new Date().toISOString().split('T')[0];

  const seatA1 = await prisma.seat.findFirst({ where: { seatNumber: 'A-01' } });
  const seatA2 = await prisma.seat.findFirst({ where: { seatNumber: 'A-02' } });

  if (seatA1) {
    // Passenger 1: Colombo Fort (seq 1) -> Kandy (seq 8) on Seat A-01
    await prisma.booking.create({
      data: {
        pnr: 'SLR-DEMO-01',
        seatId: seatA1.id,
        date: today,
        startStationSeq: 1,
        endStationSeq: 8,
        startStationId: createdStations.find(s => s.sequenceNumber === 1)!.id,
        endStationId: createdStations.find(s => s.sequenceNumber === 8)!.id,
        status: BookingStatus.CONFIRMED,
        guestName: 'Kasun Perera',
        guestNic: '921840291V',
        guestMobile: '+94771234567',
        totalFare: 450.00,
      },
    });

    // Passenger 2: REUSES Seat A-01 from Kandy (seq 8) -> Badulla (seq 18)!
    await prisma.booking.create({
      data: {
        pnr: 'SLR-DEMO-02',
        seatId: seatA1.id,
        date: today,
        startStationSeq: 8,
        endStationSeq: 18,
        startStationId: createdStations.find(s => s.sequenceNumber === 8)!.id,
        endStationId: createdStations.find(s => s.sequenceNumber === 18)!.id,
        status: BookingStatus.CONFIRMED,
        guestName: 'Nimali Fernando',
        guestNic: '958291048V',
        guestMobile: '+94719876543',
        totalFare: 600.00,
      },
    });
  }

  if (seatA2) {
    // Passenger 3: Colombo Fort (seq 1) -> Nanu Oya (seq 11) on Seat A-02
    await prisma.booking.create({
      data: {
        pnr: 'SLR-DEMO-03',
        seatId: seatA2.id,
        date: today,
        startStationSeq: 1,
        endStationSeq: 11,
        startStationId: createdStations.find(s => s.sequenceNumber === 1)!.id,
        endStationId: createdStations.find(s => s.sequenceNumber === 11)!.id,
        status: BookingStatus.CONFIRMED,
        guestName: 'Sunil Shantha',
        guestNic: '881029482V',
        guestMobile: '+94701122334',
        totalFare: 600.00,
      },
    });
  }

  console.log('Successfully seeded initial segment bookings demonstrating seat reuse.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
