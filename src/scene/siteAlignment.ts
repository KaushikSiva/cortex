/** Approximate alignment of the demo apron to DataSF NAVD88 building elevations.
 * These values are from neighborhood/buildings.json, not a surveyed camera fit. */
export const ROW_BASES = [-5.29, -3.26, -2.32, -1.58, -.91, -.26, .36];
export const ROW_HEIGHTS = [13.2, 11.76, 11.95, 11.92, 12.02, 11.76, 11.87];
export const ROW_SPACING = 6.35;

export function streetElevation(x: number) {
  // Outside the row there are no street survey samples: do not extrapolate
  // the steep corner-lot grade for hundreds of meters through the neighborhood.
  const t = Math.max(-1, Math.min(7, x / ROW_SPACING + 3));
  const index = Math.max(0, Math.min(5, Math.floor(t)));
  return ROW_BASES[index] + (ROW_BASES[index + 1] - ROW_BASES[index]) * (t - index);
}

/** Shared visual grade for lawn vertices, grass roots and tree planting. */
export function lawnElevation(x: number, y: number) {
  return (y > 4.6 ? streetElevation(x) * Math.min((y - 4.6) / 9, 1) : 0) - .035;
}
