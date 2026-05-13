const cheerio = require('cheerio');

/**
 * Parse ISA/ESA results HTML for a semester.
 *
 * PESU HTML quirks handled:
 *   - Each ISA 1, ISA 2, Assignment entry appears TWICE (duplicate divs)
 *   - 0-credit subjects (e.g. Personality Development) only have FINAL ISA + ESA grade
 *   - In-progress semesters have no SGPA/CGPA info bar, no credits column
 *   - FINAL ISA of "0" when semester is in-progress means "not yet calculated"
 *   - ESA "NA" means not yet taken
 */
function parseResultsHTML(html) {
  const $ = cheerio.load(html);
  const result = {
    isCompleted: false,
    semester: null,
    esaDescription: null,
    sgpa: null,
    cgpa: null,
    earnedCredits: null,
    totalCredits: null,
    subjects: [],
  };

  // Metadata
  $('label').each((_, el) => {
    const text = $(el).text();
    const semMatch = text.match(/Semester:\s*(\d+)/);
    if (semMatch) result.semester = parseInt(semMatch[1]);
    const esaMatch = text.match(/ESA Description:\s*(.+)/);
    if (esaMatch) result.esaDescription = esaMatch[1].trim();
  });

  // Completed Semester: SGPA/CGPA block
  const infoBar = $('.info-contents .dashboard-info-bar').first();
  if (infoBar.length) {
    infoBar.find('> div').each((_, div) => {
      const h6 = $(div).find('h6').first().text().trim();
      const rawText = $(div).clone().children('h6').remove().end().text().trim();
      if (h6 === 'SGPA') {
        result.sgpa = parseFloat(rawText) || null;
        result.isCompleted = result.sgpa !== null;
      } else if (h6 === 'CGPA') {
        result.cgpa = parseFloat(rawText) || null;
      } else if (h6 === 'Earned Credits') {
        const m = rawText.match(/([\d.]+)\/([\d.]+)/);
        if (m) { result.earnedCredits = parseFloat(m[1]); result.totalCredits = parseFloat(m[2]); }
      }
    });
  }

  // Parse subjects from .clearfix blocks
  $('.clearfix').each((_, block) => {
    const headerH6 = $(block).find('.header-info h6').first();
    if (!headerH6.length) return;

    const courseCode = headerH6.find('.lbl-title-light').text().replace(/-/g, '').trim();
    if (!courseCode) return;

    const courseNameRaw = headerH6.clone().children('.lbl-title-light').remove().end().text();
    const courseName = courseNameRaw.replace(/\s+/g, ' ').trim();

    // Parse credits — format: <span class="f-size-semi-big">5</span> / 5
    const creditsH6 = $(block).find('h6.text-right').first();
    let credits = null;
    if (creditsH6.length) {
      const earnedText = creditsH6.find('.f-size-semi-big').text().trim();
      const fullText = creditsH6.text().trim();
      const slashMatch = fullText.match(/([\d.]+)\s*\/\s*([\d.]+)/);
      if (slashMatch) {
        credits = { earned: parseFloat(slashMatch[1]), total: parseFloat(slashMatch[2]) };
      } else if (earnedText) {
        const earned = parseFloat(earnedText);
        credits = { earned, total: earned };
      }
    }

    const isZeroCredit = credits && credits.total === 0;

    // Parse marks from dashboard-info-bar divs
    // IMPORTANT: PESU duplicates ISA 1, ISA 2, Assignment entries.
    // We use a Set to only take the first occurrence of each label.
    const marks = {};
    const seenLabels = new Set();

    $(block).find('.dashboard-info-bar > div').each((_, div) => {
      // The h6 can be directly in the div, or nested inside an inner div (for ESA)
      let label = $(div).find('> h6').first().text().trim();

      // ESA is often inside a nested div: <div><div><h6>ESA</h6>...</div></div>
      if (!label) {
        const innerH6 = $(div).find('div > h6').first().text().trim();
        if (innerH6) label = innerH6;
      }

      if (!label) return;

      // Skip duplicates
      if (seenLabels.has(label)) return;
      seenLabels.add(label);

      const scoreEl = $(div).find('.dark-text.f-size-semi-big, .f-size-semi-big, .f-size-2x-big').first();
      const scoreText = scoreEl.text().trim();
      const divText = $(div).text();
      const maxMatch = divText.match(/\/([\d.]+)/);
      const max = maxMatch ? parseFloat(maxMatch[1]) : null;

      // Parse score: numeric or string (grade letter like A, B, C, AP, etc.)
      let score;
      if (!scoreText || scoreText === 'NA') {
        score = null;
      } else {
        const numScore = parseFloat(scoreText);
        score = isNaN(numScore) ? scoreText : numScore;
      }

      if (label === 'ISA 1') {
        marks.isa1 = { score: typeof score === 'number' ? score : null, max: max || 40 };
      } else if (label === 'ISA 2') {
        marks.isa2 = { score: typeof score === 'number' ? score : null, max: max || 40 };
      } else if (label === 'Assignment') {
        marks.assignment = { score: typeof score === 'number' ? score : null, max: max || 10 };
      } else if (label === 'FINAL ISA') {
        const finalScore = typeof score === 'number' ? score : null;
        // PESU shows FINAL ISA = 0 as placeholder when semester is in-progress
        // Only trust it if the semester is completed OR if it's > 0
        marks.finalIsa = { score: (finalScore === 0 && !result.isCompleted) ? null : finalScore };
      } else if (label === 'ESA') {
        // ESA is a grade letter (A, B, C, P, F, AP, etc.) or null
        if (typeof score === 'string' && score !== 'NA') {
          marks.esa = score;
        } else {
          marks.esa = null;
        }
      }
    });

    // Extract subjectId from graph JavaScript links
    // Pattern: showISAResultGraph('21281','32.5','40.0','3064','1')
    const blockHtml = $(block).html() || '';
    const graphMatch = blockHtml.match(/showISAResultGraph\('(\d+)'/);
    const subjectId = graphMatch ? graphMatch[1] : null;

    result.subjects.push({ courseCode, courseName, credits, marks, isZeroCredit: !!isZeroCredit, subjectId });
  });

  return result;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const GRADE_CUTOFFS = [
  { grade: 'O', points: 10, minPct: 90 },
  { grade: 'A', points: 9,  minPct: 80 },
  { grade: 'B', points: 8,  minPct: 70 },
  { grade: 'C', points: 7,  minPct: 60 },
  { grade: 'P', points: 5,  minPct: 50 },
  { grade: 'F', points: 0,  minPct: 0  },
];
const TOTAL_MAX        = 150;
const ISA_MAX          = 50;
const ESA_MAX          = 100;
const ASSUMED_ASSIGNMENT = 8.5;            // Only assumption: 8.5/10 if not yet given
const TARGET_TOTAL     = Math.ceil(TOTAL_MAX * 0.70); // 105 = Grade B = CGPA ≥ 8

/**
 * Compute minimum marks needed for CGPA ≥ 8 (Grade B = 105/150).
 *
 * ONLY assumption made: Assignment = 8.5/10 (if not yet released by teacher).
 * Everything else is pure math — no guessing.
 *
 * Skips 0-credit subjects entirely (they have no ISA/ESA marks, just a pass/fail grade).
 */
function computeMinMarks(subject) {
  // Skip 0-credit subjects — they don't factor into CGPA
  if (subject.isZeroCredit) {
    return {
      state: 'zero_credit',
      currentIsa1: null,
      currentIsa2: null,
      assignment: null,
      finalIsa: null,
      minEsa: null,
      scenarios: null,
      impossible: false,
      alreadySecured: false,
      targets: {},
    };
  }

  const { marks } = subject;
  const isa1             = marks.isa1?.score ?? null;
  const isa2             = marks.isa2?.score ?? null;
  const assignmentActual = marks.assignment?.score ?? null;
  const assignment       = assignmentActual ?? ASSUMED_ASSIGNMENT;
  const hasIsa1          = isa1 !== null;
  const hasIsa2          = isa2 !== null;
  const hasEsa           = marks.esa !== null && marks.esa !== undefined && marks.esa !== 'NA';

  const state = !hasIsa1 ? 'none' : !hasIsa2 ? 'isa1_done' : hasEsa ? 'complete' : 'isa2_done';

  // Final ISA (known when both ISA scores exist)
  let finalIsa = null;
  if (marks.finalIsa?.score != null) {
    finalIsa = marks.finalIsa.score;
  } else if (hasIsa1 && hasIsa2) {
    finalIsa = (isa1 + isa2) / 2 + assignment;
  }

  let minEsa        = null;
  let scenarios     = null;
  let impossible    = false;
  let alreadySecured = false;

  // ── ISA2 done: single exact number, zero assumptions ─────────────────────
  if (state === 'isa2_done') {
    const fi  = finalIsa ?? ((isa1 + isa2) / 2 + assignment);
    const raw = TARGET_TOTAL - fi;
    minEsa        = Math.max(0, Math.ceil(raw));
    impossible    = raw > 100;
    alreadySecured = raw <= 0;
  }

  // ── ISA1 done: honest range table, no hidden assumptions ─────────────────
  if (state === 'isa1_done') {
    // Checkpoints cover the full spectrum of ISA2 performance
    const checkpoints = [40, 35, 30, 25, 20, 15, 10, 0];
    scenarios = checkpoints.map(isa2Val => {
      const fi            = (isa1 + isa2Val) / 2 + assignment;  // exact Final ISA for this ISA2
      const rawEsa        = TARGET_TOTAL - fi;                   // exact ESA needed
      const minEsaForThis = Math.ceil(rawEsa);
      return {
        isa2Val,
        finalIsa:     Math.round(fi * 10) / 10,
        minEsa:       Math.max(0, minEsaForThis),
        esaImpossible: minEsaForThis > 100,  // even 100/100 in ESA won't save you
        esaSecured:    minEsaForThis <= 0,   // you've already crossed 105 without ESA
      };
    });

    // Overall flags
    impossible     = scenarios[0].esaImpossible;             // impossible even with ISA2=40
    alreadySecured = scenarios[scenarios.length - 1].esaSecured; // secured even with ISA2=0
  }

  return {
    state,
    currentIsa1: isa1,
    currentIsa2: isa2,
    assignment: assignmentActual,
    finalIsa,
    minEsa,       // ISA2-done case: exact min ESA
    scenarios,    // ISA1-done case: range table
    impossible,
    alreadySecured,
    targets: {},  // kept for compatibility
  };
}

/**
 * Project SGPA for an in-progress semester.
 */
function projectSGPA(subjects, creditDefault = 4) {
  let weightedSum = 0, totalCredits = 0;
  for (const sub of subjects) {
    // Skip 0-credit subjects
    if (sub.isZeroCredit) continue;
    const credits = sub.credits?.total ?? creditDefault;
    const a = computeMinMarks(sub);
    if (a.finalIsa !== null) {
      const likelyTotal = a.finalIsa + 70;
      const pct   = likelyTotal / TOTAL_MAX * 100;
      const grade = GRADE_CUTOFFS.find(g => pct >= g.minPct);
      if (grade) { weightedSum += grade.points * credits; totalCredits += credits; }
    }
  }
  return totalCredits > 0 ? Math.round(weightedSum / totalCredits * 100) / 100 : null;
}

module.exports = { parseResultsHTML, computeMinMarks, projectSGPA, GRADE_CUTOFFS, TOTAL_MAX, ISA_MAX, ESA_MAX };
