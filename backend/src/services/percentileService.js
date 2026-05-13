/**
 * Percentile calculation from PESU graph distribution data.
 *
 * Takes the seriesArray (mark range buckets with student counts)
 * and the student's actual marks to compute their percentile.
 */

/**
 * Calculate percentile from a single graph's distribution data.
 *
 * @param {Array}  seriesArray  - [{ name: '0 to 5', y: 10 }, { name: '5 to 10', y: 25 }, ...]
 * @param {number} studentMarks - The student's actual score
 * @returns {{ percentile: number, totalStudents: number, studentsBelow: number, studentsBucket: string }}
 */
function calculatePercentile(seriesArray, studentMarks) {
  if (!seriesArray || seriesArray.length === 0) return null;

  const totalStudents = seriesArray.reduce((sum, bucket) => sum + (bucket.y || 0), 0);
  if (totalStudents === 0) return null;

  let studentsBelow = 0;
  let studentsBucket = null;

  for (const bucket of seriesArray) {
    // Parse range: "0 to 5" → [0, 5]
    const rangeMatch = bucket.name.match(/([\d.]+)\s*to\s*([\d.]+)/);
    if (!rangeMatch) continue;

    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);

    if (studentMarks >= high) {
      // Student scored above this entire bucket
      studentsBelow += (bucket.y || 0);
    } else if (studentMarks >= low && studentMarks < high) {
      // Student is IN this bucket — estimate half the bucket is below them
      // (linear interpolation within the bucket)
      const bucketWidth = high - low;
      const posInBucket = (studentMarks - low) / bucketWidth;
      studentsBelow += Math.round((bucket.y || 0) * posInBucket);
      studentsBucket = bucket.name;
    }
    // else: student scored below this bucket, don't count
  }

  const percentile = Math.round((studentsBelow / totalStudents) * 100);

  return {
    percentile: Math.min(99, Math.max(1, percentile)),
    totalStudents,
    studentsBelow,
    studentsBucket,
  };
}

/**
 * Compute an overall weighted percentile across all subjects.
 *
 * @param {Array} subjectPercentiles - [{ courseCode, courseName, percentile, totalStudents, credits }, ...]
 * @returns {{ overallPercentile, topPercentage, standing, comparisonText, subjects }}
 */
function computeOverallPercentile(subjectPercentiles) {
  if (!subjectPercentiles || subjectPercentiles.length === 0) return null;

  // Credit-weighted average percentile
  let weightedSum = 0;
  let totalCredits = 0;

  for (const sp of subjectPercentiles) {
    const credits = sp.credits || 4; // default 4 credits
    weightedSum += sp.percentile * credits;
    totalCredits += credits;
  }

  const overallPercentile = totalCredits > 0
    ? Math.round(weightedSum / totalCredits)
    : Math.round(subjectPercentiles.reduce((s, p) => s + p.percentile, 0) / subjectPercentiles.length);

  const topPercentage = 100 - overallPercentile;

  // Determine academic standing
  let standing;
  if (overallPercentile >= 90)      standing = 'Outstanding';
  else if (overallPercentile >= 80) standing = 'Excellent';
  else if (overallPercentile >= 70) standing = 'Strong';
  else if (overallPercentile >= 55) standing = 'Above Average';
  else if (overallPercentile >= 40) standing = 'Average';
  else if (overallPercentile >= 25) standing = 'Below Average';
  else                              standing = 'Needs Improvement';

  const comparisonText = `Above ${overallPercentile}% of students`;

  return {
    overallPercentile,
    topPercentage: Math.max(1, topPercentage),
    standing,
    comparisonText,
    subjectCount: subjectPercentiles.length,
    subjects: subjectPercentiles,
  };
}

module.exports = { calculatePercentile, computeOverallPercentile };
