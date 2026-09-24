-- Community layer seed data — DEV / LOCAL DATABASES ONLY.
--
-- Creates 11 fake auth users (all @seed.gabspace.test, password
-- "Password123!"), 10 businesses, directory listings, 8 collab requests
-- (one expired, one closed), responses, and tag subscriptions. Re-runnable:
-- the cleanup block at the top removes everything a previous run created.
--
-- Run AFTER 20260924000000_community_layer.sql and
-- 20260924010000_collab_messages.sql, as the postgres role (SQL
-- editor or `psql`). Businesses are created by the real handle_new_user()
-- signup trigger, so this also exercises the normal signup path.
--
-- Accounts (log in with any of these):
--   MEMBERS (can post/respond)
--     luma@seed.gabspace.test       Luma Photo Co        active subscription
--     petal@seed.gabspace.test      Petal & Stem Floral  active subscription
--     northbound@seed.gabspace.test Northbound Films     active subscription
--     inkwell@seed.gabspace.test    Inkwell Copy         active subscription
--     grid@seed.gabspace.test       Grid Studio          trialing subscription
--     velvet@seed.gabspace.test     Velvet Hour Events   grandfathered (no sub row)
--   FREE (browse only)
--     saltwater@seed.gabspace.test  Saltwater Styling    canceled subscription
--     bright@seed.gabspace.test     Bright Room Venue    past_due subscription
--     maple@seed.gabspace.test      Maple Social         canceled subscription
--     echo@seed.gabspace.test       Echo DJ Collective   canceled subscription
--     assistant@seed.gabspace.test  (employee at Luma Photo Co — not an owner)

BEGIN;

-- Lets the seed write plan/requires_checkout past enforce_plan_immutable,
-- same transaction-local flag handle_new_user() uses.
SELECT set_config('gabspace.system_write', 'true', true);

-- ── Cleanup from any previous run ─────────────────────────────────────────
CREATE TEMP TABLE seed_users ON COMMIT DROP AS
  SELECT id FROM auth.users WHERE email LIKE '%@seed.gabspace.test';

DELETE FROM public.user_profiles WHERE user_id IN (SELECT id FROM seed_users);
DELETE FROM public.business_space_members WHERE user_id IN (SELECT id FROM seed_users);
DELETE FROM public.business_spaces WHERE owner_id IN (SELECT id FROM seed_users);
DELETE FROM public.user_settings WHERE user_id IN (SELECT id FROM seed_users);
DELETE FROM public.subscriptions WHERE owner_id IN (SELECT id FROM seed_users);
DELETE FROM public.invites WHERE email LIKE '%@seed.gabspace.test';
DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM seed_users);
DELETE FROM auth.users WHERE id IN (SELECT id FROM seed_users);

