const { json, requiredEnv, authenticate } = require('./_lib/auth');
const r2 = require('./_lib/r2');

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const PROFILE_COLUMNS = 'id, username, email, first_name, middle_name, last_name, nickname, birthday, graduation_year, hospital, field_of_medicine, medical_license, specialization, batch, bio, avatar_url, phone, mobile, telephone, home_phone, facebook, instagram, address, role, status';
const FIELD_MAP = {
  firstName: 'first_name',
  middleName: 'middle_name',
  lastName: 'last_name',
  nickname: 'nickname',
  birthday: 'birthday',
  graduationYear: 'graduation_year',
  hospital: 'hospital',
  field: 'field_of_medicine',
  medicalLicense: 'medical_license',
  specialization: 'specialization',
  batch: 'batch',
  bio: 'bio',
  phone: 'phone',
  mobile: 'mobile',
  telephone: 'telephone',
  homePhone: 'home_phone',
  facebook: 'facebook',
  instagram: 'instagram',
  address: 'address',
  avatarUrl: 'avatar_url',
};
const LIMITS = {
  firstName: 100,
  middleName: 100,
  lastName: 100,
  nickname: 100,
  hospital: 255,
  field: 100,
  medicalLicense: 50,
  specialization: 255,
  batch: 50,
  bio: 2000,
  phone: 20,
  mobile: 20,
  telephone: 20,
  homePhone: 20,
  facebook: 255,
  instagram: 255,
  address: 1000,
};

function normalize(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    firstName: row.first_name || '',
    middleName: row.middle_name || '',
    lastName: row.last_name || '',
    name: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' '),
    nickname: row.nickname || '',
    birthday: row.birthday || '',
    graduationYear: row.graduation_year || '',
    hospital: row.hospital || '',
    field: row.field_of_medicine || '',
    medicalLicense: row.medical_license || '',
    specialization: row.specialization || '',
    batch: row.batch || '',
    bio: row.bio || '',
    avatarUrl: row.avatar_url || '',
    phone: row.phone || '',
    mobile: row.mobile || '',
    telephone: row.telephone || '',
    homePhone: row.home_phone || '',
    facebook: row.facebook || '',
    instagram: row.instagram || '',
    address: row.address || '',
    role: row.role,
    status: row.status,
  };
}

function validate(body, memberId) {
  const updates = {};

  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    if (key === 'graduationYear') {
      const year = Number(body[key]);
      if (!Number.isInteger(year) || year < 1900 || year > 2100) return { error: 'Graduation year must be between 1900 and 2100' };
      updates[column] = year;
      continue;
    }
    if (key === 'birthday') {
      const value = String(body[key] || '').trim();
      if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`) > new Date())) {
        return { error: 'Birthday must be a valid date that is not in the future' };
      }
      updates[column] = value || null;
      continue;
    }
    if (key === 'avatarUrl') {
      const value = String(body[key] || '').trim();
      const avatarKey = String(body.avatarKey || '').trim();
      if (value) {
        const expectedPrefix = `profiles/${memberId}/`;
        if (!avatarKey.startsWith(expectedPrefix) || !r2.isManagedKey(avatarKey) || value !== r2.publicUrl(avatarKey)) {
          return { error: 'Profile photo is not owned by this account' };
        }
      }
      updates[column] = value || null;
      continue;
    }

    const value = String(body[key] || '').trim();
    if (LIMITS[key] && value.length > LIMITS[key]) return { error: `${key} is too long` };
    if ((key === 'facebook' || key === 'instagram') && value) {
      try {
        const url = new URL(value);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return { error: `${key} must be a valid web address` };
      } catch (e) {
        return { error: `${key} must be a valid web address` };
      }
    }
    updates[column] = value || null;
  }

  if ('firstName' in body && !updates.first_name) return { error: 'First name is required' };
  if ('lastName' in body && !updates.last_name) return { error: 'Last name is required' };
  if ('hospital' in body && !updates.hospital) return { error: 'Hospital or institution is required' };
  if ('field' in body && !updates.field_of_medicine) return { error: 'Field of medicine is required' };
  if (Object.keys(updates).length === 0) return { error: 'No editable profile fields were provided' };

  return { updates };
}

function profileKey(url, memberId) {
  if (!url) return null;
  try {
    const path = new URL(url).pathname.replace(/^\/+/, '');
    return path.startsWith(`profiles/${memberId}/`) && r2.isManagedKey(path) ? path : null;
  } catch (e) {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'PATCH') return json(405, { error: 'Method not allowed' });

  const missingEnv = requiredEnv(REQUIRED_ENV);
  if (missingEnv.length > 0) return json(500, { error: 'Profile service is not configured' });

  const auth = await authenticate(event);
  if (auth.error) return auth.error;
  const { member, supabase } = auth;

  const { data: current, error: loadError } = await supabase
    .from('members')
    .select(PROFILE_COLUMNS)
    .eq('id', member.id)
    .single();

  if (loadError || !current) return json(404, { error: 'Member profile not found' });
  if (event.httpMethod === 'GET') return json(200, { profile: normalize(current) });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Body must be valid JSON' });
  }

  const validated = validate(body, member.id);
  if (validated.error) return json(400, { error: validated.error });

  const { data: updated, error: updateError } = await supabase
    .from('members')
    .update(validated.updates)
    .eq('id', member.id)
    .select(PROFILE_COLUMNS)
    .single();

  if (updateError || !updated) return json(500, { error: 'Could not update profile' });

  if (validated.updates.avatar_url && validated.updates.avatar_url !== current.avatar_url) {
    const oldKey = profileKey(current.avatar_url, member.id);
    if (oldKey && requiredEnv(['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']).length === 0) {
      try {
        await r2.deleteKeys([oldKey]);
      } catch (e) {
        console.error('profile: old photo cleanup failed');
      }
    }
  }

  return json(200, { profile: normalize(updated) });
};
