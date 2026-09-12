/**
 * SmartLead — tagLeadBrand
 * ------------------------------------------------------------------
 * Function ĐỘC LẬP, gắn `brand` cho lead MỚI theo thời gian thực.
 * KHÔNG đụng tới onLeadCreated (thông báo) và KHÔNG đụng pipeline quét.
 *
 * Khi lead mới được tạo trong collection `leads`:
 *   1. Đọc field `source` (tên group/nguồn).
 *   2. Tra `sources` lấy document có name === lead.source.
 *   3. Ghi `brand` của nguồn đó vào lead.
 *
 * Là mắt xích #1 của chuỗi: lead tạo -> GẮN BRAND -> (sau này) ZBS bắn tin.
 * Bước ZBS sẽ là một function riêng, kích hoạt KHI brand đã được gắn
 * (lead update có brand + điểm đạt ngưỡng) -> không có race condition.
 */

const { onDocumentCreated } = require('<che>');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

setGlobalOptions({ region: 'asia-southeast1', maxInstances: 10 });

// Cache nhỏ map name->brand để giảm số lần đọc `sources` khi lead về dồn dập.
let _srcCache = null;
let _srcCacheAt = 0;
const CACHE_TTL_MS = 60 * 1000;

async function getBrandForSource(sourceName) {
  if (!sourceName) return '';

  const now = Date.now();
  if (_srcCache && (now - _srcCacheAt) < CACHE_TTL_MS && (sourceName in _srcCache)) {
    return _srcCache[sourceName] || '';
  }

  const snap = await db.collection('sources')
    .where('name', '==', sourceName)
    .limit(1)
    .get();

  let brand = '';
  if (!snap.empty) brand = snap.docs[0].get('brand') || '';

  if (!_srcCache || (now - _srcCacheAt) >= CACHE_TTL_MS) {
    _srcCache = {};
    _srcCacheAt = now;
  }
  _srcCache[sourceName] = brand;
  return brand;
}

exports.tagLeadBrand = onDocumentCreated('leads/{leadId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const lead = snap.data() || {};
  const leadId = event.params.leadId;

  // Đã có brand -> bỏ qua, tránh ghi thừa.
  if (lead.brand && String(lead.brand).trim() !== '') {
    console.log(`[tagLeadBrand][skip] lead ${leadId} đã có brand=${lead.brand}`);
    return;
  }

  const sourceName = lead.source || '';
  if (!sourceName) {
    console.warn(`[tagLeadBrand][warn] lead ${leadId} không có field 'source'`);
    return;
  }

  const brand = await getBrandForSource(sourceName);
  if (!brand) {
    // Nguồn chưa gán brand -> đánh dấu để super admin xử lý, KHÔNG fail.
    console.warn(`[tagLeadBrand][warn] nguồn "${sourceName}" chưa có brand -> lead ${leadId} để trống`);
    await snap.ref.set({
      brand_pending: true,
      brand_tagged_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    return;
  }

  await snap.ref.set({
    brand: brand,
    brand_pending: FieldValue.delete(),
    brand_tagged_at: FieldValue.serverTimestamp(),
    brand_tagged_by: 'tagLeadBrand',
  }, { merge: true });

  console.log(`[tagLeadBrand][ok] lead ${leadId} (source="${sourceName}") -> brand=${brand}`);
});
