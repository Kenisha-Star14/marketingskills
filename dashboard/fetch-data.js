#!/usr/bin/env node
/**
 * fetch-data.js — pulls The WELL Co.'s social analytics directly from the
 * platforms' own free APIs (no Metricool, no middleman). Zero dependencies,
 * Node 18+.
 *
 * Reads credentials from environment variables (set them in the Claude Code
 * environment settings — never commit them):
 *   META_PAGE_TOKEN        long-lived Facebook Page access token
 *                          (covers the Facebook Page AND the connected
 *                          Instagram business account)
 *   FB_PAGE_ID             Facebook Page id (default: The WELL Co. page)
 *   THREADS_ACCESS_TOKEN   long-lived Threads token (~60 days, renewable)
 *   YOUTUBE_API_KEY        Google API key with YouTube Data API v3 enabled
 *   YOUTUBE_CHANNEL_ID     (default: The WELL Co. channel)
 *   GRAPH_VERSION          Meta Graph API version (default v23.0)
 *
 * Usage:  node dashboard/fetch-data.js
 * Output: dashboard/data/latest.json + a console summary. Sections whose
 * token is missing or whose calls fail are skipped and listed in `errors`,
 * so a partial setup still produces usable data.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const V = process.env.GRAPH_VERSION || "v23.0";
const META_TOKEN = process.env.META_PAGE_TOKEN || "";
const FB_PAGE_ID = process.env.FB_PAGE_ID || "1056188877585901";
const THREADS_TOKEN = process.env.THREADS_ACCESS_TOKEN || "";
const YT_KEY = process.env.YOUTUBE_API_KEY || "";
const YT_CHANNEL = process.env.YOUTUBE_CHANNEL_ID || "UCt-PH517zrv5hdf9UqZov2w";

const DAYS = 14;
const now = new Date();
const until = Math.floor(now.getTime() / 1000);
const since = until - DAYS * 86400;
const sinceISO = new Date(since * 1000).toISOString();

const out = { fetchedAt: now.toISOString(), windowDays: DAYS, errors: [] };

async function get(url, label) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body && body.error ? body.error.message : "HTTP " + res.status;
    throw new Error(label + ": " + msg);
  }
  return body;
}

function fail(section, err) {
  out.errors.push(section + " — " + err.message);
}

/* ---------- Facebook Page + Instagram (one Meta token) ---------- */
async function fetchMeta() {
  if (!META_TOKEN) {
    out.errors.push("meta — META_PAGE_TOKEN not set (see dashboard/SETUP.md)");
    return;
  }
  const g = "https://graph.facebook.com/" + V;

  // Page basics + the connected Instagram business account id
  try {
    const page = await get(
      g + "/" + FB_PAGE_ID +
      "?fields=name,followers_count,fan_count,instagram_business_account" +
      "&access_token=" + META_TOKEN,
      "facebook page"
    );
    out.facebook = { name: page.name, followers: page.followers_count, likes: page.fan_count };
    out._igId = page.instagram_business_account ? page.instagram_business_account.id : null;
  } catch (e) { fail("facebook page", e); }

  // Page daily insights (metric names shift between Graph versions; each is optional)
  if (out.facebook) {
    try {
      const ins = await get(
        g + "/" + FB_PAGE_ID + "/insights" +
        "?metric=page_video_views,page_post_engagements,page_follows" +
        "&period=day&since=" + since + "&until=" + until +
        "&access_token=" + META_TOKEN,
        "facebook insights"
      );
      out.facebook.daily = {};
      for (const m of ins.data || []) {
        out.facebook.daily[m.name] = (m.values || []).map(v => ({ date: v.end_time.slice(0, 10), value: v.value }));
      }
    } catch (e) { fail("facebook insights", e); }

    try {
      const posts = await get(
        g + "/" + FB_PAGE_ID + "/posts" +
        "?fields=message,created_time,shares,comments.summary(true),reactions.summary(true)" +
        "&since=" + since + "&limit=25&access_token=" + META_TOKEN,
        "facebook posts"
      );
      out.facebook.posts = (posts.data || []).map(p => ({
        created: p.created_time,
        text: (p.message || "").slice(0, 300),
        reactions: p.reactions && p.reactions.summary ? p.reactions.summary.total_count : 0,
        comments: p.comments && p.comments.summary ? p.comments.summary.total_count : 0,
        shares: p.shares ? p.shares.count : 0
      }));
    } catch (e) { fail("facebook posts", e); }
  }

  // Instagram business account
  if (out._igId) {
    const ig = out._igId;
    try {
      const acct = await get(
        g + "/" + ig + "?fields=username,followers_count,media_count&access_token=" + META_TOKEN,
        "instagram account"
      );
      out.instagram = { username: acct.username, followers: acct.followers_count, mediaCount: acct.media_count };
    } catch (e) { fail("instagram account", e); }

    if (out.instagram) {
      try {
        const ins = await get(
          g + "/" + ig + "/insights?metric=reach,follower_count&period=day" +
          "&since=" + since + "&until=" + until + "&access_token=" + META_TOKEN,
          "instagram daily insights"
        );
        out.instagram.daily = {};
        for (const m of ins.data || []) {
          out.instagram.daily[m.name] = (m.values || []).map(v => ({ date: v.end_time.slice(0, 10), value: v.value }));
        }
      } catch (e) { fail("instagram daily insights", e); }

      try {
        const tot = await get(
          g + "/" + ig + "/insights?metric=views,total_interactions,accounts_engaged" +
          "&metric_type=total_value&period=day" +
          "&since=" + since + "&until=" + until + "&access_token=" + META_TOKEN,
          "instagram totals"
        );
        out.instagram.totals = {};
        for (const m of tot.data || []) {
          out.instagram.totals[m.name] = m.total_value ? m.total_value.value : null;
        }
      } catch (e) { fail("instagram totals", e); }

      try {
        const media = await get(
          g + "/" + ig + "/media" +
          "?fields=caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink" +
          "&since=" + since + "&limit=15&access_token=" + META_TOKEN,
          "instagram media"
        );
        out.instagram.media = [];
        for (const m of media.data || []) {
          const item = {
            created: m.timestamp,
            type: m.media_product_type || m.media_type,
            text: (m.caption || "").slice(0, 300),
            likes: m.like_count,
            comments: m.comments_count,
            url: m.permalink
          };
          try {
            const mi = await get(
              g + "/" + m.id + "/insights?metric=views,reach,likes,comments,saved,shares,total_interactions" +
              "&access_token=" + META_TOKEN,
              "instagram media insights"
            );
            for (const met of mi.data || []) {
              item[met.name] = met.values && met.values[0] ? met.values[0].value : null;
            }
          } catch (e) { /* per-media metric sets vary by type; keep basics */ }
          out.instagram.media.push(item);
        }
      } catch (e) { fail("instagram media", e); }
    }
  } else if (out.facebook) {
    out.errors.push("instagram — no Instagram business account linked to the Facebook Page token");
  }
}

