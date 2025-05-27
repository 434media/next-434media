// Database schema types for events
export interface EventRecord {
  id: string
  title: string
  description?: string
  date: string // YYYY-MM-DD
  time?: string // HH:MM
  location?: string
  organizer?: string
  category: "conference" | "workshop" | "meetup" | "networking" | "other"
  attendees?: number
  price?: string
  url?: string
  image?: string
  source: "meetup" | "eventbrite" | "manual"
  created_at: string
  updated_at: string
  user_id?: string // For user-specific events
}

// SQL schema for PostgreSQL/Supabase
export const CREATE_EVENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    time TIME,
    location VARCHAR(255),
    organizer VARCHAR(255),
    category VARCHAR(50) DEFAULT 'other',
    attendees INTEGER,
    price VARCHAR(50),
    url TEXT,
    image TEXT,
    source VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id)
  );

  -- Create indexes for better performance
  CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
  CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
  CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
`
