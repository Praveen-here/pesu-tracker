const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const cheerio = require('cheerio');
const { parseSemesterOptions, parseAttendanceHTML } = require('./parser');

const PESU_BASE = process.env.PESU_BASE_URL || 'https://www.pesuacademy.com/Academy';

function createClient() {
  const jar = new CookieJar();
  const client = wrapper(
    axios.create({
      jar,
      withCredentials: true,
      maxRedirects: 10,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Connection: 'keep-alive',
      },
    })
  );
  return { client, jar };
}

/**
 * GET login page — scrape CSRF token + all form field defaults.
 */
async function getLoginPageData(client) {
  const res = await client.get(`${PESU_BASE}/`, {
    validateStatus: (s) => s < 500,
  });
  const $ = cheerio.load(res.data);

  const csrf =
    $('meta[name="csrf-token"]').attr('content') ||
    $('input[name="_csrf"]').val();
  if (!csrf) throw new Error('Could not extract CSRF token from PESU login page.');

  const formFields = {};
  $('form').first().find('input').each((_, el) => {
    const name = $(el).attr('name');
    const type = $(el).attr('type');
    const val = $(el).attr('value') || '';
    if (!name || type === 'submit' || type === 'radio') return;
    formFields[name] = val;
  });
  // Radio buttons — default loginAs = '1' (student)
  formFields['loginAs'] =
    $('input[name="loginAs"]:checked').attr('value') || '1';
  formFields['_csrf'] = csrf;

  console.log('[PESU] instId:', formFields['instId'], '| loginAs:', formFields['loginAs']);
  return { csrf, formFields };
}

/**
 * POST login. Returns the CSRF token from the post-login page
 * (needed for subsequent AJAX calls that require X-CSRF-TOKEN header).
 */
async function loginToPESU(client, srn, password, formFields) {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(formFields)) params.set(key, val);
  params.set('j_username', srn);
  params.set('j_password', password);

  console.log('[PESU] Posting login for SRN:', srn);

  const res = await client.post(
    `${PESU_BASE}/j_spring_security_check`,
    params.toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: `${PESU_BASE}/`,
        Origin: 'https://www.pesuacademy.com',
      },
      maxRedirects: 10,
      validateStatus: (s) => s < 500,
    }
  );

  const responseUrl =
    res.request?.res?.responseUrl ||
    res.request?.responseURL ||
    res.config?.url ||
    '';
  const html = typeof res.data === 'string' ? res.data : '';

  console.log('[PESU] Login response status:', res.status, '| URL:', responseUrl);

  // Failed auth — PESU redirects to /?authfailed=N
  if (responseUrl.includes('authfailed') || responseUrl.includes('error=')) {
    const code = (responseUrl.match(/authfailed=(\d+)/) || [])[1] || 'unknown';
    throw new Error(`Invalid SRN or password. (error code: ${code})`);
  }

  // Landed back on login page
  const lower = html.toLowerCase();
  if (
    lower.includes('j_password') &&
    html.length < 15000 &&
    !responseUrl.includes('studentProfile')
  ) {
    throw new Error('Invalid SRN or password.');
  }

  // Extract the post-login CSRF token from the returned page meta tag
  const $page = cheerio.load(html);
  const postLoginCsrf =
    $page('meta[name="csrf-token"]').attr('content') ||
    $page('input[name="_csrf"]').val() ||
    formFields['_csrf']; // fallback to pre-login token

  let name = $page('.app-name-font').first().text().trim();
  if (!name) name = $page('h4.info_header').first().text().trim();
  if (!name) name = srn;

  console.log('[PESU] Post-login CSRF:', postLoginCsrf ? postLoginCsrf.substring(0, 20) + '...' : 'same as before', '| Name:', name);
  return { postLoginCsrf, finalUrl: responseUrl, name };
}

/**
 * Fetch semester list.
 * The page JS calls getCombobox('/Academy/a/studentProfilePESU/getStudentSemestersPESU', ...)
 * which is a simple GET that returns <option> HTML.
 */