-- ── Users (handle_new_user creates each one's business space) ─────────────
CREATE TEMP TABLE seed_people (
  n int PRIMARY KEY,
  user_id uuid,
  email text,
  full_name text,
  business text,
  billing text  -- 'active' | 'trialing' | 'grandfathered' | 'canceled' | 'past_due' | 'employee'
) ON COMMIT DROP;

INSERT INTO seed_people VALUES
  (1,  '5eed0000-0000-4000-a000-000000000001', 'luma@seed.gabspace.test',       'Maya Lin',      'Luma Photo Co',       'active'),
  (2,  '5eed0000-0000-4000-a000-000000000002', 'petal@seed.gabspace.test',      'Rosa Diaz',     'Petal & Stem Floral', 'active'),
  (3,  '5eed0000-0000-4000-a000-000000000003', 'northbound@seed.gabspace.test', 'Theo Park',     'Northbound Films',    'active'),
  (4,  '5eed0000-0000-4000-a000-000000000004', 'inkwell@seed.gabspace.test',    'Jordan Blake',  'Inkwell Copy',        'active'),
  (5,  '5eed0000-0000-4000-a000-000000000005', 'grid@seed.gabspace.test',       'Sam Okafor',    'Grid Studio',         'trialing'),
  (6,  '5eed0000-0000-4000-a000-000000000006', 'velvet@seed.gabspace.test',     'Priya Shah',    'Velvet Hour Events',  'grandfathered'),
  (7,  '5eed0000-0000-4000-a000-000000000007', 'saltwater@seed.gabspace.test',  'Casey Moore',   'Saltwater Styling',   'canceled'),
  (8,  '5eed0000-0000-4000-a000-000000000008', 'bright@seed.gabspace.test',     'Alex Rivera',   'Bright Room Venue',   'past_due'),
  (9,  '5eed0000-0000-4000-a000-000000000009', 'maple@seed.gabspace.test',      'Robin Hayes',   'Maple Social',        'canceled'),
  (10, '5eed0000-0000-4000-a000-000000000010', 'echo@seed.gabspace.test',       'Drew Castillo', 'Echo DJ Collective',  'canceled');

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
SELECT
  p.user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p.email,
  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', p.full_name, 'workspace_name', p.business),
  now(), now(), '', '', '', ''
FROM seed_people p ORDER BY p.n;

-- Employee at Luma: a pending invite makes handle_new_user join them to
-- Luma's space instead of creating their own.
INSERT INTO public.invites (business_space_id, email, role, invited_by)
SELECT bs.id, 'assistant@seed.gabspace.test', 'employee', bs.owner_id
FROM public.business_spaces bs WHERE bs.owner_id = '5eed0000-0000-4000-a000-000000000001';

INSERT INTO seed_people VALUES
  (11, '5eed0000-0000-4000-a000-000000000011', 'assistant@seed.gabspace.test', 'Lee Tran', NULL, 'employee');

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES (
  '5eed0000-0000-4000-a000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'assistant@seed.gabspace.test', extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Lee Tran"}'::jsonb,
  now(), now(), '', '', '', ''
);

-- Email/password sign-in needs an identity row per user.
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), p.user_id::text, p.user_id,
  jsonb_build_object('sub', p.user_id::text, 'email', p.email, 'email_verified', true),
  'email', now(), now(), now()
FROM seed_people p;

-- Everyone gets past the mandatory-checkout gate so they can reach the app;
-- billing standing below is what decides membership.
UPDATE public.user_settings SET requires_checkout = false, onboarding_completed = true
WHERE user_id IN (SELECT user_id FROM seed_people);

-- ── Subscriptions ─────────────────────────────────────────────────────────
INSERT INTO public.subscriptions (
  owner_id, stripe_customer_id, stripe_subscription_id, tier, billing_period,
  status, profile_limit, is_founder, current_period_end, cancel_at_period_end, updated_at
)
SELECT p.user_id, 'cus_seed_' || p.n, 'sub_seed_' || p.n, 'business', 'monthly',
  p.billing, 1, false,
  CASE WHEN p.billing IN ('active', 'trialing', 'past_due') THEN now() + interval '20 days' ELSE now() - interval '5 days' END,
  false, now()
FROM seed_people p
WHERE p.billing IN ('active', 'trialing', 'canceled', 'past_due');

-- Business ids were generated by the signup trigger — map them by owner.
CREATE TEMP TABLE seed_biz ON COMMIT DROP AS
  SELECT p.n, bs.id AS business_space_id, p.user_id
  FROM seed_people p JOIN public.business_spaces bs ON bs.owner_id = p.user_id
  WHERE p.n <= 10;

-- ── Directory listings (8 discoverable, 2 hidden) ─────────────────────────
INSERT INTO public.business_listings (business_space_id, is_discoverable, display_name, pitch, tags, city, remote_ok)
SELECT b.business_space_id, l.discoverable, l.name, l.pitch, l.tags, l.city, l.remote_ok
FROM seed_biz b JOIN (VALUES
  (1,  true,  'Luma Photo Co',       'Editorial wedding and brand photography with a warm, film-inspired look.',       ARRAY['photography','branding'],               'Austin, TX',    false),
  (2,  true,  'Petal & Stem Floral', 'Seasonal, garden-style florals for weddings, launches, and styled shoots.',        ARRAY['floral','styling','event-planning'],    'Austin, TX',    false),
  (3,  true,  'Northbound Films',    'Documentary-style wedding films and short brand stories.',                        ARRAY['videography','social-media'],           'Denver, CO',    true),
  (4,  true,  'Inkwell Copy',        'Website copy, launch emails, and brand voice guides for creative businesses.',   ARRAY['copywriting','marketing','branding'],   NULL,            true),
  (5,  true,  'Grid Studio',         'Identity systems and Squarespace sites for small studios.',                      ARRAY['graphic-design','branding','web-design'],'Nashville, TN', true),
  (6,  true,  'Velvet Hour Events',  'Full-service planning for intimate weddings and brand dinners.',                   ARRAY['event-planning','consulting'],          'Austin, TX',    false),
  (7,  true,  'Saltwater Styling',   'Wardrobe and prop styling for shoots along the coast.',                          ARRAY['styling','hair-makeup'],                'San Diego, CA', false),
  (8,  true,  'Bright Room Venue',   'Light-filled loft for workshops, pop-ups, and small receptions.',                ARRAY['venue','workshops'],                    'Denver, CO',    false),
  (9,  false, 'Maple Social',        'Social media management for local makers.',                                       ARRAY['social-media','marketing'],             'Portland, OR',  true),
  (10, false, 'Echo DJ Collective',  'DJs and live sound for weddings and parties.',                                    ARRAY['music-dj'],                             'Austin, TX',    false)
) AS l(n, discoverable, name, pitch, tags, city, remote_ok) ON l.n = b.n;

