const { json, requiredEnv, authenticate } = require('./_lib/auth');

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

const DEFAULT_PREFERENCES = {
  notifications: {
    reactions: true,
    comments: true,
    announcements: true,
  },
  privacy: {
    showOnCalendar: false,
    showAge: false,
  },
};

const NOTIFICATION_KEYS = Object.keys(DEFAULT_PREFERENCES.notifications);
const PRIVACY_KEYS = Object.keys(DEFAULT_PREFERENCES.privacy);

function mergePreferences(stored) {
  const prefs = stored && typeof stored === 'object' ? stored : {};
  const notifications = { ...DEFAULT_PREFERENCES.notifications };
  const privacy = { ...DEFAULT_PREFERENCES.privacy };
  if (prefs.notifications && typeof prefs.notifications === 'object') {
    for (const key of NOTIFICATION_KEYS) {
      if (typeof prefs.notifications[key] === 'boolean') notifications[key] = prefs.notifications[key];
    }
  }
  if (prefs.privacy && typeof prefs.privacy === 'object') {
    for (const key of PRIVACY_KEYS) {
      if (typeof prefs.privacy[key] === 'boolean') privacy[key] = prefs.privacy[key];
    }
  }
  return { notifications, privacy };
}

function validate(body) {
  if (!body || typeof body !== 'object') return { error: 'Body must be a JSON object' };

  const next = { notifications: {}, privacy: {} };
  let touched = false;

  if (Object.prototype.hasOwnProperty.call(body, 'notifications')) {
    const section = body.notifications;
    if (!section || typeof section !== 'object') return { error: 'notifications must be an object' };
    for (const key of Object.keys(section)) {
      if (!NOTIFICATION_KEYS.includes(key)) return { error: `Unknown notification setting "${key}"` };
      if (typeof section[key] !== 'boolean') return { error: `notifications.${key} must be true or false` };
      next.notifications[key] = section[key];
      touched = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'privacy')) {
    const section = body.privacy;
    if (!section || typeof section !== 'object') return { error: 'privacy must be an object' };
    for (const key of Object.keys(section)) {
      if (!PRIVACY_KEYS.includes(key)) return { error: `Unknown privacy setting "${key}"` };
      if (typeof section[key] !== 'boolean') return { error: `privacy.${key} must be true or false` };
      next.privacy[key] = section[key];
      touched = true;
    }
  }

  for (const key of Object.keys(body)) {
    if (key !== 'notifications' && key !== 'privacy') return { error: `Unknown settings section "${key}"` };
  }
  if (!touched) return { error: 'No editable settings were provided' };
  return { updates: next };
}

function isMissingColumn(error) {
  // PostgREST 42703 — column does not exist (migration 002 not applied)
  return error && (error.code === '42703' || /column .* does not exist/i.test(error.message || ''));
}

async function loadSettings(supabase, memberId) {
  const { data: row, error } = await supabase
    .from('members')
    .select('id, birthday, graduation_year, preferences')
    .eq('id', memberId)
    .single();
  if (error) return { error };
  const { data: calendar } = await supabase
    .from('birthday_calendar')
    .select('show_on_calendar, show_age')
    .eq('member_id', memberId)
    .maybeSingle();

  const preferences = mergePreferences(row.preferences);
  // The calendar row is authoritative for what actually displays on the feed.
  if (calendar) {
    preferences.privacy.showOnCalendar = calendar.show_on_calendar;
    preferences.privacy.showAge = calendar.show_age;
  } else {
    preferences.privacy.showOnCalendar = false;
  }
  return { row, preferences, hasBirthdayRow: !!calendar };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'PATCH') return json(405, { error: 'Method not allowed' });

  const missingEnv = requiredEnv(REQUIRED_ENV);
  if (missingEnv.length > 0) return json(500, { error: 'Settings service is not configured' });

  const auth = await authenticate(event);
  if (auth.error) return auth.error;
  const { member, supabase } = auth;

  const loaded = await loadSettings(supabase, member.id);
  if (loaded.error) {
    if (isMissingColumn(loaded.error)) {
      return json(500, { error: 'Settings storage is not configured', hint: 'Apply sql/migrations/002-member-preferences.sql' });
    }
    return json(500, { error: 'Could not load settings' });
  }

  if (event.httpMethod === 'GET') {
    return json(200, {
      settings: {
        notifications: loaded.preferences.notifications,
        privacy: {
          ...loaded.preferences.privacy,
          hasBirthday: !!loaded.row.birthday,
        },
      },
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Body must be valid JSON' });
  }

  const validated = validate(body);
  if (validated.error) return json(400, { error: validated.error });

  const next = loaded.preferences;
  Object.assign(next.notifications, validated.updates.notifications);
  Object.assign(next.privacy, validated.updates.privacy);

  const privacyRequested = Object.keys(validated.updates.privacy).length > 0;
  if (privacyRequested && next.privacy.showOnCalendar && !loaded.row.birthday) {
    return json(400, { error: 'Set your birthday on your profile before showing it on the calendar' });
  }

  const { error: updateError } = await supabase
    .from('members')
    .update({ preferences: next })
    .eq('id', member.id);
  if (updateError) {
    if (isMissingColumn(updateError)) {
      return json(500, { error: 'Settings storage is not configured', hint: 'Apply sql/migrations/002-member-preferences.sql' });
    }
    return json(500, { error: 'Could not save settings' });
  }

  if (privacyRequested) {
    if (loaded.row.birthday) {
      const birthYear = Number(String(loaded.row.birthday).slice(0, 4)) || null;
      const { error: upsertError } = await supabase
        .from('birthday_calendar')
        .upsert({
          member_id: member.id,
          birth_date: loaded.row.birthday,
          birth_year: birthYear,
          show_on_calendar: next.privacy.showOnCalendar,
          show_age: next.privacy.showAge,
        }, { onConflict: 'member_id' });
      if (upsertError) return json(500, { error: 'Could not update calendar visibility' });
    } else if (loaded.hasBirthdayRow) {
      // No birthday on file anymore — remove any stale calendar row.
      const { error: deleteError } = await supabase
        .from('birthday_calendar')
        .delete()
        .eq('member_id', member.id);
      if (deleteError) return json(500, { error: 'Could not update calendar visibility' });
    }
  }

  return json(200, {
    settings: {
      notifications: next.notifications,
      privacy: {
        ...next.privacy,
        hasBirthday: !!loaded.row.birthday,
      },
    },
  });
};