/* ---------- Threads ---------- */
async function fetchThreads() {
  if (!THREADS_TOKEN) {
    out.errors.push("threads — THREADS_ACCESS_TOKEN not set (see dashboard/SETUP.md)");
    return;
  }
  const t = "https://graph.threads.net/v1.0";
  try {
    const me = await get(t + "/me?fields=id,username&access_token=" + THREADS_TOKEN, "threads account");
    out.threads = { username: me.username };

    try {
      const ins = await get(
        t + "/me/threads_insights?metric=views,likes,replies,reposts,quotes,followers_count" +
        "&since=" + since + "&until=" + until + "&access_token=" + THREADS_TOKEN,
        "threads insights"
      );
      out.threads.insights = {};
      for (const m of ins.data || []) {
        if (m.total_value) { out.threads.insights[m.name] = m.total_value.value; }
        else if (m.values) { out.threads.insights[m.name] = m.values.map(v => ({ date: (v.end_time || "").slice(0, 10), value: v.value })); }
      }
    } catch (e) { fail("threads insights", e); }

    try {
      const posts = await get(
        t + "/me/threads?fields=text,timestamp,permalink&since=" + since + "&limit=20&access_token=" + THREADS_TOKEN,
        "threads posts"
      );
      out.threads.posts = [];
      for (const p of posts.data || []) {
        const item = { created: p.timestamp, text: (p.text || "").slice(0, 300), url: p.permalink };
        try {
          const pi = await get(
            t + "/" + p.id + "/insights?metric=views,likes,replies,reposts,quotes,shares&access_token=" + THREADS_TOKEN,
            "threads post insights"
          );
          for (const met of pi.data || []) {
            item[met.name] = met.values && met.values[0] ? met.values[0].value : null;
          }
        } catch (e) { /* keep basics */ }
        out.threads.posts.push(item);
      }
    } catch (e) { fail("threads posts", e); }
  } catch (e) { fail("threads account", e); }
}

