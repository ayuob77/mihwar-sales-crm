'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crm = require('../app.js');

const projectRoot = path.join(__dirname, '..');

test('اسم الجهة مطلوب وتُنظّف المدخلات مع حالة افتراضية', function () {
  assert.equal(crm.normalizeProspect({ company: '   ' }).ok, false);
  const result = crm.normalizeProspect({ company: '  شركة افتراضية  ', status: 'حالة غير معروفة' });
  assert.equal(result.ok, true);
  assert.equal(result.value.company, 'شركة افتراضية');
  assert.equal(result.value.status, crm.STATUSES[0]);
});

test('البحث والحالة وموعد المتابعة تعمل معاً', function () {
  const records = [
    { id: 'a', company: 'شركة افتراضية ألف', status: 'قيد المتابعة', followUp: '2026-11-20' },
    { id: 'b', company: 'شركة افتراضية باء', status: 'جديد', followUp: '2026-11-21' },
    { id: 'c', company: 'جهة افتراضية جيم', status: 'قيد المتابعة', followUp: '2026-11-22' }
  ];
  const result = crm.filterProspects(records, {
    query: 'ألف', status: 'قيد المتابعة', followUpDue: true, today: '2026-11-21'
  });
  assert.deepEqual(result.map(function (record) { return record.id; }), ['a']);
});

test('القالب يستبدل اسم جهة الاتصال والجهة', function () {
  const result = crm.buildDraft('مرحباً {{name}} من {{company}}', {
    company: 'شركة افتراضية', contactName: 'اسم تجريبي'
  });
  assert.equal(result, 'مرحباً اسم تجريبي من شركة افتراضية');
});

test('قراءة JSON التالف وفشل التخزين لا يكسران المنطق', function () {
  const brokenStorage = { getItem: function () { return '{'; } };
  const loaded = crm.safeLoad(brokenStorage, 'key', []);
  assert.equal(loaded.error, true);
  assert.deepEqual(loaded.value, []);
  const deniedStorage = { setItem: function () { throw new Error('quota'); } };
  assert.equal(crm.safeSave(deniedStorage, 'key', []), false);
});

test('واجهة المسودات لا تتضمن مسار إرسال أو اتصال شبكي', function () {
  const app = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert.equal(typeof crm.sendMessage, 'undefined');
  assert.doesNotMatch(app, /\bfetch\s*\(|XMLHttpRequest|sendBeacon/);
  assert.doesNotMatch(html, /<button[^>]*>\s*إرسال\s*<\/button>/);
  assert.match(html, /id="draft-output"/);
});

test('صفحة المشروع RTL وتحمّل ملفات محلية فقط', function () {
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(projectRoot, 'styles.css'), 'utf8');
  assert.match(html, /lang="ar" dir="rtl"/);
  assert.match(html, /href="styles\.css"/);
  assert.match(html, /src="app\.js"/);
  assert.match(css, /@media \(max-width: 600px\)/);
});