async function getLatestSemesterId(client, csrf, finalUrl) {
  const semesterUrl = `https://www.pesuacademy.com/Academy/a/studentProfilePESU/getStudentSemestersPESU`;
  const res = await client.get(
    semesterUrl,
    {
      headers: {
        Referer: finalUrl || `${PESU_BASE}/s/studentProfilePESU`,
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-TOKEN': csrf,
      },
      validateStatus: (s) => s < 500,
    }
  );

  const html = typeof res.data === 'string' ? res.data : '';
  console.log('[PESU] Semester GET status:', res.status, '| HTML length:', html.length);
  console.log('[PESU] Semester HTML sample:', html.substring(0, 300));

  const semesters = parseSemesterOptions(html);
  if (semesters.length > 0) {
    console.log('[PESU] Semesters found:', semesters);
    return { semId: semesters[0].id };
  }

  throw new Error('No semesters found. Check PESU session.');
}

/**
 * Fetch attendance for a semester.
 */
async function fetchAttendance(client, semesterId, csrf, finalUrl) {
  const params = new URLSearchParams({
    _csrf: csrf,
    controllerMode: '6407',
    actionType: '8',
    batchClassId: semesterId,
    menuId: '660',
  });

  const res = await client.post(
    `${PESU_BASE}/s/studentProfilePESUAdmin`,
    params.toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: finalUrl || `${PESU_BASE}/s/studentProfilePESU`,
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-TOKEN': csrf,
      },
      validateStatus: (s) => s < 500,
    }
  );

  const html = typeof res.data === 'string' ? res.data : '';
  console.log('[PESU] Attendance fetch status:', res.status, '| HTML length:', html.length);
  if (html.length < 50) {
    console.warn('[PESU] Attendance HTML is very short — may be empty or session expired.');
  }
  return parseAttendanceHTML(html);
}

/**
 * Full pipeline: login → semesters → attendance.
 */
async function fullLogin(srn, password) {
  const { client, jar } = createClient();

  const { formFields } = await getLoginPageData(client);
  const { postLoginCsrf, finalUrl, name } = await loginToPESU(client, srn, password, formFields);
  const { semId } = await getLatestSemesterId(client, postLoginCsrf, finalUrl);
  const attendance = await fetchAttendance(client, semId, postLoginCsrf, finalUrl);

  return { serializedJar: jar.toJSON(), semId, attendance, csrf: postLoginCsrf, name };
}

/**
 * Refresh attendance from a stored session.
 */
async function refreshAttendance(serializedJar, semId, csrf) {
  const jar = CookieJar.fromJSON(JSON.stringify(serializedJar));
  const { client } = createClient();
  client.defaults.jar = jar;
  return fetchAttendance(client, semId, csrf || '');
}

/**
 * Fetch all ISA/ESA results for every semester.
 * Uses actionType=52 (final/completed results) and actionType=53 (provisional/in-progress).
 */
async function fetchAllResults(serializedJar, csrf, finalUrl) {
  const jar = CookieJar.fromJSON(JSON.stringify(serializedJar));
  const { client } = createClient();
  client.defaults.jar = jar;

  const h = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Referer: finalUrl || `${PESU_BASE}/s/studentProfilePESU`,
    'X-Requested-With': 'XMLHttpRequest',
    'X-CSRF-TOKEN': csrf,
  };

  // Get semester list for results
  const semRes = await client.get(
    `${PESU_BASE}/a/studentProfilePESU/getEsaAndIsaResultSemBySRN?_=${Date.now()}`,
    { headers: { Referer: finalUrl || `${PESU_BASE}/s/studentProfilePESU`, 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrf }, validateStatus: (s) => s < 500 }
  );
  const $sems = cheerio.load(`<select>${semRes.data}</select>`);
  const sems = [];
  $sems('option').each((_, el) => sems.push({ id: $sems(el).attr('value'), label: $sems(el).text().trim() }));
  console.log('[PESU] Result semesters:', sems);

  const allResults = [];

  for (const sem of sems) {
    // actionType=9 with semid returns full results HTML (SGPA/CGPA if complete, ISA marks if in-progress)
    const res = await client.post(
      `${PESU_BASE}/s/studentProfilePESUAdmin`,
      new URLSearchParams({ _csrf: csrf, controllerMode: '6402', actionType: '9', semid: sem.id, menuId: '655' }).toString(),
      { headers: h, validateStatus: (s) => s < 500 }
    );
    const html = typeof res.data === 'string' ? res.data : '';
    console.log(`[PESU] Results sem=${sem.id} (${sem.label}): len=${html.length}`);

    allResults.push({
      semId: sem.id,
      semLabel: sem.label,
      html: html.length > 200 ? html : null,
    });
  }

  return { sems, allResults };
}