/* ---------- YouTube (public stats, API key only) ---------- */
async function fetchYouTube() {
  if (!YT_KEY) {
    out.errors.push("youtube — YOUTUBE_API_KEY not set (see dashboard/SETUP.md)");
    return;
  }
  const y = "https://www.googleapis.com/youtube/v3";
  try {
    const ch = await get(
      y + "/channels?part=statistics,snippet&id=" + YT_CHANNEL + "&key=" + YT_KEY,
      "youtube channel"
    );
    const c = ch.items && ch.items[0];
    if (!c) { throw new Error("channel not found"); }
    out.youtube = {
      title: c.snippet.title,
      subscribers: Number(c.statistics.subscriberCount),
      totalViews: Number(c.statistics.viewCount),
      videoCount: Number(c.statistics.videoCount)
    };
    // recent uploads: swap UC -> UU for the uploads playlist
    const uploads = YT_CHANNEL.replace(/^UC/, "UU");
    try {
      const pl = await get(
        y + "/playlistItems?part=snippet&playlistId=" + uploads + "&maxResults=10&key=" + YT_KEY,
        "youtube uploads"
      );
      const recent = (pl.items || []).filter(i => i.snippet.publishedAt >= sinceISO);
      if (recent.length) {
        const ids = recent.map(i => i.snippet.resourceId.videoId).join(",");
        const vids = await get(y + "/videos?part=statistics,snippet&id=" + ids + "&key=" + YT_KEY, "youtube videos");
        out.youtube.videos = (vids.items || []).map(v => ({
          created: v.snippet.publishedAt,
          title: v.snippet.title,
          views: Number(v.statistics.viewCount || 0),
          likes: Number(v.statistics.likeCount || 0),
          comments: Number(v.statistics.commentCount || 0)
        }));
      } else {
        out.youtube.videos = [];
      }
    } catch (e) { fail("youtube uploads", e); }
  } catch (e) { fail("youtube channel", e); }
}

/* ---------- main ---------- */
(async function main() {
  await Promise.all([fetchMeta(), fetchThreads(), fetchYouTube()]);
  delete out._igId;

  const dir = path.join(__dirname, "data");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "latest.json");
  fs.writeFileSync(file, JSON.stringify(out, null, 2));

  const sections = ["facebook", "instagram", "threads", "youtube"].filter(k => out[k]);
  console.log("Wrote " + file);
  console.log("Sections fetched: " + (sections.join(", ") || "none"));
  if (out.errors.length) {
    console.log("Issues:");
    for (const e of out.errors) { console.log("  - " + e); }
  }
  process.exit(sections.length ? 0 : 1);
})();
