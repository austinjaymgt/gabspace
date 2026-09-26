-- Same additive membership policy as 20260926020000, for client notes: the
-- connector's create_client / add_note tools write them and get_client reads
-- them, for any business the user is staff on. Without this, notes in a
-- business other than the active one fail the existing policy. Existing
-- active-business policy is untouched; client-role members gain nothing
-- (notes are internal).
-- Rollback: supabase/rollback/20260926_membership_rls_down.sql

DROP POLICY IF EXISTS "notes_staff_member" ON public.notes;
CREATE POLICY "notes_staff_member" ON public.notes TO authenticated
  USING (public.is_business_staff(business_space_id))
  WITH CHECK (public.is_business_staff(business_space_id));
