// NEA reports PSI and PM2.5 for five regions. These are NEA's own label locations for each.
export const REGION_CENTERS = {
  north: [1.41803, 103.82],
  south: [1.29587, 103.82],
  east: [1.35735, 103.94],
  west: [1.35735, 103.7],
  central: [1.35735, 103.82],
};
export const REGIONS = Object.keys(REGION_CENTERS);

// Distance in km. An equirectangular approximation is accurate to metres at Singapore's size.
export function km(lat1, lng1, lat2, lng2) {
  const x = (lng2 - lng1) * 111.32 * Math.cos((lat1 * Math.PI) / 180);
  const y = (lat2 - lat1) * 110.57;
  return Math.hypot(x, y);
}

export function nearestRegion(lat, lng) {
  return REGIONS.reduce((best, r) => (km(lat, lng, ...REGION_CENTERS[r]) < km(lat, lng, ...REGION_CENTERS[best]) ? r : best));
}
