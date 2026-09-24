-- Collab messages: a private thread between the two businesses on an
-- accepted collab response. Builds on 20260924000000_community_layer.sql.
--
-- One thread per collab_responses row (response_id). Only owners/co-owners
-- of the poster's and the responder's business can read or write it, and
-- new messages can only be sent once the response is accepted. Either side
-- can keep messaging even if their membership lapses later — the collab was
-- already agreed. Messages are immutable (no edit/delete) for now.
--
-- Unread state reuses the notifications table: each message notifies the
-- other side (type 'collab_message', target_id = response_id), and opening
-- a thread marks those notifications read.

CREATE TABLE IF NOT EXISTS public.collab_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.collab_responses(id) ON DELETE CASCADE,
  sender_business_space_id uuid NOT NULL REFERENCES public.business_spaces(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_display_name text,
  body text NOT NULL CHECK (char_length(TRIM(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS collab_messages_thread_idx
  ON public.collab_messages (response_id, created_at);

-- True when bs_id is one of the two businesses on this response and the
-- caller manages it — i.e. they may send as that side of the thread.
CREATE OR REPLACE FUNCTION public.collab_thread_side(resp_id uuid, bs_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM collab_responses r
    JOIN collab_requests q ON q.id = r.request_id
    WHERE r.id = resp_id
      AND bs_id IN (r.responder_business_space_id, q.business_space_id)
      AND public.can_manage_business(auth.uid(), bs_id)
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_collab_thread_party(resp_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM collab_responses r
    JOIN collab_requests q ON q.id = r.request_id
    WHERE r.id = resp_id
      AND (public.can_manage_business(auth.uid(), r.responder_business_space_id)
        OR public.can_manage_business(auth.uid(), q.business_space_id))
  );
$function$;

CREATE OR REPLACE FUNCTION public.collab_thread_open(resp_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM collab_responses WHERE id = resp_id AND status = 'accepted');
$function$;

-- Server-owned columns: who sent it and when.
CREATE OR REPLACE FUNCTION public.collab_messages_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.sender_display_name := public.community_display_name(NEW.sender_business_space_id);
  IF auth.uid() IS NOT NULL THEN
    NEW.sender_user_id := auth.uid();
    NEW.created_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS collab_messages_before_insert ON public.collab_messages;
CREATE TRIGGER collab_messages_before_insert
  BEFORE INSERT ON public.collab_messages
  FOR EACH ROW EXECUTE FUNCTION public.collab_messages_before_insert();

ALTER TABLE public.collab_messages ENABLE ROW LEVEL SECURITY;

-- Parties can read the full history (even if the response is later changed).
DROP POLICY IF EXISTS "collab_messages_select_parties" ON public.collab_messages;
CREATE POLICY "collab_messages_select_parties" ON public.collab_messages
  FOR SELECT TO authenticated
  USING (public.is_collab_thread_party(response_id));

-- Parties can send, as the side they actually manage, on accepted responses.
DROP POLICY IF EXISTS "collab_messages_insert_parties" ON public.collab_messages;
CREATE POLICY "collab_messages_insert_parties" ON public.collab_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.collab_thread_side(response_id, sender_business_space_id)
    AND public.collab_thread_open(response_id)
  );

-- New message → owners/co-owners of the other business (never the sender).
CREATE OR REPLACE FUNCTION public.notify_collab_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  resp record;
  other_bs uuid;
BEGIN
  SELECT r.responder_business_space_id, q.business_space_id AS poster_bs, q.title
  INTO resp
  FROM collab_responses r JOIN collab_requests q ON q.id = r.request_id
  WHERE r.id = NEW.response_id;

  other_bs := CASE WHEN NEW.sender_business_space_id = resp.poster_bs
    THEN resp.responder_business_space_id ELSE resp.poster_bs END;

  INSERT INTO notifications (user_id, type, title, body, target_page, target_id)
  SELECT m.user_id,
    'collab_message',
    COALESCE(NEW.sender_display_name, 'A business') || ' sent you a message',
    left(NEW.body, 120),
    'community-messages',
    NEW.response_id
  FROM business_space_members m
  WHERE m.business_space_id = other_bs
    AND m.role IN ('owner', 'co-owner')
    AND m.user_id IS DISTINCT FROM NEW.sender_user_id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS notify_collab_message ON public.collab_messages;
CREATE TRIGGER notify_collab_message
  AFTER INSERT ON public.collab_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_collab_message();

-- Accepted responses now land the responder in the message thread (was the
-- request page). Declines still point at the request. Replaces the version
-- from 20260924000000_community_layer.sql.
CREATE OR REPLACE FUNCTION public.notify_collab_response_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  req record;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status = 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT id, title, poster_display_name INTO req FROM collab_requests WHERE id = NEW.request_id;

  INSERT INTO notifications (user_id, type, title, body, target_page, target_id)
  SELECT m.user_id,
    'collab_response_' || NEW.status,
    COALESCE(req.poster_display_name, 'The poster') || ' ' || NEW.status || ' your response',
    CASE WHEN NEW.status = 'accepted'
      THEN 'Say hello — your message thread for "' || req.title || '" is open'
      ELSE 'For "' || req.title || '"' END,
    CASE WHEN NEW.status = 'accepted' THEN 'community-messages' ELSE 'community-request' END,
    CASE WHEN NEW.status = 'accepted' THEN NEW.id ELSE req.id END
  FROM business_space_members m
  WHERE m.business_space_id = NEW.responder_business_space_id
    AND m.role IN ('owner', 'co-owner');
  RETURN NEW;
END;
$function$;


-- ── Grants ────────────────────────────────────────────────────────────────

REVOKE ALL ON public.collab_messages FROM anon, authenticated;
GRANT SELECT, INSERT ON public.collab_messages TO authenticated;

REVOKE EXECUTE ON FUNCTION public.collab_messages_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_collab_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_collab_response_status() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.collab_thread_side(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_collab_thread_party(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.collab_thread_open(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.collab_thread_side(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_collab_thread_party(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.collab_thread_open(uuid) TO authenticated;
