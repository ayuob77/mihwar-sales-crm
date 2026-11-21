(function (root) {
  'use strict';

  const STORAGE_KEY = 'mihwar-sales-crm.prospects.v1';
  const TEMPLATE_KEY = 'mihwar-sales-crm.templates.v1';
  const STATUSES = ['جديد', 'تمت المراجعة', 'قيد المتابعة', 'تم التواصل', 'مؤهل', 'مؤجل', 'مغلق'];
  const DEFAULT_TEMPLATES = [
    {
      id: 'intro',
      name: 'تعريف أولي',
      body: 'السلام عليكم {{name}}،\n\nأنا أتواصل معكم للتعريف بخدماتنا ومعرفة ما إذا كان هناك مجال للتعاون مع {{company}}.\n\nإذا كان الموضوع مناسباً، يسعدني معرفة الشخص أو الوقت الأنسب للمتابعة.\n\nمع التحية'
    },
    {
      id: 'follow-up',
      name: 'متابعة مهذبة',
      body: 'السلام عليكم {{name}}،\n\nأتابع رسالتي السابقة بخصوص إمكانية التعاون مع {{company}}. إذا كان لديكم وقت مناسب، يسعدني مواصلة الحديث.\n\nمع التحية'
    }
  ];

  function text(value) {
    return value === undefined || value === null ? '' : String(value).trim();
  }

  function makeId() {
    return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  function normalizeProspect(input) {
    const record = input || {};
    const company = text(record.company);
    if (!company) return { ok: false, error: 'اسم الشركة مطلوب' };
    const status = STATUSES.includes(text(record.status)) ? text(record.status) : STATUSES[0];
    return {
      ok: true,
      value: {
        id: text(record.id) || makeId(),
        company,
        contactName: text(record.contactName),
        reference: text(record.reference),
        source: text(record.source),
        dateChecked: text(record.dateChecked),
        status,
        notes: text(record.notes),
        followUp: text(record.followUp)
      }
    };
  }

  function filterProspects(records, filters) {
    const options = filters || {};
    const query = text(options.query).toLocaleLowerCase();
    const status = text(options.status) || 'all';
    const dueOnly = Boolean(options.followUpDue);
    const today = text(options.today);
    return (Array.isArray(records) ? records : []).filter(function (item) {
      const record = item || {};
      const haystack = [record.company, record.contactName, record.reference, record.source, record.status, record.notes]
        .map(text).join(' ').toLocaleLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (status !== 'all' && text(record.status) !== status) return false;
      if (dueOnly && (!text(record.followUp) || (today && text(record.followUp) > today))) return false;
      return true;
    }).sort(function (a, b) {
      const left = text(a.followUp) || '9999-12-31';
      const right = text(b.followUp) || '9999-12-31';
      return left.localeCompare(right);
    });
  }

  function buildDraft(templateBody, prospect) {
    const item = prospect || {};
    const values = {
      company: text(item.company),
      name: text(item.contactName) || text(item.company),
      contactName: text(item.contactName),
      website: text(item.reference),
      source: text(item.source),
      status: text(item.status)
    };
    return String(templateBody || '').replace(/\{\{(company|name|contactName|website|source|status)\}\}/g, function (match, key) {
      return values[key] || '';
    });
  }

  function safeLoad(storage, key, fallback) {
    try {
      const raw = storage && storage.getItem(key);
      if (!raw) return { value: JSON.parse(JSON.stringify(fallback)), error: false };
      return { value: JSON.parse(raw), error: false };
    } catch (error) {
      return { value: JSON.parse(JSON.stringify(fallback)), error: true };
    }
  }

  function safeSave(storage, key, value) {
    try {
      if (!storage) return false;
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  const api = {
    STORAGE_KEY: STORAGE_KEY,
    TEMPLATE_KEY: TEMPLATE_KEY,
    STATUSES: STATUSES.slice(),
    DEFAULT_TEMPLATES: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)),
    normalizeProspect: normalizeProspect,
    filterProspects: filterProspects,
    buildDraft: buildDraft,
    safeLoad: safeLoad,
    safeSave: safeSave
  };

  root.ProspectCRM = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (!root.document) return;

  function init(document, windowObject) {
    const byId = function (id) { return document.getElementById(id); };
    const notice = byId('notice');
    const prospectForm = byId('prospect-form');
    const dialog = byId('prospect-dialog');
    let storage = null;
    try { storage = windowObject.localStorage; } catch (error) { storage = null; }

    const loadedProspects = safeLoad(storage, STORAGE_KEY, []);
    const loadedTemplates = safeLoad(storage, TEMPLATE_KEY, DEFAULT_TEMPLATES);
    const state = {
      prospects: Array.isArray(loadedProspects.value) ? loadedProspects.value : [],
      templates: Array.isArray(loadedTemplates.value) && loadedTemplates.value.length ? loadedTemplates.value : JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)),
      editingId: '',
      storageFailed: loadedProspects.error || loadedTemplates.error
    };

    function showNotice(message) {
      notice.textContent = message || '';
    }

    function persistProspects() {
      const ok = safeSave(storage, STORAGE_KEY, state.prospects);
      state.storageFailed = state.storageFailed || !ok;
      showNotice(ok ? 'حُفظت التغييرات في تخزين هذا المتصفح فقط' : 'تعذر الحفظ محلياً، ستبقى التغييرات في هذه الجلسة فقط');
      return ok;
    }

    function persistTemplates() {
      const ok = safeSave(storage, TEMPLATE_KEY, state.templates);
      state.storageFailed = state.storageFailed || !ok;
      showNotice(ok ? 'حُفظ القالب في تخزين هذا المتصفح فقط' : 'تعذر حفظ القالب، سيبقى التعديل في هذه الجلسة فقط');
      return ok;
    }

    function todayString() {
      const now = new Date();
      return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    }

    function addCell(row, value) {
      const cell = document.createElement('td');
      cell.textContent = value || '—';
      row.appendChild(cell);
      return cell;
    }

    function makeButton(label, action, id, className) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.dataset.action = action;
      button.dataset.id = id;
      button.className = className || 'button button-small';
      return button;
    }

    function render() {
      const filtered = filterProspects(state.prospects, {
        query: byId('search').value,
        status: byId('status-filter').value,
        followUpDue: byId('due-filter').checked,
        today: todayString()
      });
      const body = byId('prospect-rows');
      body.replaceChildren();
      byId('record-count').textContent = String(state.prospects.length);
      byId('visible-count').textContent = String(filtered.length);

      if (!filtered.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 8;
        cell.className = 'empty-cell';
        cell.textContent = state.prospects.length ? 'لا توجد نتائج مطابقة' : 'لا توجد سجلات بعد، أضيفي أول جهة للمتابعة';
        row.appendChild(cell);
        body.appendChild(row);
      }

      filtered.forEach(function (record) {
        const row = document.createElement('tr');
        const companyCell = document.createElement('td');
        companyCell.className = 'company-cell';
        const company = document.createElement('strong');
        company.textContent = record.company || '';
        companyCell.appendChild(company);
        if (record.contactName) {
          const contact = document.createElement('span');
          contact.className = 'muted subline';
          contact.textContent = record.contactName;
          companyCell.appendChild(contact);
        }
        row.appendChild(companyCell);
        addCell(row, record.reference);
        addCell(row, record.source);
        const statusCell = addCell(row, record.status);
        statusCell.className = 'status-cell';
        addCell(row, record.dateChecked);
        addCell(row, record.followUp);
        const notesCell = addCell(row, record.notes);
        notesCell.className = 'notes-cell';
        const actions = document.createElement('td');
        actions.className = 'actions-cell';
        actions.appendChild(makeButton('تعديل', 'edit', record.id, 'button button-small'));
        actions.appendChild(makeButton('حذف', 'delete', record.id, 'button button-small button-danger'));
        row.appendChild(actions);
        body.appendChild(row);
      });

      renderTemplateOptions();
      renderProspectOptions();
      if (state.storageFailed) {
        byId('storage-state').textContent = 'التخزين المحلي غير متاح أو تعذر قراءة بعض البيانات، لا تغلقي الصفحة قبل نسخ ما تحتاجينه';
        byId('storage-state').classList.add('warning');
      }
    }

    function renderTemplateOptions() {
      const select = byId('template-select');
      const current = select.value;
      select.replaceChildren();
      state.templates.forEach(function (template) {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.name;
        select.appendChild(option);
      });
      if (state.templates.some(function (item) { return item.id === current; })) select.value = current;
      loadTemplateEditor();
    }

    function renderProspectOptions() {
      const select = byId('draft-prospect');
      const current = select.value;
      select.replaceChildren();
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'اختاري سجلاً';
      select.appendChild(placeholder);
      state.prospects.forEach(function (record) {
        const option = document.createElement('option');
        option.value = record.id;
        option.textContent = record.company;
        select.appendChild(option);
      });
      if (state.prospects.some(function (item) { return item.id === current; })) select.value = current;
    }

    function loadTemplateEditor() {
      const template = state.templates.find(function (item) { return item.id === byId('template-select').value; });
      byId('template-name').value = template ? template.name : '';
      byId('template-body').value = template ? template.body : '';
    }

    function openDialog(record) {
      state.editingId = record ? record.id : '';
      prospectForm.reset();
      byId('field-company').value = record ? record.company : '';
      byId('field-contact').value = record ? record.contactName || '' : '';
      byId('field-reference').value = record ? record.reference || '' : '';
      byId('field-source').value = record ? record.source || '' : '';
      byId('field-checked').value = record ? record.dateChecked || '' : todayString();
      byId('field-status').value = record ? record.status || STATUSES[0] : STATUSES[0];
      byId('field-notes').value = record ? record.notes || '' : '';
      byId('field-follow-up').value = record ? record.followUp || '' : '';
      byId('dialog-title').textContent = record ? 'تعديل سجل' : 'إضافة سجل';
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      byId('field-company').focus();
    }

    function closeDialog() {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      state.editingId = '';
    }

    byId('add-prospect').addEventListener('click', function () { openDialog(null); });
    byId('cancel-dialog').addEventListener('click', closeDialog);
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) closeDialog();
    });

    prospectForm.addEventListener('submit', function (event) {
      event.preventDefault();
      const result = normalizeProspect({
        id: state.editingId,
        company: byId('field-company').value,
        contactName: byId('field-contact').value,
        reference: byId('field-reference').value,
        source: byId('field-source').value,
        dateChecked: byId('field-checked').value,
        status: byId('field-status').value,
        notes: byId('field-notes').value,
        followUp: byId('field-follow-up').value
      });
      if (!result.ok) {
        showNotice(result.error);
        byId('field-company').focus();
        return;
      }
      if (state.editingId) {
        state.prospects = state.prospects.map(function (item) { return item.id === state.editingId ? result.value : item; });
      } else {
        state.prospects.push(result.value);
      }
      closeDialog();
      persistProspects();
      render();
    });

    byId('prospect-rows').addEventListener('click', function (event) {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const record = state.prospects.find(function (item) { return item.id === button.dataset.id; });
      if (!record) return;
      if (button.dataset.action === 'edit') openDialog(record);
      if (button.dataset.action === 'delete' && windowObject.confirm('هل تريدين حذف هذا السجل؟')) {
        state.prospects = state.prospects.filter(function (item) { return item.id !== record.id; });
        persistProspects();
        render();
      }
    });

    ['search', 'status-filter', 'due-filter'].forEach(function (id) {
      byId(id).addEventListener(id === 'search' ? 'input' : 'change', render);
    });

    byId('template-select').addEventListener('change', loadTemplateEditor);
    byId('save-template').addEventListener('click', function () {
      const name = text(byId('template-name').value);
      const body = String(byId('template-body').value || '').trim();
      if (!name || !body) {
        showNotice('أدخلي اسماً ونصاً للقالب قبل الحفظ');
        return;
      }
      const selectedId = byId('template-select').value;
      const existing = state.templates.find(function (item) { return item.id === selectedId; });
      if (existing) {
        state.templates = state.templates.map(function (item) { return item.id === selectedId ? { id: item.id, name: name, body: body } : item; });
      } else {
        state.templates.push({ id: makeId(), name: name, body: body });
      }
      persistTemplates();
      renderTemplateOptions();
      const saved = state.templates.find(function (item) { return item.name === name; });
      if (saved) byId('template-select').value = saved.id;
      loadTemplateEditor();
    });

    byId('make-draft').addEventListener('click', function () {
      const record = state.prospects.find(function (item) { return item.id === byId('draft-prospect').value; });
      const template = state.templates.find(function (item) { return item.id === byId('template-select').value; });
      if (!record || !template) {
        showNotice('اختاري سجلاً وقالباً لإنشاء المسودة');
        return;
      }
      byId('draft-output').value = buildDraft(template.body, record);
      showNotice('هذه مسودة للمراجعة والتعديل والنسخ فقط، لا يوجد إرسال من التطبيق');
    });

    byId('copy-draft').addEventListener('click', async function () {
      const value = byId('draft-output').value;
      if (!value.trim()) {
        showNotice('أنشئي مسودة أو اكتبي نصاً قبل النسخ');
        return;
      }
      try {
        if (!windowObject.navigator.clipboard || !windowObject.navigator.clipboard.writeText) throw new Error('clipboard unavailable');
        await windowObject.navigator.clipboard.writeText(value);
        showNotice('نُسخت المسودة إلى الحافظة، راجعيها قبل استخدامها');
      } catch (error) {
        showNotice('تعذر النسخ تلقائياً، حددي النص وانسخيه يدوياً');
      }
    });

    if (loadedProspects.error || loadedTemplates.error) showNotice('تعذر قراءة التخزين المحلي، تأكدي من إعدادات المتصفح قبل إدخال بيانات مهمة');
    render();
  }

  init(root.document, root);
})(typeof window !== 'undefined' ? window : globalThis);
