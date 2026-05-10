const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const cheerio = require('cheerio');

async function test() {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar, withCredentials: true }));
  
  const res = await client.get('https://www.pesuacademy.com/Academy/');
  const $ = cheerio.load(res.data);
  const csrf = $('meta[name="csrf-token"]').attr('content') || $('input[name="_csrf"]').val();
  const formFields = { _csrf: csrf, loginAs: '1' };
  
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(formFields)) params.set(key, val);
  params.set('j_username', process.env.PESU_SRN);
  params.set('j_password', process.env.PESU_PASS);
  
  const loginRes = await client.post('https://www.pesuacademy.com/Academy/j_spring_security_check', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  
  const $page = cheerio.load(loginRes.data);
  const elementsWithPraveen = [];
  $page('*').each((i, el) => {
    if ($page(el).children().length === 0 && $page(el).text().toLowerCase().includes('praveen')) {
      elementsWithPraveen.push($page(el).prop('tagName') + ($page(el).attr('class') ? '.' + $page(el).attr('class').split(' ').join('.') : ''));
    }
  });
  console.log('Selectors containing name:', elementsWithPraveen.slice(0, 5));
}
test().catch(console.error);
