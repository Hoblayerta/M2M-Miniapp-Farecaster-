-- M2M Chat Database Schema
-- This schema stores indexed blockchain events from the M2MChat contract
-- to provide fast, queryable data for the frontend

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Indexer state tracking
CREATE TABLE indexer_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_block BIGINT NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert initial state
INSERT INTO indexer_state (id, last_block) VALUES (1, 0);

-- User pricing settings
CREATE TABLE user_pricing (
  address TEXT PRIMARY KEY,
  price_per_message NUMERIC(78, 0) NOT NULL DEFAULT 0, -- Wei units (18 decimals for cUSD)
  is_open_to_messages BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX idx_user_pricing_address ON user_pricing(address);

-- Message packages purchased
CREATE TABLE message_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  messages_purchased INTEGER NOT NULL,
  messages_consumed INTEGER DEFAULT 0,
  total_cost NUMERIC(78, 0) NOT NULL, -- Wei units
  tx_hash TEXT UNIQUE NOT NULL,
  block_number BIGINT NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_message_packages_sender_recipient ON message_packages(sender, recipient);
CREATE INDEX idx_message_packages_tx_hash ON message_packages(tx_hash);
CREATE INDEX idx_message_packages_block_number ON message_packages(block_number);

-- Mutual contacts (free messaging between these pairs)
CREATE TABLE mutual_contacts (
  user_a TEXT NOT NULL,
  user_b TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_a, user_b),
  -- Ensure consistent ordering: user_a < user_b alphabetically
  CHECK (user_a < user_b)
);

-- Index for efficient mutual contact lookups
CREATE INDEX idx_mutual_contacts_users ON mutual_contacts(user_a, user_b);

-- Message consumption checkpoints
CREATE TABLE message_checkpoints (
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  nonce BIGINT NOT NULL,
  consumed_count INTEGER NOT NULL,
  signature TEXT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  tx_hash TEXT,
  block_number BIGINT,
  PRIMARY KEY (sender, recipient, nonce)
);

-- Index for checkpoint lookups
CREATE INDEX idx_message_checkpoints_sender_recipient ON message_checkpoints(sender, recipient);

-- Price updates tracking (for historical data)
CREATE TABLE price_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_address TEXT NOT NULL,
  old_price NUMERIC(78, 0),
  new_price NUMERIC(78, 0) NOT NULL,
  tx_hash TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_updates_user ON price_updates(user_address);
CREATE INDEX idx_price_updates_block ON price_updates(block_number);

-- Function to update user_pricing.updated_at on changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_pricing updates
CREATE TRIGGER update_user_pricing_updated_at
  BEFORE UPDATE ON user_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- View for easy querying of messaging access
CREATE VIEW messaging_access AS
SELECT
  mp.sender,
  mp.recipient,
  SUM(mp.messages_purchased - mp.messages_consumed) AS remaining_messages,
  MAX(mp.purchased_at) AS last_purchase,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM mutual_contacts mc
      WHERE (mc.user_a = mp.sender AND mc.user_b = mp.recipient)
         OR (mc.user_a = mp.recipient AND mc.user_b = mp.sender)
    ) THEN true
    ELSE false
  END AS is_mutual_contact
FROM message_packages mp
GROUP BY mp.sender, mp.recipient;

-- Comments for documentation
COMMENT ON TABLE indexer_state IS 'Tracks the last indexed block number for the Celo blockchain indexer';
COMMENT ON TABLE user_pricing IS 'User-defined pricing for incoming messages (from M2MChat contract)';
COMMENT ON TABLE message_packages IS 'Message credits purchased by users (indexed from MessagePackagePurchased events)';
COMMENT ON TABLE mutual_contacts IS 'Pairs of users who can message each other for free (indexed from MutualContactAdded events)';
COMMENT ON TABLE message_checkpoints IS 'Relayer-signed checkpoints for message consumption tracking';
COMMENT ON TABLE price_updates IS 'Historical record of price changes';

COMMENT ON VIEW messaging_access IS 'Consolidated view of messaging permissions and remaining credits';
