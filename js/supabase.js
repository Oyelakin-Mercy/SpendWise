import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://rnglffmqnchmibqixcoq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZ2xmZm1xbmNobWlicWl4Y29xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MjgyODIsImV4cCI6MjA4OTUwNDI4Mn0.Vz54WCzyCXw7kLupHc4Hho_BQdwB4AWXXWFXvj3qulY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)