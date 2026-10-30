-- Create the pending member profile server-side when someone signs up, and
-- track email verification + the one-time admin alert.
-- Apply in the Supabase SQL Editor after 004-vault-tags.sql.
--
-- The signup form passes its fields as auth user metadata
-- (supabase.auth.signUp({ options: { data: {...} } })). Role and status are
-- NEVER read from metadata: signups are always role=member, status=pending.

BEGIN;

ALTER TABLE members ADD COLUMN IF NOT EXISTS admin_notified_at TIMESTAMPTZ NULL;

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
BEGIN
  IF COALESCE(meta->>'username', '') = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO members (
    username, email, password_hash, auth_id,
    first_name, last_name, middle_name, nickname, birthday,
    graduation_year, hospital, field_of_medicine, specialization, batch,
    mobile, telephone, home_phone, facebook, instagram, address, avatar_url,
    role, status, email_verified_at
  ) VALUES (
    left(meta->>'username', 50), NEW.email, 'managed_by_supabase_auth', NEW.id,
    COALESCE(NULLIF(left(meta->>'first_name', 100), ''), 'Member'),
    COALESCE(NULLIF(left(meta->>'last_name', 100), ''), '-'),
    NULLIF(left(meta->>'middle_name', 100), ''),
    NULLIF(left(meta->>'nickname', 100), ''),
    NULLIF(meta->>'birthday', '')::date,
    COALESCE(NULLIF(meta->>'graduation_year', '')::int, 2000),
    COALESCE(NULLIF(left(meta->>'hospital', 255), ''), 'Not provided'),
    COALESCE(NULLIF(left(meta->>'field_of_medicine', 100), ''), 'General Medicine'),
    NULLIF(left(meta->>'specialization', 255), ''),
    NULLIF(left(meta->>'batch', 50), ''),
    NULLIF(left(meta->>'mobile', 20), ''),
    NULLIF(left(meta->>'telephone', 20), ''),
    NULLIF(left(meta->>'home_phone', 20), ''),
    NULLIF(left(meta->>'facebook', 255), ''),
    NULLIF(left(meta->>'instagram', 255), ''),
    NULLIF(meta->>'address', ''),
    NULLIF(left(meta->>'avatar_url', 500), ''),
    'member', 'pending', NEW.email_confirmed_at
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block auth user creation; a missing profile is reported at login.
  RAISE WARNING 'handle_new_auth_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

CREATE OR REPLACE FUNCTION handle_auth_user_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE members
     SET email_verified_at = NEW.email_confirmed_at
   WHERE auth_id = NEW.id AND email_verified_at IS NULL;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_auth_user_confirmed failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION handle_auth_user_confirmed();

-- Backfill so existing members/applicants are not hidden by the verified filter.
UPDATE members m
   SET email_verified_at = COALESCE(u.email_confirmed_at, m.verified_at, m.created_at)
  FROM auth.users u
 WHERE u.id = m.auth_id AND m.email_verified_at IS NULL AND u.email_confirmed_at IS NOT NULL;

UPDATE members
   SET email_verified_at = COALESCE(verified_at, created_at)
 WHERE email_verified_at IS NULL AND status <> 'pending';

COMMIT;
