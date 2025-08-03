-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create persona_cards table
CREATE TABLE IF NOT EXISTS persona_cards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  base_persona JSONB NOT NULL,
  archetype_name VARCHAR(255) NOT NULL,
  short_description TEXT,
  elevator_pitch TEXT,
  top_strengths TEXT[] DEFAULT '{}',
  suggested_roles TEXT[] DEFAULT '{}',
  next_steps TEXT[] DEFAULT '{}',
  motivational_insight TEXT,
  assessment_anchors TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version VARCHAR(10) DEFAULT '1.0'
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_persona_cards_session_id ON persona_cards(session_id);
CREATE INDEX IF NOT EXISTS idx_persona_cards_created_at ON persona_cards(created_at);

-- Enable Row Level Security (RLS) for security
-- ALTER TABLE persona_cards ENABLE ROW LEVEL SECURITY;

-- Create RLS policy (basic policy for development - restrict in production)
-- CREATE POLICY "Allow all operations for development" ON persona_cards FOR ALL USING (true);

-- Add comments for documentation
COMMENT ON TABLE persona_cards IS 'Stores enriched persona cards generated from career assessments';
COMMENT ON COLUMN persona_cards.session_id IS 'Links to the user session that generated this persona';
COMMENT ON COLUMN persona_cards.base_persona IS 'Original persona analysis data in JSON format';
COMMENT ON COLUMN persona_cards.assessment_anchors IS 'Key insights extracted from user responses';
