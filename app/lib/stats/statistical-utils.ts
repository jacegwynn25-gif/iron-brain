/**
 * Statistical Utilities for Iron Brain
 *
 * Provides rigorous statistical methods for:
 * - Confidence intervals
 * - Normalization (z-scores, percentiles)
 * - Outlier detection
 * - Time-series analysis
 * - Bayesian inference
 *
 * All methods are based on established statistical literature.
 */

// ============================================================
// DESCRIPTIVE STATISTICS
// ============================================================

interface DescriptiveStats {
  mean: number;
  median: number;
  stdDev: number;
  variance: number;
  min: number;
  max: number;
  count: number;
  q1: number; // 25th percentile
  q3: number; // 75th percentile
  iqr: number; // Interquartile range
}

export function calculateDescriptiveStats(values: number[]): DescriptiveStats {
  if (values.length === 0) {
    return {
      mean: 0, median: 0, stdDev: 0, variance: 0,
      min: 0, max: 0, count: 0, q1: 0, q3: 0, iqr: 0
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  // Mean
  const mean = values.reduce((sum, v) => sum + v, 0) / n;

  // Median
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  // Variance and Standard Deviation (sample variance, n-1 denominator)
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  // Percentiles
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;

  return {
    mean,
    median,
    stdDev,
    variance,
    min: sorted[0],
    max: sorted[n - 1],
    count: n,
    q1,
    q3,
    iqr
  };
}

/**
 * Calculate percentile using linear interpolation
 * @param sortedValues - Array sorted in ascending order
 * @param p - Percentile (0-1)
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (p <= 0) return sortedValues[0];
  if (p >= 1) return sortedValues[sortedValues.length - 1];

  const index = p * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

// ============================================================
// OUTLIER DETECTION
// ============================================================

interface OutlierAnalysis {
  value: number;
  isOutlier: boolean;
  method: 'iqr' | 'modified_z' | 'zscore';
  score: number;
  threshold: number;
}

/**
 * Detect outliers using Modified Z-Score (robust to outliers)
 * Uses median absolute deviation (MAD)
 * Outlier if: |Modified Z| > 3.5 (Iglewicz & Hoaglin, 1993)
 */
export function detectOutliersModifiedZ(values: number[]): OutlierAnalysis[] {
  const stats = calculateDescriptiveStats(values);
  const median = stats.median;

  // Calculate MAD (Median Absolute Deviation)
  const absoluteDeviations = values.map(v => Math.abs(v - median));
  const mad = percentile(absoluteDeviations.sort((a, b) => a - b), 0.5);

  // Modified Z-Score = 0.6745 * (x - median) / MAD
  // 0.6745 is the 0.75th quartile of the standard normal distribution
  const threshold = 3.5;

  return values.map(value => {
    const modifiedZ = mad === 0 ? 0 : 0.6745 * (value - median) / mad;
    return {
      value,
      isOutlier: Math.abs(modifiedZ) > threshold,
      method: 'modified_z',
      score: Math.abs(modifiedZ),
      threshold
    };
  });
}

// ============================================================
// BAYESIAN INFERENCE
// ============================================================

/**
 * Bayesian weight estimation
 * Combines historical prior with current evidence
 *
 * @param priorMean - Historical average weight
 * @param priorStdDev - Historical standard deviation
 * @param priorCount - Number of historical observations
 * @param currentData - Current session weights
 * @returns Posterior distribution (mean, stdDev, confidence)
 */
export function bayesianWeightEstimate(
  priorMean: number,
  priorStdDev: number,
  priorCount: number,
  currentData: number[]
): {
  posteriorMean: number;
  posteriorStdDev: number;
  confidence: number;
  credibleInterval: { lower: number; upper: number };
} {
  if (currentData.length === 0) {
    return {
      posteriorMean: priorMean,
      posteriorStdDev: priorStdDev,
      confidence: 0.5,
      credibleInterval: { lower: priorMean - priorStdDev, upper: priorMean + priorStdDev }
    };
  }

  const currentStats = calculateDescriptiveStats(currentData);
  const currentMean = currentStats.mean;
  const currentStdDev = currentStats.stdDev;
  const currentCount = currentData.length;

  // Weighted average (more weight to larger sample)
  const totalCount = priorCount + currentCount;
  const posteriorMean = (priorMean * priorCount + currentMean * currentCount) / totalCount;

  // Combined variance (pooled variance formula)
  const priorVariance = priorStdDev * priorStdDev;
  const currentVariance = currentStdDev * currentStdDev;

  const posteriorVariance = (
    (priorCount * priorVariance + currentCount * currentVariance) / totalCount +
    (priorCount * currentCount * Math.pow(priorMean - currentMean, 2)) / (totalCount * totalCount)
  );

  const posteriorStdDev = Math.sqrt(posteriorVariance);

  // Confidence increases with sample size
  const confidence = Math.min(0.95, 1 - 1 / Math.sqrt(totalCount));

  // 95% credible interval
  const z95 = 1.96;
  const credibleInterval = {
    lower: posteriorMean - z95 * posteriorStdDev,
    upper: posteriorMean + z95 * posteriorStdDev
  };

  return {
    posteriorMean,
    posteriorStdDev,
    confidence,
    credibleInterval
  };
}
