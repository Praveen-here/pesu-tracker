require('dotenv').config();
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const cheerio = require('cheerio');

const PESU_BASE = 'https://www.pesuacademy.com/Academy';
const jar = new CookieJar();
const client = wrapper(axios.create({ jar, withCredentials: true, maxRedirects: 10, headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120' } }));

async function run() {
  const pageRes = await client.get(`${PESU_BASE}/`);
  const $ = cheerio.load(pageRes.data);
  const csrf = $('meta[name="csrf-token"]').attr('content');
  const formFields = { '_csrf': csrf, 'loginAs': '1', 'j_username': process.env.PESU_SRN, 'j_password': process.env.PESU_PASS };
  $('form').first().find('input').each((_, el) => {
    const n = $(el).attr('name'), t = $(el).attr('type'), v = $(el).attr('value') || '';
    if (n && t !== 'submit' && t !== 'radio') formFields[n] = v;
  });
  formFields['_csrf'] = csrf; formFields['j_username'] = process.env.PESU_SRN; formFields['j_password'] = process.env.PESU_PASS;
  const loginRes = await client.post(`${PESU_BASE}/j_spring_security_check`, new URLSearchParams(formFields).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${PESU_BASE}/`, Origin: 'https://www.pesuacademy.com' }, validateStatus: s => s < 500 });
  const finalUrl = loginRes.request?.res?.responseUrl || '';
  const postCsrf = cheerio.load(loginRes.data)('meta[name="csrf-token"]').attr('content') || csrf;
  const h = { 'Content-Type': 'application/x-www-form-urlencoded', Referer: finalUrl, 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': postCsrf };
  console.log('✅ Logged in');

  // actionType=52 - final results 
  const r52 = await client.post(`${PESU_BASE}/s/studentProfilePESUAdmin`,
    new URLSearchParams({ _csrf: postCsrf, controllerMode: '6402', actionType: '52', menuId: '655' }).toString(),
    { headers: h, validateStatus: s => s < 500 });
  console.log('[52] len:', r52.data.length, '\nHTML:\n', String(r52.data).substring(0, 2000));
  
  // actionType=9 with semId - get semester-specific results
  const semRes = await client.get(`${PESU_BASE}/a/studentProfilePESU/getEsaAndIsaResultSemBySRN?_=${Date.now()}`,
    { headers: { Referer: finalUrl, 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': postCsrf }, validateStatus: s => s < 500 });
  const $s = cheerio.load(`<select>${semRes.data}</select>`);
  const sems = [];
  $s('option').each((_, el) => sems.push({ id: $s(el).attr('value'), label: $s(el).text().trim() }));
  console.log('Sems:', sems);

  for (const sem of sems) {
    const r9 = await client.post(`${PESU_BASE}/s/studentProfilePESUAdmin`,
      new URLSearchParams({ _csrf: postCsrf, controllerMode: '6402', actionType: '9', semid: sem.id, menuId: '655' }).toString(),
      { headers: h, validateStatus: s => s < 500 });
    console.log(`\n[semId=${sem.id} ${sem.label}] len:`, r9.data.length);
    console.log('FULL HTML:\n', String(r9.data).substring(0, 3000));
  }
}

run().catch(console.error);
