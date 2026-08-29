-- Public storage bucket for blog cover images, uploaded from the admin
-- panel's Blog card. Same admin-gated write / public read shape as
-- blog_posts itself (see 20260829000000_blog_posts.sql).

INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "blog_images_public_read" ON storage.objects;
CREATE POLICY "blog_images_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'blog-images');

DROP POLICY IF EXISTS "blog_images_admin_insert" ON storage.objects;
CREATE POLICY "blog_images_admin_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'blog-images' AND public.is_platform_admin());

DROP POLICY IF EXISTS "blog_images_admin_update" ON storage.objects;
CREATE POLICY "blog_images_admin_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'blog-images' AND public.is_platform_admin());

DROP POLICY IF EXISTS "blog_images_admin_delete" ON storage.objects;
CREATE POLICY "blog_images_admin_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'blog-images' AND public.is_platform_admin());
