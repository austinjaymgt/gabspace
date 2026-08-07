ALTER TABLE public.tasks
  ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
