-- Self-hosted tutorial video library. Content is authored in the admin
-- panel (Tutorials tab) from videos exported out of Guidde, then uploaded
-- to the tutorial-videos bucket so playback never depends on a third-party
-- embed. Global/platform-wide, not scoped to a business space — same
-- admin-gated write / authenticated read shape as blog_posts, except
-- readers must be signed in rather than public (see 20260829000000_blog_posts.sql).

CREATE TABLE IF NOT EXISTS public.tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  video_url text NOT NULL,
  thumbnail_url text,
  duration_seconds integer,
  category text,
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  sort_order integer NOT NULL DEFAULT 0,
  author_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tutorials_published_idx ON public.tutorials (category, sort_order) WHERE status = 'published';

CREATE OR REPLACE FUNCTION public.set_tutorial_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tutorials_set_updated_at ON public.tutorials;
CREATE TRIGGER tutorials_set_updated_at
  BEFORE UPDATE ON public.tutorials
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tutorial_updated_at();

ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;

-- Published tutorials are visible to any signed-in user (logged-in app
-- only — no anon access, unlike blog_posts which the public site reads).
DROP POLICY IF EXISTS "tutorials_select_published" ON public.tutorials;
CREATE POLICY "tutorials_select_published" ON public.tutorials
  FOR SELECT TO authenticated USING (status = 'published');

DROP POLICY IF EXISTS "tutorials_admin_all" ON public.tutorials;
CREATE POLICY "tutorials_admin_all" ON public.tutorials
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- Storage: self-hosted video + thumbnail files, admin-uploaded.
INSERT INTO storage.buckets (id, name, public)
VALUES ('tutorial-videos', 'tutorial-videos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('tutorial-thumbnails', 'tutorial-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "tutorial_videos_public_read" ON storage.objects;
CREATE POLICY "tutorial_videos_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'tutorial-videos');

DROP POLICY IF EXISTS "tutorial_videos_admin_insert" ON storage.objects;
CREATE POLICY "tutorial_videos_admin_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tutorial-videos' AND public.is_platform_admin());

DROP POLICY IF EXISTS "tutorial_videos_admin_update" ON storage.objects;
CREATE POLICY "tutorial_videos_admin_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'tutorial-videos' AND public.is_platform_admin());

DROP POLICY IF EXISTS "tutorial_videos_admin_delete" ON storage.objects;
CREATE POLICY "tutorial_videos_admin_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'tutorial-videos' AND public.is_platform_admin());

DROP POLICY IF EXISTS "tutorial_thumbnails_public_read" ON storage.objects;
CREATE POLICY "tutorial_thumbnails_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'tutorial-thumbnails');

DROP POLICY IF EXISTS "tutorial_thumbnails_admin_insert" ON storage.objects;
CREATE POLICY "tutorial_thumbnails_admin_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tutorial-thumbnails' AND public.is_platform_admin());

DROP POLICY IF EXISTS "tutorial_thumbnails_admin_update" ON storage.objects;
CREATE POLICY "tutorial_thumbnails_admin_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'tutorial-thumbnails' AND public.is_platform_admin());

DROP POLICY IF EXISTS "tutorial_thumbnails_admin_delete" ON storage.objects;
CREATE POLICY "tutorial_thumbnails_admin_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'tutorial-thumbnails' AND public.is_platform_admin());
