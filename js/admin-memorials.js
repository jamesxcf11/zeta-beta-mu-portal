/**
 * Zeta Beta Mu Fraternity Portal
 * Admin - In Memoriam management tab (add / edit / remove deceased brothers).
 *
 * Writes go straight to Supabase; RLS (006-memorials.sql) restricts them to
 * admins and officers. Photos are uploaded to R2 through MediaUpload.
 */

const AdminMemorials = {
  items: [],

  e(s) { return AdminModule.escapeHTML(s); },

  async init() {
    const body = document.getElementById('memorials-table-body');
    if (!body) return;
    document.getElementById('add-memorial-btn')?.addEventListener('click', () => this.openModal());
    body.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-action]');
      if (!btn) return;
      const item = this.items.find(m => m.id === Number(btn.dataset.id));
      if (!item) return;
      if (btn.dataset.action === 'edit') this.openModal(item);
      else if (btn.dataset.action === 'remove') this.remove(item);
    });
    await this.load();
  },

  async load() {
    if (!AdminModule.hasSupabase()) { this.items = []; this.render(); return; }
    const { data, error } = await db
      .from('memorials')
      .select('id, full_name, nickname, batch, specialty, birth_year, death_year, tribute, photo_url, photo_key, sort_order, is_public')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('death_year', { ascending: false, nullsFirst: false });
    if (error) AdminModule.showToast('Could not load memorials: ' + error.message, 'error');
    this.items = data || [];
    this.render();
  },

  render() {
    const body = document.getElementById('memorials-table-body');
    if (!body) return;
    if (!this.items.length) {
      body.innerHTML = '<tr><td colspan="6" class="admin-card-desc text-center py-4">No memorials yet. Use "Add Brother" to create one.</td></tr>';
      return;
    }
    body.innerHTML = this.items.map(m => `
      <tr>
        <td>
          <div class="flex items-center gap-3">
            <img src="${this.e(m.photo_url || 'image/logo1.png')}" alt="" class="w-10 h-10 rounded-full object-cover">
            <span>${this.e(m.full_name)}${m.nickname ? ` (&ldquo;${this.e(m.nickname)}&rdquo;)` : ''}</span>
          </div>
        </td>
        <td>${this.e([m.birth_year, m.death_year].filter(Boolean).join(' \u2014 ')) || '\u2014'}</td>
        <td>${this.e(m.batch) || '\u2014'}</td>
        <td>${this.e(m.specialty) || '\u2014'}</td>
        <td>${m.is_public === false ? 'Members only' : 'Public'}</td>
        <td>
          <button class="btn btn-glass btn-sm" type="button" data-action="edit" data-id="${m.id}">Edit</button>
          <button class="btn btn-glass btn-sm" type="button" data-action="remove" data-id="${m.id}">Remove</button>
        </td>
      </tr>`).join('');
  },

  openModal(item) {
    const v = (x) => this.e(x == null ? '' : x);
    const m = item || {};
    const html = `
      <div><label class="form-label">Full Name *</label><input id="mem-name" class="glass-input w-full" maxlength="255" value="${v(m.full_name)}" required></div>
      <div class="form-grid-2">
        <div><label class="form-label">Nickname</label><input id="mem-nick" class="glass-input w-full" maxlength="100" value="${v(m.nickname)}"></div>
        <div><label class="form-label">Batch</label><input id="mem-batch" class="glass-input w-full" maxlength="50" value="${v(m.batch)}"></div>
      </div>
      <div><label class="form-label">Specialty</label><input id="mem-specialty" class="glass-input w-full" maxlength="255" value="${v(m.specialty)}"></div>
      <div class="form-grid-2">
        <div><label class="form-label">Birth Year</label><input id="mem-birth" type="number" min="1800" max="2200" class="glass-input w-full" value="${v(m.birth_year)}"></div>
        <div><label class="form-label">Year of Passing</label><input id="mem-death" type="number" min="1800" max="2200" class="glass-input w-full" value="${v(m.death_year)}"></div>
      </div>
      <div><label class="form-label">Tribute</label><textarea id="mem-tribute" class="glass-input w-full" rows="4">${v(m.tribute)}</textarea></div>
      <label class="flex items-center gap-2" style="margin:0.5rem 0"><input id="mem-public" type="checkbox" ${m.is_public === false ? '' : 'checked'}> Show on the public Sacrifice page</label>
      <div><label class="form-label">Photo (JPG, PNG or WebP)</label><input id="mem-photo" type="file" accept="image/jpeg,image/png,image/webp" class="glass-input w-full"></div>
    `;
    AdminModule.buildModal(item ? `Edit ${this.e(m.full_name)}` : 'Add Brother', html, item ? 'Save Changes' : 'Add to Memorial', () => this.submit(item));
  },

  async submit(item) {
    const get = (id) => (document.getElementById(id)?.value || '').trim();
    const num = (id) => { const n = parseInt(get(id), 10); return Number.isFinite(n) ? n : null; };
    const fullName = get('mem-name');
    if (!fullName) { AdminModule.showToast('Full name is required', 'error'); return; }

    const record = {
      full_name: fullName,
      nickname: get('mem-nick') || null,
      batch: get('mem-batch') || null,
      specialty: get('mem-specialty') || null,
      birth_year: num('mem-birth'),
      death_year: num('mem-death'),
      tribute: get('mem-tribute') || null,
      is_public: !!document.getElementById('mem-public')?.checked
    };
    const file = document.getElementById('mem-photo')?.files?.[0];
    let oldKey = null;

    if (file) {
      if (!window.MediaUpload || !MediaUpload.isConfigured()) {
        AdminModule.showToast('Photo upload is not available in this environment', 'error');
        return;
      }
      try {
        const { full } = await MediaUpload.upload(file, 'memorial', { withThumbnail: false });
        record.photo_url = full.publicUrl;
        record.photo_key = full.fileKey;
        oldKey = item && item.photo_key;
      } catch (err) {
        AdminModule.showToast(err.message || 'Photo upload failed', 'error');
        return;
      }
    }

    const query = item
      ? db.from('memorials').update(record).eq('id', item.id)
      : db.from('memorials').insert(record);
    const { error } = await query;
    if (error) { AdminModule.showToast('Could not save: ' + error.message, 'error'); return; }

    if (oldKey) MediaUpload.deleteKeys([oldKey]).catch(() => {});
    AdminModule.closeModal();
    AdminModule.showToast(item ? 'Memorial updated.' : 'Brother added to the memorial.', 'success');
    await this.load();
  },

  async remove(item) {
    if (!confirm(`Remove ${item.full_name} from the memorial? Their comments will be hidden.`)) return;
    const { error } = await db.from('memorials').update({ deleted_at: new Date().toISOString() }).eq('id', item.id);
    if (error) { AdminModule.showToast('Could not remove: ' + error.message, 'error'); return; }
    AdminModule.showToast('Removed from the memorial.', 'success');
    await this.load();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.admin-page')) AdminMemorials.init();
});
window.AdminMemorials = AdminMemorials;
