-- Setup cron job for blockchain indexing
-- Note: This migration creates the cron job once pg_cron extension is enabled

-- First, ensure pg_cron extension exists (requires superuser - done via Dashboard)
-- Go to: https://supabase.com/dashboard/project/pnpplnvtcnhmsdpejxwd/database/extensions
-- Enable: pg_cron

-- Then run this to schedule the indexer
SELECT cron.schedule(
  'index-celo-events',
  '30 seconds',
  $cron$
  SELECT net.http_post(
    url := 'https://pnpplnvtcnhmsdpejxwd.supabase.co/functions/v1/index-celo-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucHBsbnZ0Y25obXNkcGVqeHdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgyOTkxNywiZXhwIjoyMDgxNDA1OTE3fQ.OC1rkT8VUJRIeuFzbALkJB057CJhocJz2tKawxNQe1U'
    )
  );
  $cron$
);
