# Sri Lanka Railways - Segment-Based Train Seat Booking System

A production-grade, segment-based train seat booking platform for Sri Lanka's **Colombo Fort – Badulla** scenic mainline. The system allows individual reserved seats to be booked independently for multiple non-overlapping legs of a single journey, optimizing train seat utilization and maximizing railway department revenue.

---

## Architecture Overview

```
                          ┌──────────────────────────┐
                          │   Client (Web / Mobile)  │
                          └─────────────┬────────────┘
                                        │ HTTP / REST
                                        ▼
                          ┌──────────────────────────┐
                          │   Node.js Express API    │
                          └──────┬────────────┬──────┘
                                 │            │
             1. Redis Lock (SETNX)│            │ 2. PostgreSQL Write (GiST)
                                 ▼            ▼
                     ┌──────────────┐      ┌──────────────┐
                     │ Redis Cache  │      │ PostgreSQL DB│
                     │  (CQRS O(1)) │      │  (3NF Schema)│
                     └──────────────┘      └──────────────┘
                                 ▲            │
                                 │            │ 3. Event Sync
                                 └────────────┘
```

---

## Key Design Decisions & Core Trade-offs

### 1. Storage Layer Concurrency Defenses: GiST Exclusion Constraint
- **Problem**: In high-concurrency scenarios, multiple passengers simultaneously attempting to book overlapping station legs on the exact same physical seat could cause double-bookings.
- **Solution**: We implemented a native **PostgreSQL GiST Exclusion Constraint** using the `btree_gist` extension:
  ```sql
  ALTER TABLE "Booking" ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (
      "seatId" WITH =,
      "date" WITH =,
      int4range("startStationSeq", "endStationSeq") WITH &&
  ) WHERE ("status" IN ('PENDING', 'CONFIRMED'));
  ```
- **Why `int4range`?**: Station sequence ranges are semi-open `[startSeq, endSeq)`. If Passenger 1 travels Colombo Fort (seq 1) → Kandy (seq 8), their range is `[1, 8)`. If Passenger 2 travels Kandy (seq 8) → Badulla (seq 18), their range is `[8, 18)`. In PostgreSQL `int4range`, `[1, 8)` and `[8, 18)` **do not overlap**, allowing seamless seat reuse at station 8, while rejecting overlapping attempts like `[7, 10)`.

### 2. CQRS Read/Write Separation ($O(1)$ Availability Queries)
- **Problem**: Calculating seat availability across 70+ stations and dozens of seats via relational database interval joins on every search request degrades performance under load.
- **Solution**: Command Query Responsibility Segregation (CQRS). Read requests fetch pre-computed segment gap structures directly from Redis JSON cache in $O(1)$ time. An event-driven background task syncs the Redis cache whenever booking states change.

### 3. Smart Gap-Finding Algorithm (Mixed-Ticket Seat Hops)
- **Problem**: When no single physical seat is available for an entire requested route (e.g. Colombo Fort → Badulla), traditional systems report "Sold Out".
- **Solution**: The Gap-Finder algorithm iterates in $O(N)$ time through existing seat bookings to locate multi-leg seat combinations (e.g. Seat A-01 from Colombo Fort → Kandy + Seat B-05 from Kandy → Badulla) so passengers can still complete their journey.

### 4. Dynamic Distance-Based Fare Engine
- Fares are calculated dynamically based on station sequence index difference:
  $$F_{\text{total}} = F_{\text{base}} + (|S_{\text{destination}} - S_{\text{origin}}| \times R_{\text{station}}) \times M_{\text{class}}$$
- Configurable base fee ($F_{\text{base}}$), per-station rate ($R_{\text{station}}$), and class multipliers (First Class 1.5x, Second Class 1.2x, Third Class 1.0x).

---

## Extra Credit Features Built

1. **Interactive Coach Seat Map Visualization**:
   - Visual coach selector and seat grid layout.
   - Tooltip hover displaying exact occupied station legs.
   - Visual distinction between fully free seats, segment-reused seats (free for your requested leg), and occupied seats.
2. **Smart Multi-Leg Seat Hop Recommendation Cards**:
   - Automatically suggests seat transfer options when direct seats are full.
3. **Department Admin Portal & Analytics**:
   - Real-time revenue breakdown and average line segment occupancy (%).
   - Visual bottleneck progress bars across all 17 station intervals along the line.
   - Dynamic infrastructure manager (Add new coaches / seats on the fly).
4. **Reservation Hold Expiry Timer**:
   - 5-minute temporary seat hold during guest checkout with automatic background expiry worker.
5. **Printable E-Ticket Receipt & PNR Verification**:
   - Official Sri Lanka Railways E-Receipt generator with QR code, PNR reference number, and print/PDF support.
6. **Priority Segment Waitlist**:
   - SMS waitlist registration for sold-out route segments.

---

## Quick Start / Launch Instructions

### Option 1: One-Shot Docker Launch (Recommended)

Ensure Docker Desktop is running, then run:

```bash
docker-compose up --build
```

- **Frontend Application**: `http://localhost:3000`
- **Backend API**: `http://localhost:5001`
- **PostgreSQL Database**: `localhost:5432`
- **Redis Cache**: `localhost:6379`

---

### Option 2: Local Development Setup

#### Prerequisites
- Node.js v20+
- PostgreSQL 16+
- Redis 7+

#### 1. Setup Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npx prisma seed
npm run dev
```

#### 2. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in your web browser.