UPDATE public.business_listings bl SET website = w.url
FROM seed_biz b JOIN (VALUES
  (1, 'https://lumaphoto.example.com'),
  (2, 'https://petalandstem.example.com'),
  (3, 'https://northboundfilms.example.com'),
  (4, 'https://inkwellcopy.example.com'),
  (5, 'https://gridstudio.example.com'),
  (8, 'https://brightroom.example.com')
) AS w(n, url) ON w.n = b.n
WHERE bl.business_space_id = b.business_space_id;

UPDATE public.business_listings bl SET instagram = i.handle
FROM seed_biz b JOIN (VALUES
  (1, 'lumaphotoco'),
  (2, 'petalandstem.floral'),
  (3, 'northbound.films'),
  (6, 'velvethourevents'),
  (7, 'saltwater_styling')
) AS i(n, handle) ON i.n = b.n
WHERE bl.business_space_id = b.business_space_id;

-- ── Tag subscriptions (before requests, so posting fires notifications) ───
INSERT INTO public.tag_subscriptions (user_id, tag) VALUES
  ('5eed0000-0000-4000-a000-000000000001', 'styled-shoot'),
  ('5eed0000-0000-4000-a000-000000000001', 'photography'),
  ('5eed0000-0000-4000-a000-000000000003', 'videography'),
  ('5eed0000-0000-4000-a000-000000000004', 'copywriting'),
  ('5eed0000-0000-4000-a000-000000000005', 'branding'),
  ('5eed0000-0000-4000-a000-000000000007', 'styling');       -- free user: still gets alerts

-- ── Collab requests (6 open, 1 expired, 1 closed) ─────────────────────────
CREATE TEMP TABLE seed_requests (
  key text PRIMARY KEY, n int, title text, description text, category text, tags text[],
  location text, remote_ok boolean, needed_by date, status text, created_at timestamptz, expires_at timestamptz
) ON COMMIT DROP;

INSERT INTO seed_requests VALUES
  ('shoot',   2, 'Photographer + stylist for a fall styled shoot', 'Moody autumn tablescape at a ranch outside Austin. Trade/portfolio collab, florals and rentals covered.', 'styled-shoot', ARRAY['photography','styling'], 'Austin, TX', false, current_date + 21, 'open', now() - interval '2 days', now() + interval '28 days'),
  ('second',  1, 'Second shooter for October wedding', 'Need an experienced second shooter for a 10-hour wedding day. Paid, day rate.', 'subcontract', ARRAY['photography'], 'Austin, TX', false, current_date + 30, 'open', now() - interval '1 day', now() + interval '20 days'),
  ('launch',  5, 'Copywriter for a studio rebrand launch', 'Looking for a copywriter to partner on website + launch email copy for a client rebrand.', 'subcontract', ARRAY['copywriting','branding'], NULL, true, current_date + 45, 'open', now() - interval '3 days', now() + interval '40 days'),
  ('recap',   6, 'Recap film for a brand dinner', 'Two-minute recap video of a 40-person brand dinner. Happy to cross-promote.', 'event-partnership', ARRAY['videography','social-media'], 'Austin, TX', false, current_date + 14, 'open', now() - interval '5 hours', now() + interval '14 days'),
  ('space',   3, 'Studio space share in Denver', 'Our edit suite sits empty 3 days a week — looking to share with another creative business.', 'space-share', ARRAY['venue'], 'Denver, CO', false, NULL, 'open', now() - interval '6 days', now() + interval '50 days'),
  ('swap',    4, 'Content swap: blog feature for portfolio photos', 'I will write a feature on your business in exchange for a few headshots.', 'content-swap', ARRAY['photography','copywriting'], NULL, true, NULL, 'open', now() - interval '4 days', now() + interval '25 days'),
  ('expired', 1, 'Summer workshop co-host (EXPIRED)', 'Should NOT appear on the board — expired 10 days ago.', 'workshop-cohost', ARRAY['workshops'], 'Austin, TX', false, current_date - 15, 'open', now() - interval '40 days', now() - interval '10 days'),
  ('closed',  2, 'Referral partner for corporate florals (CLOSED)', 'Already found someone — closed.', 'referral', ARRAY['floral'], 'Austin, TX', false, NULL, 'closed', now() - interval '12 days', now() + interval '18 days');

