-- Initialize SolarScout UK database tables and enumerations

-- Enumerations
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prospect_status') THEN
        CREATE TYPE prospect_status AS ENUM ('DISCOVERED', 'ENRICHING', 'ENRICHED', 'CONTACTED', 'CONVERTED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prospect_priority') THEN
        CREATE TYPE prospect_priority AS ENUM ('COLD', 'WARM', 'HOT');
    END IF;
END $$;

-- Prospects Table
CREATE TABLE IF NOT EXISTS prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    postcode VARCHAR(50),
    address TEXT,
    website VARCHAR(255),
    radius_miles NUMERIC,
    status prospect_status DEFAULT 'DISCOVERED',
    priority prospect_priority DEFAULT 'COLD',
    icp_score INT DEFAULT 0,
    roof_area_sqm NUMERIC DEFAULT 0,
    orientation VARCHAR(50) DEFAULT 'South',
    shading VARCHAR(50) DEFAULT 'None',
    turnover NUMERIC DEFAULT 0,
    employee_count INT DEFAULT 0,
    esg_keywords TEXT[] DEFAULT '{}',
    has_trigger_events BOOLEAN DEFAULT FALSE,
    gdpr_legitimate_interest_token VARCHAR(255),
    gdpr_lia_passed BOOLEAN DEFAULT FALSE,
    gdpr_assessment_date TIMESTAMP WITH TIME ZONE,
    ctps_checked BOOLEAN DEFAULT FALSE,
    ctps_clean BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(255),
    title VARCHAR(255),
    linkedin_url VARCHAR(255),
    ctps_checked BOOLEAN DEFAULT FALSE,
    ctps_clean BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Keys Table (Store securely)
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) UNIQUE NOT NULL,
    google_places TEXT,
    companies_house TEXT,
    apollo TEXT,
    hunter TEXT,
    lusha TEXT,
    zerobounce TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity Logs Table
CREATE TABLE IF NOT EXISTS prospect_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for low-latency pagination and search
CREATE INDEX IF NOT EXISTS idx_prospects_pagination ON prospects (icp_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospects_user_id ON prospects (user_id);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects (status);
CREATE INDEX IF NOT EXISTS idx_prospects_priority ON prospects (priority);
CREATE INDEX IF NOT EXISTS idx_prospects_postcode ON prospects (postcode);
CREATE INDEX IF NOT EXISTS idx_contacts_prospect_id ON contacts (prospect_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_prospect_id ON prospect_activity_logs (prospect_id);
