// js/api.js – External API wrappers
const TVMAZE_BASE = "https://api.tvmaze.com";

// ⚠️  Replace with your own YouTube Data API v3 key
// Get one at: https://console.cloud.google.com/apis/credentials
const YOUTUBE_API_KEY = "YOUR_API_KEY";
const YOUTUBE_API = "https://www.googleapis.com/youtube/v3/search";

/**
 * Search TVmaze shows by query
 */
export async function searchShows(query) {
  const res = await fetch(
    `${TVMAZE_BASE}/search/shows?q=${encodeURIComponent(query)}`,
  );
  if (!res.ok) throw new Error("TVmaze search failed");
  const data = await res.json();
  return data.map((item) => item.show);
}

/**
 * Get full show details with optional embeds (comma separated)
 */
export async function getShow(id, embed = "") {
  let url = `${TVMAZE_BASE}/shows/${id}`;
  if (embed) url += `?embed=${embed}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch show ${id}`);
  return res.json();
}

/**
 * Get shows by genre (used for recommendations)
 */
export async function getShowsByGenre(genre) {
  const res = await fetch(
    `${TVMAZE_BASE}/shows?genre=${encodeURIComponent(genre)}`,
  );
  if (!res.ok) throw new Error("Genre fetch failed");
  return res.json();
}

/**
 * Search YouTube for a video (trailer / clip)
 * Returns embed URL (autoplay + muted) or null
 */
export async function searchYouTubeTrailer(query) {
  if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === "YOUR_API_KEY") {
    console.warn("YouTube API key missing – trailer search disabled");
    return null;
  }

  const searchQuery = `${query} trailer`;
  const params = new URLSearchParams({
    part: "snippet",
    q: searchQuery,
    maxResults: 1,
    type: "video",
    videoEmbeddable: "true",
    key: YOUTUBE_API_KEY,
  });

  try {
    const res = await fetch(`${YOUTUBE_API}?${params.toString()}`);
    if (!res.ok) throw new Error("YouTube API error");
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      const videoId = data.items[0].id.videoId;
      // mute + autoplay so it starts without sound, respecting user experience
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&enablejsapi=1`;
    }
    return null;
  } catch (e) {
    console.error("YouTube search failed:", e);
    return null;
  }
}
