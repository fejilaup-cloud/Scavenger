-- Migration: 001_initial_schema
-- Scavngr indexer schema

CREATE TABLE IF NOT EXISTS sync_status (
  id SERIAL PRIMARY KEY,
  last_ledger BIGINT NOT NULL DEFAULT 0,
  last_ledger_close_time TIMESTAMPTZ,
  is_syncing BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sync_status (last_ledger) VALUES (0) ON CONFLICT DO NOTHING;

-- Raw events log (used for reorg detection and replay)
CREATE TABLE IF NOT EXISTS raw_events (
  id BIGSERIAL PRIMARY KEY,
  ledger_sequence BIGINT NOT NULL,
  ledger_close_time TIMESTAMPTZ NOT NULL,
  transaction_hash TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  topic TEXT[] NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_events_ledger ON raw_events(ledger_sequence);
CREATE INDEX IF NOT EXISTS idx_raw_events_type ON raw_events(event_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_events_tx_type ON raw_events(transaction_hash, event_type, (topic[1]));

-- Participants
CREATE TABLE IF NOT EXISTS participants (
  address TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('Recycler','Collector','Manufacturer')),
  name TEXT NOT NULL,
  latitude BIGINT NOT NULL,
  longitude BIGINT NOT NULL,
  registered_at_ledger BIGINT NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', name || ' ' || role || ' ' || address)
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_participants_role ON participants(role);
CREATE INDEX IF NOT EXISTS idx_participants_search ON participants USING GIN(search_vector);

-- Wastes
CREATE TABLE IF NOT EXISTS wastes (
  id BIGINT PRIMARY KEY,
  recycler_address TEXT NOT NULL REFERENCES participants(address),
  waste_type TEXT NOT NULL CHECK (waste_type IN ('Paper','PetPlastic','Plastic','Metal','Glass','Organic','Electronic')),
  weight NUMERIC NOT NULL,
  latitude BIGINT NOT NULL,
  longitude BIGINT NOT NULL,
  is_confirmed BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  grade TEXT,
  processing_status INT,
  contamination_level INT,
  registered_at_ledger BIGINT NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', waste_type || ' ' || COALESCE(grade, ''))
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_wastes_recycler ON wastes(recycler_address);
CREATE INDEX IF NOT EXISTS idx_wastes_type ON wastes(waste_type);
CREATE INDEX IF NOT EXISTS idx_wastes_active ON wastes(is_active);
CREATE INDEX IF NOT EXISTS idx_wastes_search ON wastes USING GIN(search_vector);

-- Waste transfers
CREATE TABLE IF NOT EXISTS waste_transfers (
  id BIGSERIAL PRIMARY KEY,
  waste_id BIGINT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  ledger_sequence BIGINT NOT NULL,
  transferred_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transfers_waste ON waste_transfers(waste_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from ON waste_transfers(from_address);
CREATE INDEX IF NOT EXISTS idx_transfers_to ON waste_transfers(to_address);

-- Token rewards
CREATE TABLE IF NOT EXISTS token_rewards (
  id BIGSERIAL PRIMARY KEY,
  recipient_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  waste_id BIGINT NOT NULL,
  ledger_sequence BIGINT NOT NULL,
  rewarded_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rewards_recipient ON token_rewards(recipient_address);
CREATE INDEX IF NOT EXISTS idx_rewards_waste ON token_rewards(waste_id);

-- Incentives (auction/incentive events)
CREATE TABLE IF NOT EXISTS auctions (
  id BIGINT PRIMARY KEY,
  waste_id BIGINT NOT NULL,
  creator_address TEXT NOT NULL,
  start_price NUMERIC NOT NULL,
  end_time BIGINT NOT NULL,
  winner_address TEXT,
  final_price NUMERIC,
  is_ended BOOLEAN NOT NULL DEFAULT false,
  created_at_ledger BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

-- Carbon credits
CREATE TABLE IF NOT EXISTS carbon_credits (
  id BIGSERIAL PRIMARY KEY,
  participant_address TEXT NOT NULL,
  waste_type TEXT NOT NULL,
  weight NUMERIC NOT NULL,
  credits NUMERIC NOT NULL,
  ledger_sequence BIGINT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_carbon_participant ON carbon_credits(participant_address);
