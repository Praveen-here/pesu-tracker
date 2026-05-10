const cheerio = require('cheerio');

/**
 * Parse attendance HTML table returned by PESU Academy.
 * Handles the table with id="subjetInfo".
 */
function parseAttendanceHTML(html) {
  const $ = cheerio.load(html);
  const subjects = [];

  $('#subjetInfo tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 4) return;

    const courseCode = $(cells[0]).text().trim();
    const courseName = $(cells[1]).text().trim();
    const classesStr = $(cells[2]).text().trim(); // e.g. "28/36"
    const percentageRaw = $(cells[3]).text().trim();

    if (!courseCode || !classesStr.includes('/')) return;

    const parts = classesStr.split('/');
    const attended = parseInt(parts[0], 10);
    const total = parseInt(parts[1], 10);
    const percentage = parseFloat(percentageRaw) || Math.round((attended / total) * 100);

    let canBunk = 0;
    let classesNeededFor75 = 0;
    let status = 'safe'; // safe | warning | danger

    if (percentage >= 75) {
      // floor((attended - 0.75 * total) / 0.75)
      canBunk = Math.floor((attended - 0.75 * total) / 0.75);
      if (canBunk < 0) canBunk = 0;
      status = percentage >= 80 ? 'safe' : 'warning';
    } else {
      // ceil((0.75 * total - attended) / 0.25)
      classesNeededFor75 = Math.ceil((0.75 * total - attended) / 0.25);
      if (classesNeededFor75 < 0) classesNeededFor75 = 0;
      status = 'danger';
    }

    subjects.push({
      courseCode,
      courseName,
      attended,
      total,
      percentage,
      canBunk,
      classesNeededFor75,
      status,
    });
  });

  return subjects;
}

/**
 * Parse semester list HTML — extracts <option> values and text.
 * Returns array sorted by value descending (latest first).
 */
function parseSemesterOptions(html) {
  const $ = cheerio.load(html);
  const semesters = [];

  $('option').each((_, el) => {
    const value = $(el).attr('value');
    const label = $(el).text().trim();
    if (value && label) {
      semesters.push({ id: value, label });
    }
  });

  // Sort descending by numeric id so latest semester is first
  semesters.sort((a, b) => parseInt(b.id) - parseInt(a.id));
  return semesters;
}

module.exports = { parseAttendanceHTML, parseSemesterOptions };
