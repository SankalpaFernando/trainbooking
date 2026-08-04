-- Enable btree_gist extension for combining scalar equality
-- and range overlap in GiST indexes
CREATE EXTENSION IF NOT EXISTS btree_gist;