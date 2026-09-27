-- Business logos now live at logos/<business_space_id>/logo.<ext>. The old
-- policies let any signed-in user write any path in the bucket (so anyone
-- could overwrite another business's logo). Limit writes to owners/co-owners
-- of the business named by the first folder. Public read is unchanged, so
-- existing root-level logo URLs keep working.

DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;

DROP POLICY IF EXISTS "logos_business_admin_insert" ON storage.objects;
CREATE POLICY "logos_business_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND EXISTS (
      SELECT 1 FROM public.business_space_members m
      WHERE m.business_space_id::text = (storage.foldername(name))[1]
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'co-owner')
    )
  );

DROP POLICY IF EXISTS "logos_business_admin_update" ON storage.objects;
CREATE POLICY "logos_business_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'logos'
    AND EXISTS (
      SELECT 1 FROM public.business_space_members m
      WHERE m.business_space_id::text = (storage.foldername(name))[1]
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'co-owner')
    )
  )
  WITH CHECK (
    bucket_id = 'logos'
    AND EXISTS (
      SELECT 1 FROM public.business_space_members m
      WHERE m.business_space_id::text = (storage.foldername(name))[1]
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'co-owner')
    )
  );
