# Sri Lanka Railways — Segment-Based Train Seat Booking System

A production-grade, segment-based train seat booking platform for Sri Lanka's iconic **Colombo Fort – Badulla** scenic mainline (292 km, 18 stations). The system models each physical seat as a sequence of station-to-station segments and allows independent booking of non-overlapping segments on the same seat, maximizing train utilization and railway department revenue.

> **Core Innovation:** Unlike traditional booking systems that treat a seat as a single atomic unit for an entire journey, this system uses **integer-range interval arithmetic** to partition each seat into independently bookable station segments — enabling multiple passengers to occupy the same physical seat on different legs of the same journey.

---

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [System Component Map](#system-component-map)
- [Core Algorithms & Data Structures](#core-algorithms--data-structures)
  - [1. Segment Overlap Detection via Semi-Open Integer Ranges](#1-segment-overlap-detection-via-semi-open-integer-ranges)
  - [2. Gap Calculation Algorithm (Available Segment Finder)](#2-gap-calculation-algorithm-available-segment-finder)
  - [3. Greedy Multi-Hop Seat Recommendation (Gap-Finder)](#3-greedy-multi-hop-seat-recommendation-gap-finder)
  - [4. Dynamic Distance-Based Fare Engine](#4-dynamic-distance-based-fare-engine)
  - [5. Scenic Route Recommendation Algorithm](#5-scenic-route-recommendation-algorithm)
- [Concurrency & Double-Booking Prevention](#concurrency--double-booking-prevention)
  - [Layer 1: Redis Distributed Locking (Application Level)](#layer-1-redis-distributed-locking-application-level)
  - [Layer 2: PostgreSQL GiST Exclusion Constraint (Database Level)](#layer-2-postgresql-gist-exclusion-constraint-database-level)
  - [Layer 3: Hold-and-Confirm Two-Phase Booking](#layer-3-hold-and-confirm-two-phase-booking)
  - [Why Three Layers? Defense-in-Depth Analysis](#why-three-layers-defense-in-depth-analysis)
- [CQRS Read/Write Separation](#cqrs-readwrite-separation)
- [Rate Limiting Strategy](#rate-limiting-strategy)
- [Observability Stack (Three Pillars)](#observability-stack-three-pillars)
- [Database Design](#database-design)
- [API Surface](#api-surface)
- [Frontend Architecture](#frontend-architecture)
- [Security Considerations](#security-considerations)
- [Infrastructure & Deployment](#infrastructure--deployment)
- [Quick Start](#quick-start)
- [Testing](#testing)
- [Technology Stack](#technology-stack)

---

## Features

### 🚂 Core Booking Engine

| Feature | Description |
|---|---|
| **Segment-Based Seat Booking** | Seats are not booked as atomic units — each seat is partitioned into independently bookable station-to-station segments using semi-open integer ranges `[start, end)`. Multiple passengers can occupy the same physical seat on non-overlapping legs of a journey. |
| **Multi-Seat Batch Booking** | Passengers can select and book multiple seats simultaneously in a single transaction, with atomic all-or-nothing confirmation. |
| **Three-Layer Double-Booking Prevention** | Defense-in-depth concurrency control: Redis distributed locks (application layer) → application-level overlap validation → PostgreSQL GiST exclusion constraint (database layer). Each layer independently prevents conflicts. |
| **5-Minute Reservation Hold with Auto-Expiry** | Temporary `PENDING` seat holds give passengers time to complete checkout. A background worker runs every 15 seconds to bulk-expire abandoned holds, freeing seats back to the pool. |
| **CQRS Read/Write Separation** | Availability queries are served from pre-computed Redis Hash cache in O(1), with event-driven granular cache updates after each booking state change — no full cache rebuilds. |
| **Dynamic Distance-Based Fare Calculation** | Fares computed as `baseFare + (stationsTraversed × ratePerStation) + windowSurcharge`, with all parameters independently configurable per coach from the admin dashboard. |
| **Configurable Booking Window** | Admin-controlled advance booking limit (default 30 days). Date picker and backend validation enforce the window. |

### 🗺️ Interactive Seat Map & Visualization

| Feature | Description |
|---|---|
| **Physical Coach Layout Simulation** | Seat grid mirrors real coach geometry: rows, aisle gap (40px CSS spacer), locomotive direction indicator, and seat numbering matching physical positions. |
| **Three-State Seat Coloring** | Seats display as **green** (fully available for requested leg), **amber** (partially occupied on other legs but free for yours — segment reuse), or **red** (occupied for your requested leg, click-disabled). |
| **Segment Occupancy Tooltips** | Hovering over any seat reveals which specific station legs are currently booked, allowing passengers to understand exactly why a seat is partially or fully occupied. |
| **Window Seat Highlighting** | Window seats are auto-detected via `seatNumber % seatsPerRow` and marked with a cyan border + sparkle icon, making premium seats easy to identify. |
| **Coach Selector with Live Pricing** | Horizontal tab bar showing all reserved coaches with class type, calculated fare for the selected route, and count of available seats — lets passengers compare coaches at a glance. |
| **Visual Journey Timeline** | Horizontal timeline showing origin, destination, and intermediate scenic attraction stations, with camera icons for tourist highlights along the route. |

### 🧠 Smart Recommendations

| Feature | Description |
|---|---|
| **Multi-Leg Seat Hop Recommendations** | When no single seat covers the entire requested route, the system uses a greedy interval-covering algorithm to suggest optimal seat combinations (e.g., Seat A-01 Colombo→Kandy + Seat B-05 Kandy→Badulla), presented as bookable recommendation cards. |
| **Unreserved Fallback Legs** | If a gap exists where no reserved seat is available, the recommendation inserts an "Unreserved" placeholder leg so passengers can still complete their journey. |
| **Scenic Route Side Recommendations** | Analyzes the travel direction and overlapping scenic attractions (Demodara Nine Arch Bridge, St. Clair's Falls, Horton Plains, etc.) to recommend LEFT or RIGHT window side for the best views. Direction-aware: recommendations flip when traveling Badulla→Colombo. |
| **Scenic Attraction Hover Cards** | React Portal-based floating cards appear on hover over scenic icons, showing an Unsplash photo, attraction name, and description — positioned dynamically via `getBoundingClientRect()`. |

### 📊 Department Admin Portal & Analytics

| Feature | Description |
|---|---|
| **Real-Time Revenue Dashboard** | KPI cards displaying total confirmed revenue, average line occupancy percentage across all 17 station intervals, and active booking counts with confirmed/pending breakdown. |
| **Per-Segment Occupancy Breakdown** | Horizontal bar chart showing occupancy % for each of the 17 consecutive station pairs. Color-coded: cyan-to-emerald gradient for normal (<75%), amber-to-rose for bottleneck segments (>75%). |
| **Dynamic Coach Management** | Create new coaches (name, type, class, rows, seats-per-row, seat prefix) directly from the admin UI. Seats are auto-generated based on the grid configuration. |
| **Live Pricing Configuration** | Inline-editable table for each coach's `baseFare`, `ratePerStation`, and `windowSurcharge`. Changes take effect immediately for subsequent bookings. |
| **Ticket Checker Account Management** | Create, update passwords, and delete onboard ticket inspector accounts from the admin portal. |
| **System Settings** | Configurable booking window (1–365 days) controlling how far in advance passengers can book. |

### 🎫 Ticketing & Verification

| Feature | Description |
|---|---|
| **Printable E-Ticket Receipt** | Official Sri Lanka Railways e-ticket with PNR reference, passenger details, route, seat/coach, fare breakdown, and `window.print()` support for PDF generation. |
| **QR Code Generation** | Each e-ticket includes a QR code (via `qrcode.react`) encoding the PNR string — scannable by the ticket checker portal for instant validation. |
| **QR Camera Scanner** | Onboard ticket checkers use the `html5-qrcode` camera scanner (10fps, 250×250 scan box) to scan passenger QR codes and instantly validate ticket authenticity. |
| **Manual PNR Validation** | Alternative to camera scanning — checkers can type in PNR codes for manual lookup with full booking details displayed. |
| **PNR Lookup Portal** | Passengers can look up any booking by PNR number, view booking status (PENDING/CONFIRMED/EXPIRED/CANCELLED), and download the e-receipt. |
| **Multi-Ticket Navigation** | When multiple seats are booked, the receipt modal supports Prev/Next navigation with "Ticket X of Y" indicator. |

### 📋 Priority Segment Waitlist

| Feature | Description |
|---|---|
| **Sold-Out Segment Registration** | When all direct reserved seats for a route are occupied, a waitlist banner appears allowing passengers to register with name, NIC, and phone number. |
| **SMS Notification Infrastructure** | Waitlist entries track status through `WAITING → NOTIFIED → FULFILLED → CANCELLED` lifecycle, with the data model ready for SMS gateway integration. |
| **Sri Lankan Identity Validation** | Both waitlist and booking forms validate Sri Lankan NIC numbers (old 9+V/X format, new 12-digit format, passport 6–12 alphanumeric) and phone numbers (`+947XXXXXXXX` or `07XXXXXXXX`). |

### 📈 Production Observability

| Feature | Description |
|---|---|
| **Prometheus Metrics** | 6 custom metrics (booking counters, segment occupancy gauge, lock duration histogram, API latency histogram, CQRS cache hit/miss counters) plus default Node.js metrics — scraped every 15 seconds. |
| **Structured Logging → Loki** | JSON-structured logs via Pino with HTTP status-aware log levels (500→error, 400→warn), pushed directly to Grafana Loki with trace ID correlation. |
| **Distributed Tracing → Tempo** | OpenTelemetry auto-instrumentation for Express, HTTP, Prisma, and Redis, plus manual spans for lock acquisition, GiST checks, and gap-finder computation — exported to Grafana Tempo. |
| **Pre-Built Grafana Dashboard** | 4-panel dashboard: API request duration P95, bookings by status, CQRS cache hit rate, and lock acquisition duration P95. |
| **Cross-Pillar Correlation** | Every log line includes `trace_id` and `span_id` — click a log entry in Grafana and jump directly to the full distributed trace in Tempo. |
| **4-Tier Rate Limiting** | Redis-backed fixed-window counters: Global (100/min), Search (10/min), Booking (5/min), Login (5/5min) — with RFC 6585 response headers and fail-open design. |
| **Google reCAPTCHA v2** | Bot protection on all booking forms with server-side token verification via Google's API. |

---

## Architecture Overview

```
                          ┌───────────────────────────┐
                          │   Client (Web Browser)    │
                          │   React 18 + TypeScript   │
                          └────────────┬──────────────┘
                                       │ HTTP / REST
                                       ▼
                          ┌───────────────────────────┐
                          │   Node.js Express API     │
                          │   (Rate Limited + CORS)   │
                          └───┬───────────┬───────┬───┘
                              │           │       │
          1. Redis Lock (SETNX)│     2. SQL│       │ 3. OTLP/Pino
                              ▼           ▼       ▼
                   ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
                   │ Redis 7      │  │ PostgreSQL 16│  │ Observability    │
                   │ • CQRS Cache │  │ • 3NF Schema │  │ • Prometheus     │
                   │ • Seat Locks │  │ • GiST Index │  │ • Loki (logs)    │
                   │ • Rate Limit │  │ • Exclusion  │  │ • Tempo (traces) │
                   └──────────────┘  │   Constraint │  │ • Grafana (viz)  │
                         ▲           └──────────────┘  └──────────────────┘
                         │                  │
                         │  Event-Driven    │
                         │  Cache Sync      │
                         └──────────────────┘
```

**Data Flow Summary:**
1. **Reads** go to Redis (pre-computed seat gap summaries, O(1) lookup)
2. **Writes** go to PostgreSQL (atomic transactions, GiST constraint enforcement)
3. **Cache sync** happens event-driven after every write (granular per-seat update, not full rebuild)
4. **Observability data** flows to Prometheus (metrics), Loki (logs), and Tempo (traces) — all correlated via trace IDs and visualized in Grafana

---

## System Component Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        docker-compose.yml                               │
│                                                                         │
│  ┌────────────┐   ┌─────────────┐   ┌──────────────┐  ┌──────────────┐ │
│  │ Frontend   │──▶│  Backend    │──▶│ PostgreSQL   │  │    Redis     │ │
│  │ React+Vite │   │  Express.js │──▶│ 16-alpine    │  │  7-alpine    │ │
│  │ :5173      │   │  :5001      │   │ :5432        │  │  :6379       │ │
│  └────────────┘   └──┬──┬──┬───┘   │ + btree_gist │  │ + CQRS Hash  │ │
│                      │  │  │       │ + GiST excl. │  │ + SETNX Lock │ │
│                      │  │  │       └──────────────┘  │ + Rate Limit │ │
│                      │  │  │                          └──────────────┘ │
│                      │  │  │                                           │
│            ┌─────────┘  │  └─────────────┐                             │
│            ▼            ▼                ▼                              │
│     ┌───────────┐  ┌──────────┐  ┌────────────┐                       │
│     │Prometheus │  │   Loki   │  │   Tempo    │                       │
│     │ (metrics) │  │  (logs)  │  │  (traces)  │                       │
│     │  :9090    │  │  :3100   │  │  :4318     │                       │
│     └─────┬─────┘  └────┬─────┘  └─────┬──────┘                       │
│           └──────────────┼──────────────┘                              │
│                          ▼                                              │
│                   ┌───────────┐                                         │
│                   │  Grafana  │                                         │
│                   │  :3001    │                                         │
│                   └───────────┘                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

| Service | Image | Port | Role |
|---------|-------|------|------|
| Frontend | `node:20-alpine` (dev) / `nginx:alpine` (prod) | 5173 / 3000 | React SPA with interactive seat maps |
| Backend | Custom `node:20` Dockerfile | 5001 | REST API, booking engine, background workers |
| PostgreSQL | `postgres:16-alpine` | 5432 | Primary data store with GiST exclusion constraints |
| Redis | `redis:7-alpine` | 6379 | CQRS cache, distributed locks, rate limiting |
| Prometheus | `prom/prometheus:latest` | 9090 | Time-series metrics collection (pull-based) |
| Grafana | `grafana/grafana:latest` | 3001 | Unified observability dashboards |
| Loki | `grafana/loki:3.5.0` | 3100 | Log aggregation with label-based indexing |
| Tempo | `grafana/tempo:latest` | 4318 | Distributed tracing backend |

---

## Core Algorithms & Data Structures

### 1. Segment Overlap Detection via Semi-Open Integer Ranges

**The Problem:** Each of the 18 stations on the Colombo Fort–Badulla line has a `sequenceNumber` (1–18). A booking from Colombo Fort (seq 1) to Kandy (seq 8) occupies a *range* of station segments. We need to determine: does a new booking request overlap with any existing booking on the same seat, same date?

**The Solution:** Model each booking as a **semi-open integer interval** `[startSeq, endSeq)` and use standard interval overlap arithmetic.

**Why Semi-Open Intervals `[start, end)` Instead of Closed Intervals `[start, end]`:**

| Interval Type | Colombo→Kandy | Kandy→Badulla | Overlap? | Seat Reusable at Kandy? |
|---|---|---|---|---|
| Closed `[1, 8]` and `[8, 18]` | ✅ Overlap at 8 | ❌ No | ❌ No — false conflict |
| Semi-Open `[1, 8)` and `[8, 18)` | ❌ No overlap | ✅ Yes | ✅ Yes — correct! |

Semi-open intervals naturally handle the boundary case: when Passenger A exits at Kandy (seq 8), the seat is free for Passenger B to board at Kandy (seq 8). Closed intervals would falsely report a conflict.

**Overlap Detection Formula:**
```
isOverlapping(A, B) = A.start < B.end && A.end > B.start
```
Where both `A` and `B` are `[start, end)`. This is a well-known O(1) interval overlap test.

**Direction Awareness:** The system also handles bidirectional travel. An "up" journey (Colombo→Badulla, `start < end`) and a "down" journey (Badulla→Colombo, `start > end`) on the same date/seat don't conflict because the train makes only one trip per direction per day. The system normalizes direction before comparison.

**Alternatives Considered:**
| Alternative | Why Rejected |
|---|---|
| Bitmap per station (1 bit per segment) | O(S) space per seat per date; harder to query ranges; doesn't leverage PostgreSQL's native range operators |
| Adjacency list of occupied segments | Same complexity but loses the mathematical elegance of range operators; can't use GiST exclusion constraints |
| Closed intervals `[start, end]` | Creates false overlaps at boundary stations (explained above) |

---

### 2. Gap Calculation Algorithm (Available Segment Finder)

**The Problem:** Given a seat with some booked segments, find all the *available* (unbooked) gaps for that seat on a given date.

**The Algorithm (`calculateGaps`):**

```
Input:  bookings[] (for one seat on one date), minSeq, maxSeq
Output: { occupiedIntervals[], availableGaps[] }

1. SORT bookings by startStationSeq ascending          — O(n log n)
2. SET pointer = minSeq
3. FOR each booking in sorted order:                    — O(n)
     IF booking.start > pointer:
       EMIT gap [pointer, booking.start)               ← free segment
     RECORD occupied interval [booking.start, booking.end)
     pointer = MAX(pointer, booking.end)
4. IF pointer < maxSeq:
     EMIT gap [pointer, maxSeq)                        ← trailing free segment
```

**Time Complexity:** O(n log n) dominated by the sort; the scan itself is O(n).  
**Space Complexity:** O(n) for storing gaps and occupied intervals.

**Example:**
```
Seat A-01 on 2025-01-15:
  Booking 1: [1, 8)   (Colombo → Kandy)
  Booking 2: [12, 18) (Nanu Oya → Badulla)

calculateGaps(bookings, minSeq=1, maxSeq=18):
  Occupied: [1,8), [12,18)
  Gaps:     [8,12)  ← Kandy to Nanu Oya is available!
```

This powers the interactive seat map: seats with gaps covering the user's requested route are shown as "available" (green), seats with some gaps but not covering the requested route are "partially available" (amber), and fully occupied seats are red.

**Alternatives Considered:**
| Alternative | Why Rejected |
|---|---|
| Brute-force check every station pair | O(S²) where S = 18 stations — wasteful |
| Interval tree data structure | O(n log n) but adds implementation complexity; the simple linear scan is sufficient for ≤ dozens of bookings per seat |

---

### 3. Greedy Multi-Hop Seat Recommendation (Gap-Finder)

**The Problem:** When no single seat can cover the user's entire requested route (e.g., Colombo→Badulla), traditional systems show "Sold Out." We want to suggest *combinations* of seats across different legs to complete the journey.

**The Algorithm (Greedy Interval Covering):**

```
Input:  requestedRoute [reqStart, reqEnd), all seat availability from CQRS cache
Output: list of LegOptions (seat assignments per sub-leg)

1. FILTER OUT seats that cover the entire route (we want multi-hop only)
2. SET currentSeq = reqStart
3. WHILE currentSeq < reqEnd:
     FOR each candidate seat:
       FIND the gap in this seat that contains currentSeq
       COMPUTE reachableEnd = min(gap.end, reqEnd)
     PICK seat with MAXIMUM reachableEnd            ← greedy choice
     IF no reserved seat available at currentSeq:
       FIND next station where any seat is available
       INSERT "Unreserved" placeholder leg for the gap
     EMIT leg: {seat, startSeq=currentSeq, endSeq=reachableEnd}
     currentSeq = reachableEnd
4. CALCULATE fares: base fare charged only on longest leg
```

**Time Complexity:** O(S × G) where S = number of candidate seats (~70) and G = average gaps per seat (~2–3). Effectively O(N) in practice.

**Why Greedy Works (and is Optimal):**

This is an instance of the **Interval Covering Problem**: given a target interval and a set of sub-intervals, find the minimum number of sub-intervals that cover the target. The greedy strategy of *always extending as far as possible* is **provably optimal** for this problem class (see: Cormen et al., *Introduction to Algorithms*, Activity Selection / Interval Scheduling).

**Proof intuition:** If we have a gap from position X, choosing the seat that reaches furthest can never be worse than any other choice — it either matches or exceeds any alternative's coverage, leaving the same or fewer remaining stations to cover.

**Alternatives Considered:**
| Alternative | Why Rejected |
|---|---|
| Exhaustive search with backtracking | Exponential time O(S^L) where L = legs; impractical for 70+ seats |
| Dynamic programming | O(S × N) but overkill — the greedy solution is already optimal for this problem class |
| Integer Linear Programming (ILP) | Requires a solver library, adds latency; unnecessary given the greedy optimality proof |
| Random/heuristic search | No optimality guarantee; greedy already gives the global optimum |

---

### 4. Dynamic Distance-Based Fare Engine

**The Formula:**

$$F_{\text{total}} = F_{\text{base}} + \left(\lvert S_{\text{dest}} - S_{\text{origin}} \rvert \times R_{\text{station}}\right) + W_{\text{surcharge}}$$

Where:
- $F_{\text{base}}$ — Per-coach base fare (configurable, e.g., ₨500 for First Class)
- $S_{\text{dest}}, S_{\text{origin}}$ — Destination and origin station sequence numbers
- $R_{\text{station}}$ — Per-station rate (configurable per coach, e.g., ₨100/station for First Class)
- $W_{\text{surcharge}}$ — Window seat premium (e.g., ₨200 for First Class window)

**Per-Coach Pricing:** Each coach has independently configurable `baseFare`, `ratePerStation`, and `windowSurcharge`. This allows the railway department to:
- Price First Class (₨500 base + ₨100/station) higher than Third Class (₨100 base + ₨25/station)
- Add premiums for scenic observation cars
- Dynamically adjust pricing from the admin dashboard

**Window Seat Detection:**
```
isWindowSeat(seatNumber, seatsPerRow) =
    seatNumber % seatsPerRow === 1 || seatNumber % seatsPerRow === 0
```
In a 4-seat row (Window | Aisle || Aisle | Window), positions 1 and 4 (≡0 mod 4) are windows.

**Multi-Leg Fare Optimization:** For seat-hop tickets, the base fare is charged only on the **longest leg** to avoid penalizing passengers who couldn't get a direct seat. Per-station rates apply to all legs.

**Time Complexity:** O(1) — pure arithmetic computation.

**Alternatives Considered:**
| Alternative | Why Rejected |
|---|---|
| Flat fare per route | Unfair to short-distance passengers; doesn't incentivize partial-route travel |
| Distance-in-km based pricing | Station sequence differences approximate distance well enough; actual km-based math adds complexity for marginal accuracy gain |
| Dynamic/surge pricing | Useful for airlines but adds unpredictability to a public railway; fixed per-coach pricing is fairer |
| Zone-based pricing | Groups stations into zones, losing granularity; sequence-based pricing is strictly more precise |

---

### 5. Scenic Route Recommendation Algorithm

**The Problem:** The Colombo–Badulla line passes through Sri Lanka's most stunning scenery. Help passengers choose the best window side.

**Database of 5 Scenic Attractions:**

| Attraction | Station Range | Best Viewing Side (Going Up) |
|---|---|---|
| Balana Pass & Kadugannawa | seq 6→8 | LEFT |
| St. Clair's & Devon Falls | seq 10→11 | RIGHT |
| Horton Plains & Pine Forests | seq 11→14 | BOTH |
| Haputale Gap & Thangamale | seq 14→17 | RIGHT |
| Demodara Nine Arch Bridge | seq 17→18 | LEFT |

**Algorithm (`getScenicRecommendations`):**
```
1. DETERMINE travel direction: up (Colombo→Badulla) or down (reverse)
2. FILTER attractions overlapping the user's travel segment
3. FOR each visible attraction:
     IF going DOWN: flip LEFT ↔ RIGHT (mirror viewing side)
4. VOTE: count leftVotes vs rightVotes
5. RETURN bestSide: LEFT if leftVotes > rightVotes,
                    RIGHT if rightVotes > leftVotes,
                    BOTH if tied
```

The direction-flip is necessary because if you're traveling Badulla→Colombo, the Nine Arch Bridge (which is on the LEFT going up) is now on the RIGHT.

---

## Concurrency & Double-Booking Prevention

The system employs a **three-layer defense-in-depth** strategy against double bookings. Each layer operates independently, so even if one layer fails, the others catch the conflict.

```
 Request arrives
      │
      ▼
┌─────────────────────────────┐
│ LAYER 1: Redis SETNX Lock   │  ← Application-level pessimistic lock
│ Key: lock:seat:{id}:{date}  │     Prevents concurrent processing
│ TTL: 5 seconds              │     of the same seat
└──────────────┬──────────────┘
               │ Lock acquired
               ▼
┌─────────────────────────────┐
│ LAYER 2: Application Logic   │  ← Overlap check against existing
│ isOverlapping() check        │     bookings from database
│ Semi-open interval math      │
└──────────────┬──────────────┘
               │ No overlap found
               ▼
┌─────────────────────────────┐
│ LAYER 3: PostgreSQL GiST    │  ← Database-level exclusion
│ Exclusion Constraint         │     constraint (atomic, unfoolable)
│ int4range overlap rejection  │     FINAL safety net
└──────────────┬──────────────┘
               │ Constraint passes
               ▼
         Booking Created ✅
```

### Layer 1: Redis Distributed Locking (Application Level)

**Mechanism:** `SET lock:seat:{seatId}:{date} LOCKED EX 5 NX`

The `SETNX` (SET if Not eXists) command is **atomic** in Redis — only one client can acquire the lock. The 5-second TTL prevents deadlocks if the server crashes mid-transaction.

**Single-Seat Booking Flow:**
1. Attempt `SETNX` on `lock:seat:{seatId}:{date}` — O(1)
2. If lock acquired: proceed with overlap check → fare calculation → booking creation → cache update
3. `finally` block: **always** release lock via `DEL` (even on error)
4. If lock NOT acquired: immediately return `409 Conflict` with clean error message

**Multi-Leg Booking Flow:**
1. `asyncAcquireSeatLocks()`: acquire locks for **all** legs **sequentially**
2. If **any** lock fails: rollback all previously acquired locks immediately
3. Execute all leg bookings inside a Prisma `$transaction` (atomic DB operation)
4. `finally`: release all locks

**Lock Timing Observability:** Lock acquisition duration is measured via `process.hrtime()` and recorded in a Prometheus histogram (`railway_lock_acquisition_duration_seconds`) — visualized on the Grafana dashboard to detect lock contention hotspots.

**Why Redis SETNX Over Alternatives:**

| Alternative | Pros | Cons | Why Not Chosen |
|---|---|---|---|
| **Redis Redlock** | More robust for multi-node Redis | Requires 3+ Redis nodes, complex setup | Single Redis node is sufficient for this scale |
| **PostgreSQL Advisory Locks** (`pg_advisory_lock`) | No external dependency | Ties up DB connections; not reentrant across services | Mixes concerns; Redis already in the stack for CQRS |
| **Optimistic Locking** (version numbers) | No lock contention | Requires retry logic; poor UX on conflicts | Users expect immediate feedback, not "try again" |
| **Database `SELECT FOR UPDATE`** | Strong consistency | Holds row-level locks for entire transaction duration; degrades under load | Too coarse; Redis lock is released in ~ms |

---

### Layer 2: PostgreSQL GiST Exclusion Constraint (Database Level)

**Setup (via `init-extensions.sql`):**

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking" ADD CONSTRAINT no_double_booking
EXCLUDE USING gist (
    "seatId"  WITH =,
    "date"    WITH =,
    int4range("startStationSeq", "endStationSeq") WITH &&
) WHERE ("status" IN ('PENDING', 'CONFIRMED'));
```

**How It Works:**

1. **`btree_gist` extension**: Adds B-tree operator support to GiST indexes, enabling equality (`=`) operators alongside range overlap (`&&`) operators in the same index.

2. **GiST Index**: A Generalized Search Tree — a balanced, disk-based tree structure that supports multi-dimensional queries. Unlike B-tree (which handles only equality/ordering), GiST can answer "does any existing range overlap with this new range?" in O(log n).

3. **Exclusion Constraint**: Enforces that no two rows can satisfy all the `WITH` conditions simultaneously:
   - Same `seatId` (equality `=`)
   - Same `date` (equality `=`)
   - Overlapping station ranges (range overlap `&&`)
   - Only for active bookings (`WHERE status IN ('PENDING', 'CONFIRMED')`)

4. **`int4range` with semi-open intervals**: `int4range(1, 8)` creates `[1, 8)`. The `&&` operator returns true if two ranges share any points. `[1,8) && [8,18)` is **false** — they're adjacent but not overlapping.

**Why This Is the Ultimate Safety Net:** Even if the Redis lock fails (Redis crash), even if the application-level overlap check has a race condition, the GiST constraint **cannot be bypassed**. It operates at the storage engine level inside PostgreSQL's transaction isolation. Two concurrent `INSERT` statements with overlapping ranges will result in one succeeding and one receiving a constraint violation error — guaranteed by PostgreSQL's MVCC and WAL.

**Lookup Complexity:** O(log n) via the GiST index — not a full table scan.

**Why GiST Over Alternatives:**

| Alternative | Pros | Cons | Why Not Chosen |
|---|---|---|---|
| **Application-only overlap check** | Simpler | Race conditions under concurrency; two requests can both pass the check before either writes | Not reliable as sole defense |
| **Unique constraint on (seatId, date, stationSeq)** | Simple | Doesn't handle *ranges* — only exact matches; can't detect that `[3,7)` conflicts with `[5,10)` | Wrong abstraction for ranges |
| **Trigger-based validation** | Flexible | Slower (PL/pgSQL overhead); harder to maintain; still susceptible to race conditions without serializable isolation | GiST is declarative and faster |
| **Serializable transaction isolation** | Strong consistency | Severe performance penalty; locks entire table sections; causes frequent serialization failures | Too aggressive for a booking system's read-heavy workload |
| **Separate segment occupancy table** (one row per seat-station pair) | Explicit | Dramatically increases write amplification (17 rows per booking vs. 1); complex schema | GiST achieves the same result with a single row per booking |

---

### Layer 3: Hold-and-Confirm Two-Phase Booking

**The Problem:** Users need time to fill in passenger details and "pay," but we can't hold a seat indefinitely while they browse.

**The Solution:** A two-phase booking flow with automatic expiration:

```
Phase 1: HOLD (createHoldBooking)
  ├── Creates PENDING booking
  ├── Sets holdExpiresAt = now + 300 seconds (5 minutes)
  ├── Seat is "locked" in availability (GiST constraint active)
  └── Frontend shows countdown timer

Phase 2: CONFIRM (confirmBooking)
  ├── Transitions PENDING → CONFIRMED
  ├── Validates holdExpiresAt not passed
  └── Issues PNR and E-Ticket

Background: EXPIRE WORKER (every 15 seconds)
  ├── Bulk-updates all PENDING bookings where holdExpiresAt < now → EXPIRED
  ├── Updates CQRS cache for each expired seat
  └── Frees seats for other passengers
```

**PNR Generation:** `crypto.randomBytes(3).toString('hex').toUpperCase()` → 6 hex characters → formatted as `SLR-XXXXXX`. This yields 16⁶ = 16,777,216 possible PNRs — sufficient for a single-line railway system.

**Why 5-Minute Hold (Not Longer/Shorter):**
- Too short (< 2 min): Users can't complete the form, creating frustration
- Too long (> 10 min): Seats are unavailable to other passengers for extended periods, reducing utilization
- 5 minutes: Industry standard for ticket holding (similar to Ticketmaster, airline booking systems)
- Configurable via `HOLD_TTL_SECONDS` environment variable

**Alternatives Considered:**
| Alternative | Why Rejected |
|---|---|
| No hold (immediate booking) | Users might book accidentally; no time for payment processing |
| Optimistic reservation (book on search) | Wastes seats for users who are just browsing |
| Queue-based booking | Adds latency; users expect immediate seat selection |

---

### Why Three Layers? Defense-in-Depth Analysis

| Scenario | Layer 1 (Redis Lock) | Layer 2 (App Check) | Layer 3 (GiST) | Outcome |
|---|---|---|---|---|
| Normal booking | ✅ Blocks concurrent | ✅ Validates | ✅ Enforces | Clean booking |
| Two simultaneous requests, same seat | ✅ One blocked | N/A | N/A | Second gets 409 |
| Redis down | ❌ Fails open | ✅ Catches overlap | ✅ Final defense | DB rejects duplicate |
| Race condition in app logic | ✅ Serializes | ❌ Might miss | ✅ Catches it | DB saves the day |
| All systems working | ✅ Fast rejection | ✅ Clean validation | ✅ Never triggered | Best performance |

**Key Insight:** Each layer optimizes for a different scenario:
- **Redis Lock**: Fast rejection of concurrent requests (saves DB round-trips)
- **App Check**: Clean error messages and business logic validation
- **GiST Constraint**: Mathematically guaranteed correctness regardless of application bugs

---

## CQRS Read/Write Separation

**The Problem:** Calculating seat availability by joining bookings × seats × stations for every search request is expensive under load. With 70+ reserved seats, 18 stations, and potentially hundreds of bookings per day, this becomes a bottleneck.

**The Solution:** Command Query Responsibility Segregation (CQRS) — separate the read model from the write model.

```
WRITE PATH (Commands):                READ PATH (Queries):
                                      
  User books a seat                     User searches availability
       │                                     │
       ▼                                     ▼
  PostgreSQL INSERT                     Redis HVALS O(1)
  (with GiST check)                    cache:seatGaps:{date}:{direction}
       │                                     │
       ▼                                     ▼
  Event: booking created               Parse JSON summaries
       │                               Compute isAvailableForRequestedLeg
       ▼                               per seat using overlap formula
  updateSeatAvailabilityInCache()            │
  HSET only the affected seat               ▼
  (granular, not full rebuild)          Return availability grid
```

**Cache Structure:**
- **Key**: `cache:seatGaps:{date}:UP` or `cache:seatGaps:{date}:DOWN` (Redis Hash)
- **Field**: `{seatId}` (each seat is a separate hash field)
- **Value**: JSON-encoded `SeatGapSummary` containing `occupiedIntervals[]`, `availableGaps[]`, seat metadata, and fare info
- **TTL**: 3600 seconds (1 hour), auto-refreshed on write

**Granular Cache Update (Not Full Rebuild):**

After each booking state change (create, confirm, expire), only the affected seat's hash field is updated via `HSET`. This is O(1) per booking event, compared to O(S) for a full cache rebuild across all seats.

**Cache Miss Handling:** If the Redis Hash doesn't exist (cold start or TTL expiry), the system rebuilds from PostgreSQL: fetches all active bookings, runs `calculateGaps()` for each seat, and populates the entire Hash.

**Observability:** Cache hit/miss rates are tracked via Prometheus counters (`railway_cqrs_cache_hits_total`, `railway_cqrs_cache_misses_total`) and visualized on the Grafana dashboard.

**Why CQRS Over Alternatives:**

| Alternative | Pros | Cons | Why Not Chosen |
|---|---|---|---|
| **PostgreSQL Materialized Views** | Native, no external dependency | `REFRESH MATERIALIZED VIEW` is expensive and blocks reads; not truly real-time | Too slow for real-time availability |
| **In-memory LRU cache** (e.g., `node-cache`) | Simplest | Not shared across instances; lost on restart | Can't scale horizontally |
| **Read replicas** | Scales reads | Still performing expensive joins; replication lag | Doesn't solve the fundamental query complexity |
| **Denormalized availability table** | Fast reads | Complex write logic; schema duplication; consistency challenges | Redis Hash achieves the same with less schema complexity |

---

## Rate Limiting Strategy

**Algorithm:** Redis-backed **fixed-window counter** per client IP.

**Implementation:**
```
1. Key: ratelimit:{prefix}:{ip}
2. INCR key                    — atomic counter increment (O(1))
3. If count === 1: EXPIRE key {windowSec} — start TTL window
4. If count > maxRequests: return 429 Too Many Requests
```

**Four Tiers:**

| Tier | Window | Max Requests | Applied To | Rationale |
|---|---|---|---|---|
| Global | 60s | 100 | All `/api/*` routes | General abuse prevention |
| Search | 60s | 10 | Seat availability, mixed tickets | Prevent scraping/DoS on compute-heavy queries |
| Booking | 60s | 5 | Hold, confirm, waitlist mutations | Prevent booking bots |
| Login | 300s | 5 | Admin + checker login | Brute-force protection |

**Fail-Open Design:** If Redis is down, requests pass through without rate limiting. This prioritizes **availability** over **protection** — a booking system should never deny legitimate users because of a monitoring component failure.

**Response Headers:** Every response includes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and (on 429) `Retry-After` — following RFC 6585 best practices.

**Why Fixed-Window Over Alternatives:**

| Alternative | Pros | Cons | Why Not Chosen |
|---|---|---|---|
| **Sliding window log** | Most accurate; no boundary burst | O(n) memory per client; requires sorted sets or Lua scripts | Complexity not justified for this use case |
| **Token bucket** | Smooth rate; allows controlled bursts | Requires timer logic or Lua scripts; more state per client | More complex with marginal benefit |
| **`express-rate-limit`** (in-memory) | Zero dependencies | Not shared across instances; lost on restart | Doesn't work in multi-instance deployments |
| **Leaky bucket** | Steady output rate | Harder to implement; can delay legitimate requests | Not suitable for bursty web traffic |

---

## Observability Stack (Three Pillars)

The system implements all three pillars of modern observability, fully correlated via trace IDs:

### Pillar 1: Metrics (Prometheus + prom-client → Grafana)

**Custom Metrics Exposed at `/metrics`:**

| Metric | Type | Labels | Purpose |
|---|---|---|---|
| `railway_seat_bookings_total` | Counter | `status` | Track booking lifecycle (pending, confirmed, expired, conflict_rejected) |
| `railway_segment_occupancy_ratio` | Gauge | `from_station`, `to_station` | Per-segment utilization percentage |
| `railway_lock_acquisition_duration_seconds` | Histogram | — | Detect lock contention (8 buckets: 1ms–5s) |
| `railway_api_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | API latency percentiles (10 buckets: 5ms–10s) |
| `railway_cqrs_cache_hits_total` | Counter | — | CQRS cache effectiveness |
| `railway_cqrs_cache_misses_total` | Counter | — | Cache miss frequency |

Plus all default Node.js metrics (event loop lag, heap usage, GC pauses, active handles).

**Grafana Dashboard Panels:**
1. **API Request Duration** — P95 latency by method/route/status
2. **Bookings by Status** — Rate of bookings by lifecycle state
3. **CQRS Cache Hit Rate** — `hits / (hits + misses)` ratio
4. **Lock Acquisition Duration** — P95 lock wait time

### Pillar 2: Logs (Pino → pino-loki → Loki → Grafana)

- **Structured JSON** logging via `pino` (fastest Node.js logger)
- **HTTP request logging** via `pino-http` with custom log levels:
  - Status 500+ → `error`
  - Status 400+ → `warn`
  - All others → `info`
- **Direct push** to Loki via `pino-loki` transport (no log shipping agent needed)
- **Trace correlation**: Every log line includes `trace_id` and `span_id` from OpenTelemetry context — enabling click-through from logs to traces in Grafana

### Pillar 3: Traces (OpenTelemetry SDK → Tempo → Grafana)

- **Automatic instrumentation** via `@opentelemetry/auto-instrumentations-node`: HTTP, Express, Prisma, Redis calls are all traced automatically
- **Manual spans** for critical business logic:
  - `seat.lock_acquisition` — Redis lock timing
  - `seat.gist_exclusion_check` — Database constraint verification
  - `gap_finder.calculate_greedy_hops` — Multi-hop recommendation computation
- **OTLP HTTP exporter** sends traces to Tempo at `http://tempo:4318/v1/traces`

**Cross-Pillar Correlation:** Logs contain `trace_id` → click a log in Grafana → jump to the full distributed trace in Tempo → see the exact sequence of Redis locks, DB queries, and API calls.

---

## Database Design

**7 Models across 4 Enums, normalized to 3NF:**

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Station    │     │    Coach     │     │     Seat     │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id           │     │ id           │     │ id           │
│ name         │     │ name         │  ┌──│ coachId (FK) │
│ code         │     │ type (enum)  │◀─┘  │ seatNumber   │
│ sequenceNum  │     │ classType    │     └──────┬───────┘
│ distanceKm   │     │ baseFare     │            │
└──────────────┘     │ ratePerStn   │            │
                     │ windowSurch. │     ┌──────▼───────┐
                     │ rows         │     │   Booking    │
                     │ seatsPerRow  │     ├──────────────┤
                     └──────────────┘     │ id           │
                                          │ pnr          │
┌──────────────┐                          │ seatId (FK)  │
│  Waitlist    │                          │ date         │
├──────────────┤                          │ startStnSeq  │
│ id           │                          │ endStationSeq│
│ date         │                          │ status (enum)│
│ startStnSeq  │                          │ totalFare    │
│ endStnSeq    │                          │ holdExpiresAt│
│ guestName    │                          │ guestName    │
│ guestNIC     │                          │ guestNIC     │
│ guestPhone   │                          │ guestPhone   │
│ status (enum)│                          └──────────────┘
└──────────────┘
                     ┌──────────────┐     ┌──────────────┐
                     │TicketChecker │     │SystemSetting │
                     ├──────────────┤     ├──────────────┤
                     │ id           │     │ id           │
                     │ username     │     │ key          │
                     │ password     │     │ value        │
                     └──────────────┘     └──────────────┘
```

**Key Design Decisions:**

| Decision | Rationale | Alternative |
|---|---|---|
| `date` stored as `String` | Eliminates timezone conversion bugs across time zones | `DateTime` — would require UTC normalization everywhere |
| `startStationSeq`/`endStationSeq` on Booking | Enables O(1) overlap arithmetic without joins to Station table | Store only station IDs — requires join for every overlap check |
| Composite index `@@index([seatId, date])` | Optimizes the most frequent query pattern: "all bookings for seat X on date Y" | No index — full table scan on every availability check |
| Status index `@@index([status])` | Speeds up the expiry worker's `WHERE status = 'PENDING'` query | No index — worker scans all bookings |
| `@@unique([coachId, seatNumber])` | Prevents duplicate seat numbers within a coach | Application-level validation only — error-prone |

**Enums:**
- `CoachType`: `RESERVED` | `UNRESERVED`
- `ClassType`: `FIRST_CLASS` | `SECOND_CLASS` | `THIRD_CLASS`
- `BookingStatus`: `PENDING` | `CONFIRMED` | `EXPIRED` | `CANCELLED`
- `WaitlistStatus`: `WAITING` | `NOTIFIED` | `FULFILLED` | `CANCELLED`

---

## API Surface

**27 endpoints** organized by domain:

### Public Endpoints

| Method | Endpoint | Rate Limit | Description |
|---|---|---|---|
| `GET` | `/health` | None | Health check |
| `GET` | `/metrics` | None | Prometheus metrics endpoint |
| `GET` | `/api/stations` | Global (100/min) | List all 18 stations |
| `GET` | `/api/coaches` | Global | List all coaches with seats |
| `GET` | `/api/seats/availability` | Search (10/min) | Seat gap summaries from CQRS cache |
| `GET` | `/api/seats/mixed-tickets` | Search (10/min) | Multi-hop seat recommendations |
| `POST` | `/api/bookings/hold` | Booking (5/min) | Create PENDING hold on single seat |
| `POST` | `/api/bookings/hold-multi` | Booking (5/min) | Create PENDING holds on multiple seats |
| `POST` | `/api/bookings/confirm` | Booking (5/min) | Confirm single booking (PENDING→CONFIRMED) |
| `POST` | `/api/bookings/confirm-multi` | Booking (5/min) | Confirm multiple bookings atomically |
| `GET` | `/api/bookings/lookup/:pnr` | Global | Look up booking by PNR |
| `POST` | `/api/waitlist` | Booking (5/min) | Register for segment waitlist |

### Admin Endpoints (HTTP Basic Auth)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/admin/login` | Validate admin credentials |
| `GET` | `/api/admin/analytics` | Dashboard KPIs, segment occupancy, revenue |
| `GET/PUT` | `/api/admin/settings` | System settings (booking window days) |
| `POST` | `/api/admin/coaches` | Create new coach with seats |
| `PUT` | `/api/admin/coaches/:id/pricing` | Update coach fare configuration |
| `DELETE` | `/api/admin/coaches/:id` | Delete coach and all its seats |
| `GET/POST` | `/api/admin/checkers` | List / create ticket checkers |
| `PUT/DELETE` | `/api/admin/checkers/:id` | Update / delete ticket checker |

### Checker Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/checker/login` | Checker authentication |
| `GET` | `/api/checker/scan/:pnr` | Validate ticket by PNR (used by QR scanner) |

Full API documentation available in `swagger.yaml` (OpenAPI 3.0 specification).

---

## Frontend Architecture

### Technology Stack
- **React 18.2** + **TypeScript 5.2** with Vite 5.1
- **No state management library** — pure `useState` with prop drilling from `App.tsx`
- **No router** — tab-based SPA with `activeTab` state
- **Glassmorphism design** — `backdrop-filter: blur(16px)` with semi-transparent cards
- **Dual font system** — `Outfit` for headings, `Inter` for body (Google Fonts)

### Component Architecture (12 Components)

| Component | Lines | Purpose |
|---|---|---|
| `App.tsx` | 378 | Root state container, orchestrates all components |
| `InteractiveSeatMap.tsx` | 428 | Coach selector + seat grid with segment visualization |
| `AdminDashboard.tsx` | 510 | KPIs, segment occupancy bars, coach/pricing management |
| `CheckoutModal.tsx` | 359 | Two-step hold→confirm with 5-min countdown timer |
| `MultiLegCheckoutModal.tsx` | 315 | Multi-leg ticket checkout flow |
| `TicketCheckerPortal.tsx` | 212 | QR camera scanner + manual PNR validation |
| `RouteTimeline.tsx` | 192 | Visual journey timeline with scenic attraction markers |
| `SearchPanel.tsx` | 178 | Station selectors, date picker, fare estimate |
| `EReceiptModal.tsx` | 178 | Printable e-ticket with QR code |
| `WaitlistModal.tsx` | 174 | SMS waitlist registration form |
| `MixedTicketCard.tsx` | 116 | Multi-hop seat recommendation cards |
| `PNRLookup.tsx` | 104 | Booking lookup by PNR number |

### Key Frontend Features

1. **Interactive Seat Map**: Physical coach simulation with aisle gap, locomotive direction indicator, and three-state seat coloring (available/partial/occupied). Tooltip hovers show exact occupied station legs.

2. **Scenic Route Recommendations**: Banner suggesting LEFT/RIGHT window side based on attractions visible along the route. Lists all visible attractions with Unsplash photos via React Portal hover cards.

3. **5-Minute Hold Timer**: Visual countdown bar that transitions from green (>60s) to red (<60s). Timer is enforced both frontend (UX) and backend (expiry worker).

4. **QR Dual-Use**: `qrcode.react` generates QR codes on e-tickets; `html5-qrcode` scans them in the checker portal — full roundtrip ticket issuance and validation.

5. **E-Ticket Receipt**: Printable ticket with PNR, QR code, passenger details, route, seat, and fare breakdown. Multi-ticket navigation for bulk bookings.

6. **Admin Analytics**: KPI cards (revenue, occupancy, active bookings) + horizontal bar chart showing per-segment occupancy with bottleneck detection.

7. **Responsive Design**: CSS breakpoint at 768px with stacked layouts, full-width controls, and resized seat buttons for mobile.

---

## Security Considerations

| Feature | Implementation | Status |
|---|---|---|
| **Bot Prevention** | Google reCAPTCHA v2 on all booking forms | ✅ Active |
| **Rate Limiting** | 4-tier Redis-backed counters per IP | ✅ Active |
| **Input Validation** | Sri Lankan NIC regex + phone format validation (server-side) | ✅ Active |
| **CORS** | Configured via `cors` middleware | ✅ Active |
| **Admin Auth** | HTTP Basic Authentication via environment variables | ✅ Active (demo-grade) |
| **Booking Date Window** | Configurable advance booking limit (default 30 days) | ✅ Active |
| **SQL Injection** | Prevented by Prisma ORM's parameterized queries | ✅ Active |
| **Password Hashing** | Not implemented (plain text for demo) | ⚠️ Demo only |
| **JWT/OAuth** | Not implemented | ⚠️ Demo only |
| **HTTPS** | Not configured (relies on reverse proxy in production) | ⚠️ Local dev only |

---

## Infrastructure & Deployment

### Docker Compose (7 Services)

All services launch with a single command. Health checks on PostgreSQL (`pg_isready`) and Redis (`redis-cli ping`) with `condition: service_healthy` ensure the backend waits for data stores before starting.

**Multi-Stage Docker Builds:**
- **Backend**: `node:20` builder (npm ci → prisma generate → tsc build) → `node:20` runner with entrypoint script
- **Frontend**: `node:20-alpine` builder (vite build) → `nginx:alpine` static file server with SPA fallback and API reverse proxy

**Named Volumes:** `pgdata`, `redisdata`, `grafana_data`, `loki_data` for data persistence across container restarts.

### Database Initialization

The PostgreSQL container mounts `prisma/init-extensions.sql` into `/docker-entrypoint-initdb.d/`, which:
1. Creates the `btree_gist` extension
2. Applies the GiST exclusion constraint for double-booking prevention

The backend's `docker-entrypoint.sh` then:
1. Runs `prisma db push` to apply the Prisma schema
2. Conditionally seeds the database (checks if Station table is empty)
3. Starts the Express server

### Background Workers

| Worker | Interval | Purpose |
|---|---|---|
| Hold Expiry | Every 15 seconds | Bulk-expire PENDING bookings past `holdExpiresAt` |
| Past Booking Cleanup | Every 1 hour + on startup | Delete bookings/waitlists for dates before today |

Both run in-process via `setInterval` — simple, single-threaded, idempotent.

---

## Quick Start

### Option 1: Docker Compose (Recommended)

```bash
docker-compose up --build
```

| Service | URL |
|---|---|
| Frontend | `http://localhost:5173` |
| Backend API | `http://localhost:5001` |
| Grafana Dashboard | `http://localhost:3001` |
| Prometheus | `http://localhost:9090` |

### Option 2: Local Development

**Prerequisites:** Node.js v20+, PostgreSQL 16+ (with `btree_gist` extension), Redis 7+

```bash
# 1. Backend
cd backend
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev

# 2. Frontend
cd frontend
npm install
npm run dev
```

### Seed Data

The system seeds automatically with:
- **18 stations**: Colombo Fort → Badulla (real Sri Lankan mainline, accurate distances)
- **8 coaches**: 2× First Class (24 seats each), 1× Second Class Reserved (24 seats), 5× Unreserved
- **72 reserved seats** across 3 reserved coaches
- **3 demo bookings** demonstrating seat segment reuse
- **1 ticket checker** account (`checker_1` / `password123`)

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@db:5432/railway_booking` | Prisma connection string |
| `REDIS_URL` | `redis://redis:6379` | Redis connection |
| `PORT` | `5001` | Backend server port |
| `BASE_FARE` | `100` | Default base fare |
| `PER_STATION_RATE` | `50` | Default per-station rate |
| `HOLD_TTL_SECONDS` | `300` | Seat hold expiration (seconds) |
| `OTEL_SERVICE_NAME` | `railway-booking-backend` | OpenTelemetry service name |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://tempo:4318/v1/traces` | Trace exporter URL |
| `LOKI_URL` | `http://loki:3100` | Log aggregation URL |
| `NODE_ENV` | `development` | Runtime environment |

---

## Testing

```bash
cd backend
npm test
```

**Test Coverage:**
- **Validation tests** (9 cases): NIC format validation (old 9+V/X, new 12-digit, passport, invalid inputs), phone format validation (local, international, invalid)
- **Controller tests** (4 cases): Missing field rejection (400), invalid NIC rejection (400), invalid phone rejection (400), successful booking flow with reCAPTCHA + service mocks
- **Metrics tests** (3 cases): Prometheus counter increments for booking lifecycle events (pending hold, multi-leg confirm, expired hold)

Test framework: **Vitest** with `vi.spyOn` mocking for Prisma and Redis.

---

## Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend** | React + TypeScript | 18.2 / 5.2 | Interactive SPA |
| **Build Tool** | Vite | 5.1 | Fast dev server + production bundler |
| **Icons** | Lucide React | 1.28 | SVG icon library |
| **QR Generation** | qrcode.react | 3.1 | E-ticket QR codes |
| **QR Scanning** | html5-qrcode | 2.3 | Camera-based ticket validation |
| **Bot Protection** | react-google-recaptcha | 3.1 | reCAPTCHA v2 |
| **Backend** | Express.js | 4.18 | REST API framework |
| **ORM** | Prisma | 5.22 | Type-safe PostgreSQL client |
| **Database** | PostgreSQL | 16 | Primary data store + GiST exclusion |
| **Cache / Lock** | Redis (ioredis) | 7 / 5.3 | CQRS cache, distributed locks, rate limiting |
| **Metrics** | Prometheus + prom-client | latest / 14 | Time-series metrics |
| **Logging** | Pino + pino-loki | latest | Structured JSON logs → Loki |
| **Tracing** | OpenTelemetry SDK | latest | Distributed tracing → Tempo |
| **Dashboards** | Grafana | latest | Unified observability visualization |
| **Container** | Docker Compose | 3.8 | Multi-service orchestration |
| **Web Server** | Nginx | alpine | Production static file serving + API proxy |
| **Testing** | Vitest | latest | Unit + integration tests |

---

## License

This project was built as a comprehensive demonstration of segment-based railway seat booking with production-grade concurrency controls, CQRS architecture, and full-stack observability.
