import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dfgbjthfoffsrxwrcnlu.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmZ2JqdGhmb2Zmc3J4d3Jjbmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMTA0ODAsImV4cCI6MjA5MTY4NjQ4MH0.rTwlOKx4zARbnLEhKPdxltFTk_25TVRiEY8fTsXny_o'

export const supabase = createClient(supabaseUrl, supabaseKey)

if (typeof window !== 'undefined') window.supabase = supabase