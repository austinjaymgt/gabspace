-- Enable realtime replication for client-portal activity so staff-facing
-- notification badges can update live instead of only on refetch.
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliverable_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliverable_reactions;
