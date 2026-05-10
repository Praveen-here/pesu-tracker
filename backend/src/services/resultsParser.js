const cheerio = require('cheerio');

/**
 * Parse ISA/ESA results HTML for a semester.
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

    const creditsText = $(block).find('h6.text-right, .text-right h6').first().text();
    const creditsMatch = creditsText.match(/([\d.]+)\s*\/\s*([\d.]+)/);
    const credits = creditsMatch ? { earned: parseFloat(creditsMatch[1]), total: parseFloat(creditsMatch[2]) } : null;

    const marks = {};
    const seenLabels = new Set();

    $(block).find('.dashboard-info-bar > div').each((_, div) => {
      const label = $(div).find('h6').first().text().trim();
      if (!label) return;
      if (seenLabels.has(label) && (label === 'ISA 1' || label === 'ISA 2' || label === 'Assignment')) return;
      seenLabels.add(label);

      const scoreEl = $(div).find('.dark-text.f-size-semi-big, .f-size-semi-big, .f-size-2x-big').first();
      const scoreText = scoreEl.text().trim();
      const divText = $(div).text();
      const maxMatch = divText.match(/\/([\d.]+)/);
      const max = maxMatch ? parseFloat(maxMatch[1]) : null;
      const score = (!scoreText || scoreText === 'NA') ? null : (parseFloat(scoreText) || scoreText);

      if (label === 'ISA 1')     marks.isa1       = { score: typeof score === 'number' ? score : null, max: max || 40 };
      else if (label === 'ISA 2')     marks.isa2       = { score: typeof score === 'number' ? score : null, max: max || 40 };
      else if (label === 'Assignment') marks.assignment = { score: typeof score === 'number' ? score : null, max: max || 10 };
      else if (label === 'FINAL ISA') marks.finalIsa   = { score: typeof score === 'number' ? score : null };
      else if (label === 'ESA' || label === 'NA') marks.esa = (typeof score === 'string' && score !== 'NA') ? score : (typeof score === 'number' ? String(score) : null);
    });

    result.subjects.push({ courseCode, courseName, credits, marks });
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
 * ISA1 done, ISA2 pending:
 *   → Two unknowns (ISA2 + ESA). Cannot solve without fixing one.
 *   → So we return a RANGE: for every possible ISA2 score (40,35,30...0),
 *     we compute the exact ESA you'd need. Student picks their row.
 *
 * ISA1 + ISA2 done, ESA pending:
 *   → One unknown. Exact answer. No assumptions needed.
 */
function computeMinMarks(subject) {
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