/**
 * Fetch ISA/Assignment graph distribution data for a single subject+assessment.
 * actionType=58, menuId=652
 *
 * @param {object}  serializedJar  - cookie jar
 * @param {string}  csrf           - CSRF token
 * @param {string}  finalUrl       - referer URL
 * @param {object}  params         - { subjectId, marks, totalMarks, batchClassId, isaMarksMasterId }
 * @returns {{ seriesArray, myScoreRange, drilldownSeries } | null}
 */
async function fetchISAGraph(serializedJar, csrf, finalUrl, params) {
  const jar = CookieJar.fromJSON(JSON.stringify(serializedJar));
  const { client } = createClient();
  client.defaults.jar = jar;

  const h = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Referer: finalUrl || `${PESU_BASE}/s/studentProfilePESU`,
    'X-Requested-With': 'XMLHttpRequest',
    'X-CSRF-TOKEN': csrf,
  };

  const body = new URLSearchParams({
    url: 'studentProfilePESUAdmin',
    _csrf: csrf,
    controllerMode: '6402',
    actionType: '58',
    subjectId: params.subjectId,
    Isamarks: String(params.marks),
    Totalmarks: String(params.totalMarks),
    BatchClassId: params.batchClassId,
    IsaMarkMasterId: String(params.isaMarksMasterId), // NOTE: no 's' — matches PESU JS exactly
    menuId: params.menuId || '652',
  }).toString();

  try {
    const res = await client.post(`${PESU_BASE}/s/studentProfilePESUAdmin`, body, {
      headers: h,
      validateStatus: (s) => s < 500,
    });

    const html = typeof res.data === 'string' ? res.data : '';
    return parseGraphHTML(html, params.marks);
  } catch (err) {
    console.error(`[Graph] Error fetching graph for subject ${params.subjectId}:`, err.message);
    return null;
  }
}

/**
 * Parse the graph HTML response to extract distribution data.
 * Extracts `seriesArray` and `myScoreRange` from embedded <script> tags.
 */
function parseGraphHTML(html, studentMarks) {
  // Extract seriesArray: var seriesArray = [{...}, ...];
  const seriesMatch = html.match(/var\s+seriesArray\s*=\s*(\[.*?\]);/s);
  if (!seriesMatch) return null;

  // Extract myScoreRange: var myScoreRange = [{...}];
  const scoreMatch = html.match(/var\s+myScoreRange\s*=\s*(\[.*?\]);/s);

  try {
    // Parse the JS array by replacing single quotes with double quotes
    const seriesRaw = seriesMatch[1].replace(/'/g, '"');
    const seriesArray = JSON.parse(seriesRaw);

    let myScoreRange = null;
    if (scoreMatch) {
      const scoreRaw = scoreMatch[1].replace(/'/g, '"');
      myScoreRange = JSON.parse(scoreRaw);
    }

    return { seriesArray, myScoreRange, studentMarks };
  } catch (err) {
    console.error('[Graph] Failed to parse graph data:', err.message);
    return null;
  }
}

module.exports = { fullLogin, refreshAttendance, fetchAllResults, fetchISAGraph };
