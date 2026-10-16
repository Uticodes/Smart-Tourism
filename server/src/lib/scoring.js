/**
 * Recommendation score (Section 3.7.3, FR-04).
 *
 *   score = 0.4 × category match + 0.3 × rating + 0.3 × proximity
 *
 *   category match = 1.0 if the attraction's category is one the user chose, otherwise 0.3
 *                    (guests have no choices, so every attraction gets 0.3 and the ranking
 *                    falls back to rating and distance)
 *   rating         = average rating ÷ 5, or 0.5 (neutral) when nobody has rated it yet,
 *                    so new and community-discovered sites are not pushed to the bottom
 *   proximity      = 1 − distance ÷ search radius (1 at the search point, 0 at the edge)
 *
 * Every part is between 0 and 1, so the score is between 0 and 1.
 */
const WEIGHTS = Object.freeze({ category: 0.4, rating: 0.3, proximity: 0.3 });
const CATEGORY_MATCH = 1.0;
const CATEGORY_OTHER = 0.3;
const UNRATED = 0.5;

function categoryPart(categoryId, preferredIds) {
  return preferredIds.has(Number(categoryId)) ? CATEGORY_MATCH : CATEGORY_OTHER;
}

function ratingPart(avgRating) {
  if (avgRating == null) return UNRATED;
  return Math.min(Math.max(Number(avgRating) / 5, 0), 1);
}

function proximityPart(distanceKm, radiusKm) {
  if (!(radiusKm > 0)) return 0;
  return Math.min(Math.max(1 - distanceKm / radiusKm, 0), 1);
}

const round3 = (n) => Math.round(n * 1000) / 1000;

/**
 * Scores one attraction. `preferredIds` is a Set of category ids (empty for guests).
 * Returns the total and its three parts, so the client can explain why a place ranks where it does.
 */
function score(attraction, preferredIds, distanceKm, radiusKm) {
  const parts = {
    category: categoryPart(attraction.category_id, preferredIds),
    rating: ratingPart(attraction.avg_rating),
    proximity: proximityPart(distanceKm, radiusKm),
  };
  const total = WEIGHTS.category * parts.category + WEIGHTS.rating * parts.rating + WEIGHTS.proximity * parts.proximity;
  return { score: round3(total), parts: { category: parts.category, rating: round3(parts.rating), proximity: round3(parts.proximity) } };
}

/** Scores and sorts a list of search results (each already carrying distance_km). Ties go to the nearer place. */
function rank(attractions, preferredIds, radiusKm) {
  return attractions
    .map((a) => {
      const s = score(a, preferredIds, a.distance_km, radiusKm);
      return { ...a, score: s.score, score_parts: s.parts, matches_preference: preferredIds.has(Number(a.category_id)) };
    })
    .sort((a, b) => b.score - a.score || a.distance_km - b.distance_km)
    .map((a, i) => ({ ...a, rank: i + 1 }));
}

module.exports = { WEIGHTS, score, rank, categoryPart, ratingPart, proximityPart };
