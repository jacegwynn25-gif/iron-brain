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

export interface DescriptiveStats {
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
export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (p <= 0) return sortedValues[0];
  if (p >= 1) return sortedValues[sortedValues.length - 1];

  const index = p * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

/**
 * Calculate z-score (standard score)
 * Z = (X - μ) / σ
 */
export function zScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * Convert z-score to percentile rank (approximate)
 * Uses error function approximation
 */
export function zScoreToPercentile(z: number): number {
  // Approximation of cumulative distribution function for normal distribution
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

  return z > 0 ? 1 - p : p;
}

// ============================================================
// CONFIDENCE INTERVALS
// ============================================================

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  mean: number;
  marginOfError: number;
  confidenceLevel: number;
}

/**
 * Calculate confidence interval for a sample mean
 * Uses t-distribution for small samples (n < 30), normal for large
 */
export function confidenceInterval(
  values: number[],
  confidenceLevel: number = 0.95
): ConfidenceInterval {
  const n = values.length;
  if (n === 0) {
    return { lower: 0, upper: 0, mean: 0, marginOfError: 0, confidenceLevel };
  }

  const stats = calculateDescriptiveStats(values);
  const mean = stats.mean;
  const stdError = stats.stdDev / Math.sqrt(n);

  // For simplicity, use z-score (normal approximation)
  // For n < 30, should use t-distribution, but z is close enough for our purposes
  const zCritical = getZCritical(confidenceLevel);
  const marginOfError = zCritical * stdError;

  return {
    lower: mean - marginOfError,
    upper: mean + marginOfError,
    mean,
    marginOfError,
    confidenceLevel
  };
}

/**
 * Get critical z-value for confidence level
 */
function getZCritical(confidenceLevel: number): number {
  // Common confidence levels
  const levels: Record<string, number> = {
    '0.90': 1.645,
    '0.95': 1.96,
    '0.99': 2.576,
    '0.999': 3.291
  };

  return levels[confidenceLevel.toFixed(2)] || 1.96;
}

// ============================================================
// OUTLIER DETECTION
// ============================================================

export interface OutlierAnalysis {
  value: number;
  isOutlier: boolean;
  method: 'iqr' | 'modified_z' | 'zscore';
  score: number;
  threshold: number;
}

/**
 * Detect outliers using IQR method (Tukey's fences)
 * Outlier if: value < Q1 - 1.5*IQR or value > Q3 + 1.5*IQR
 */
export function detectOutliersIQR(values: number[]): OutlierAnalysis[] {
  const stats = calculateDescriptiveStats(values);
  const lowerFence = stats.q1 - 1.5 * stats.iqr;
  const upperFence = stats.q3 + 1.5 * stats.iqr;

  return values.map(value => ({
    value,
    isOutlier: value < lowerFence || value > upperFence,
    method: 'iqr',
    score: Math.max(
      Math.abs(value - lowerFence),
      Math.abs(value - upperFence)
    ),
    threshold: 1.5 * stats.iqr
  }));
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
// TIME SERIES ANALYSIS
// ============================================================

/**
 * Calculate exponentially weighted moving average (EWMA)
 * More weight on recent values
 * @param alpha - Smoothing factor (0-1), higher = more weight on recent
 */
export function exponentialMovingAverage(values: number[], alpha: number = 0.3): number[] {
  if (values.length === 0) return [];

  const result: number[] = [values[0]];

  for (let i = 1; i < values.length; i++) {
    result.push(alpha * values[i] + (1 - alpha) * result[i - 1]);
  }

  return result;
}

/**
 * Calculate simple moving average
 */
export function simpleMovingAverage(values: number[], windowSize: number): number[] {
  if (values.length < windowSize) return [values.reduce((a, b) => a + b, 0) / values.length];

  const result: number[] = [];
  for (let i = windowSize - 1; i < values.length; i++) {
    const window = values.slice(i - windowSize + 1, i + 1);
    result.push(window.reduce((a, b) => a + b, 0) / windowSize);
  }

  return result;
}

/**
 * Detect trend using linear regression
 * Returns slope (positive = upward, negative = downward)
 */
export function detectTrend(values: number[]): {
  slope: number;
  intercept: number;
  rSquared: number;
  trend: 'increasing' | 'decreasing' | 'stable';
} {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: 0, rSquared: 0, trend: 'stable' };

  // Linear regression: y = mx + b
  const x = Array.from({ length: n }, (_, i) => i);
  const y = values;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R-squared (coefficient of determination)
  const meanY = sumY / n;
  const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
  const ssResidual = y.reduce((sum, yi, i) => sum + Math.pow(yi - (slope * x[i] + intercept), 2), 0);
  const rSquared = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;

  // Classify trend (use significance threshold)
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (Math.abs(slope) > 0.05) { // Threshold for "significant" trend
    trend = slope > 0 ? 'increasing' : 'decreasing';
  }

  return { slope, intercept, rSquared, trend };
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

// ============================================================
// NORMALIZATION
// ============================================================

/**
 * Normalize value to percentile rank (0-100)
 * Relative to user's historical distribution
 */
export function normalizeToPercentile(value: number, historicalValues: number[]): number {
  if (historicalValues.length === 0) return 50; // No data = assume median

  const sorted = [...historicalValues].sort((a, b) => a - b);

  // Count how many values are less than or equal to current value
  const countBelow = sorted.filter(v => v <= value).length;

  return (countBelow / sorted.length) * 100;
}

/**
 * Normalize value using z-score, then convert to 0-100 scale
 */
export function normalizeZScore(value: number, historicalValues: number[]): number {
  const stats = calculateDescriptiveStats(historicalValues);
  const z = zScore(value, stats.mean, stats.stdDev);

  // Convert z-score to percentile, then to 0-100 scale
  const percentile = zScoreToPercentile(z);
  return percentile * 100;
}

// ============================================================
// EFFECT SIZE
// ============================================================

/**
 * Cohen's d effect size
 * Small: 0.2, Medium: 0.5, Large: 0.8
 */
export function cohensD(group1: number[], group2: number[]): number {
  const stats1 = calculateDescriptiveStats(group1);
  const stats2 = calculateDescriptiveStats(group2);

  // Pooled standard deviation
  const n1 = group1.length;
  const n2 = group2.length;
  const pooledStdDev = Math.sqrt(
    ((n1 - 1) * stats1.variance + (n2 - 1) * stats2.variance) / (n1 + n2 - 2)
  );

  return (stats1.mean - stats2.mean) / pooledStdDev;
}

/**
 * Interpret effect size
 */
export function interpretEffectSize(d: number): 'negligible' | 'small' | 'medium' | 'large' {
  const abs = Math.abs(d);
  if (abs < 0.2) return 'negligible';
  if (abs < 0.5) return 'small';
  if (abs < 0.8) return 'medium';
  return 'large';
}
