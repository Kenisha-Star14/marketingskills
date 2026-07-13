# Social Media Analytics Dashboard

A Metricool-style analytics dashboard for **The WELL Co.**, generated from live
Metricool data across all six connected platforms: Instagram, TikTok, Facebook,
Threads, X (Twitter), and YouTube.

- **Live dashboard:** https://claude.ai/code/artifact/e8508d46-de95-498d-8caa-a1ca1a7dc37f
- **Source file:** `social-analytics-dashboard.html` (self-contained — no external dependencies)

## What it shows

- **KPI row** — total audience, weekly views, interactions, and posts, each with a
  week-over-week comparison (this week = last 7 full days vs the prior 7).
- **Platform scorecards** — follower count, 14-day follower sparkline, and a status
  chip (Surging / Engagement dip / Flat / Dormant) per platform.
- **Daily trend charts** — views per day and interactions per day, with hover
  tooltips and table views.
- **Content leaderboard** — top and bottom posts compared across platforms, since
  the same video is cross-posted to Instagram, TikTok, and Facebook.
- **Recommendations** — "what to do next" per platform, written from the actual
  numbers each refresh.

## How it stays current

- **Daily auto-refresh:** a scheduled routine (7:00 AM Pacific) re-pulls Metricool
  data, regenerates the numbers, republishes the artifact at the same URL, and
  pushes the updated file to this branch.
- **On demand:** ask Claude to "refresh my social dashboard" at any time.

## Data source

Metricool MCP, brand "The WELL Co." (brandId 6436168, timezone
America/Los_Angeles). Engagement figures are interactions per 100 people reached
(the brand's configured engagement ratio). Data window is a rolling 14 days.