CREATE TEMP TABLE seed_request_ids ON COMMIT DROP AS SELECT key, NULL::uuid AS id FROM seed_requests;

WITH ins AS (
  INSERT INTO public.collab_requests (business_space_id, created_by, title, description, category, tags, location, remote_ok, needed_by, status, created_at, expires_at)
  SELECT b.business_space_id, b.user_id, r.title, r.description, r.category, r.tags, r.location, r.remote_ok, r.needed_by, r.status, r.created_at, r.expires_at
  FROM seed_requests r JOIN seed_biz b ON b.n = r.n
  RETURNING id, title
)
UPDATE seed_request_ids s SET id = ins.id
FROM ins JOIN seed_requests r ON r.title = ins.title
WHERE s.key = r.key;

-- ── Responses ─────────────────────────────────────────────────────────────
INSERT INTO public.collab_responses (request_id, responder_business_space_id, created_by, note, status)
SELECT s.id, b.business_space_id, b.user_id, x.note, x.status
FROM (VALUES
  ('shoot',  1, 'Would love this — I have a ranch-friendly film setup and can bring a second body.', 'pending'),
  ('shoot',  3, 'Could we add a short BTS film? Happy to shoot it.',                                  'pending'),
  ('launch', 4, 'Rebrand launches are my favorite. Portfolio link in my listing.',                    'accepted'),
  ('recap',  3, 'We did a similar dinner last month — can share the cut.',                            'pending'),
  ('second', 5, 'Not a photographer, but I know two great ones — happy to refer.',                    'declined')
) AS x(key, n, note, status)
JOIN seed_request_ids s ON s.key = x.key
JOIN seed_biz b ON b.n = x.n;

-- ── Messages on the accepted response (Grid Studio ⇄ Inkwell Copy) ────────
-- Requires 20260924010000_collab_messages.sql.
INSERT INTO public.collab_messages (response_id, sender_business_space_id, sender_user_id, body, created_at)
SELECT r.id, b.business_space_id, b.user_id, x.body, now() - x.ago
FROM (VALUES
  (5, 'Thanks for jumping on this! Kickoff call Thursday at 10?', interval '2 days'),
  (4, 'Thursday works. I will send a short questionnaire before then.', interval '47 hours'),
  (5, 'Perfect — sharing the brand deck now.', interval '46 hours')
) AS x(n, body, ago)
JOIN seed_biz b ON b.n = x.n
JOIN public.collab_responses r ON r.request_id = (SELECT id FROM seed_request_ids WHERE key = 'launch')
  AND r.responder_business_space_id = (SELECT business_space_id FROM seed_biz WHERE n = 4);

COMMIT;

-- Quick sanity check
SELECT
  (SELECT count(*) FROM public.business_listings bl JOIN public.business_spaces bs ON bs.id = bl.business_space_id
     WHERE bs.owner_id::text LIKE '5eed0000-%') AS listings,
  (SELECT count(*) FROM public.collab_requests WHERE created_by::text LIKE '5eed0000-%') AS requests,
  (SELECT count(*) FROM public.collab_responses WHERE created_by::text LIKE '5eed0000-%') AS responses,
  (SELECT count(*) FROM public.collab_messages WHERE sender_user_id::text LIKE '5eed0000-%') AS messages,
  (SELECT count(*) FROM public.notifications WHERE user_id::text LIKE '5eed0000-%') AS notifications;
