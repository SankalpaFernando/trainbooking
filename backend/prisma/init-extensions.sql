-- Enable btree_gist extension for combining scalar equality and range overlap in GiST indexes
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Add Exclusion Constraint on Booking table to prevent overlapping seat segments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'no_double_booking'
    ) THEN
        ALTER TABLE "Booking" ADD CONSTRAINT no_double_booking
        EXCLUDE USING gist (
            "seatId" WITH =,
            "date" WITH =,
            int4range("startStationSeq", "endStationSeq") WITH &&
        ) WHERE ("status" IN ('PENDING', 'CONFIRMED'));
    END IF;
END $$;
