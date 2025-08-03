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
                                                                                                                               
-- Create simulator_results table (for Day-in-Life simulator)                                                                  
CREATE TABLE IF NOT EXISTS simulator_results (                                                                                 
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,                                                                              
  session_id VARCHAR(255) NOT NULL,                                                                                            
  persona_card_id UUID REFERENCES persona_cards(id),                                                                           
  simulator_type VARCHAR(100) NOT NULL,                                                                                        
  completion_time INTEGER, -- in seconds                                                                                       
  score INTEGER,                                                                                                               
  decisions JSONB DEFAULT '{}',                                                                                                
  kpis JSONB DEFAULT '{}',                                                                                                     
  reflection TEXT,                                                                                                             
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()                                                                            
);                                                                                                                             
                                                                                                                               
-- Create resume_artifacts table                                                                                               
CREATE TABLE IF NOT EXISTS resume_artifacts (                                                                                  
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,                                                                              
  session_id VARCHAR(255) NOT NULL,                                                                                            
  persona_card_id UUID REFERENCES persona_cards(id),                                                                           
  template_type VARCHAR(100) NOT NULL,                                                                                         
  content JSONB NOT NULL,                                                                                                      
  format VARCHAR(50) DEFAULT 'json',                                                                                           
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),                                                                           
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()                                                                            
);                                                                                                                             
                                                                                                                               
-- Create event_logs table (for impact dashboard)                                                                              
CREATE TABLE IF NOT EXISTS event_logs (                                                                                        
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,                                                                              
  session_id VARCHAR(255),                                                                                                     
  user_id UUID,                                                                                                                
  event_type VARCHAR(100) NOT NULL,                                                                                            
  event_data JSONB DEFAULT '{}',                                                                                               
  metadata JSONB DEFAULT '{}',                                                                                                 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()                                                                            
);                                                                                                                             
                                                                                                                               
-- Create knowledge_base table (for RAG)                                                                                       
CREATE TABLE IF NOT EXISTS knowledge_base (                                                                                    
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,                                                                              
  title VARCHAR(500) NOT NULL,                                                                                                 
  content TEXT NOT NULL,                                                                                                       
  source VARCHAR(255),                                                                                                         
  category VARCHAR(100),                                                                                                       
  tags TEXT[] DEFAULT '{}',                                                                                                    
  embedding VECTOR(1536), -- For OpenAI embeddings, adjust size as needed                                                      
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),                                                                           
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()                                                                            
);                                                                                                                             
                                                                                                                               
-- Create indexes for better performance                                                                                       
CREATE INDEX IF NOT EXISTS idx_persona_cards_session_id ON persona_cards(session_id);                                          
CREATE INDEX IF NOT EXISTS idx_simulator_results_session_id ON simulator_results(session_id);                                  
CREATE INDEX IF NOT EXISTS idx_resume_artifacts_session_id ON resume_artifacts(session_id);                                    
CREATE INDEX IF NOT EXISTS idx_event_logs_session_id ON event_logs(session_id);                                                
CREATE INDEX IF NOT EXISTS idx_event_logs_type ON event_logs(event_type);                                                      
CREATE INDEX IF NOT EXISTS idx_event_logs_created_at ON event_logs(created_at);                                                
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);                                            
                                                                                                                               
-- Enable Row Level Security (RLS) for security                                                                                
ALTER TABLE persona_cards ENABLE ROW LEVEL SECURITY;                                                                           
ALTER TABLE simulator_results ENABLE ROW LEVEL SECURITY;                                                                       
ALTER TABLE resume_artifacts ENABLE ROW LEVEL SECURITY;                                                                        
ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;                                                                              
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;                                                                          
                                                                                                                               
-- Create RLS policies (basic policies for development)                                                                        
CREATE POLICY "Allow all operations for now" ON persona_cards FOR ALL USING (true);                                            
CREATE POLICY "Allow all operations for now" ON simulator_results FOR ALL USING (true);                                        
CREATE POLICY "Allow all operations for now" ON resume_artifacts FOR ALL USING (true);                                         
CREATE POLICY "Allow all operations for now" ON event_logs FOR ALL USING (true);                                               
CREATE POLICY "Allow all operations for now" ON knowledge_base FOR ALL USING (true);          