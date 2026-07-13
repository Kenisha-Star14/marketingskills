# One-time setup: connect your accounts directly (no Metricool)

After this setup, the dashboard pulls your analytics straight from Meta and
Google's free APIs. Total time: about 30 minutes. You only do this once
(plus one small renewal for Threads every ~60 days — Claude will remind you).

You will end up with **three values**. Give them to Claude in chat and Claude
will verify each one works, then help you store them as environment variables
in your Claude Code environment settings:

| Environment variable | What it is |
|---|---|
| `META_PAGE_TOKEN` | Facebook Page token (covers Facebook **and** Instagram) |
| `THREADS_ACCESS_TOKEN` | Threads token |
| `YOUTUBE_API_KEY` | Google API key |

---

## Part 1 — Meta token (Instagram + Facebook) · ~15 min

1. Go to **developers.facebook.com** and log in with the same Facebook account
   that manages The WELL Co. page. Accept the developer terms if asked.
2. Click **My Apps → Create App**. Choose **"Other" → "Business"** as the type.
   Name it anything (e.g. "WELL Co Dashboard"). No review or publishing needed —
   the app is private to you.
3. Open **Tools → Graph API Explorer** (developers.facebook.com/tools/explorer).
4. On the right side:
   - **Meta App:** select the app you just created.
   - **User or Page:** select **Get User Access Token**.
   - **Permissions:** add these five —
     `pages_show_list`, `pages_read_engagement`, `read_insights`,
     `instagram_basic`, `instagram_manage_insights`.
5. Click **Generate Access Token**. A Facebook popup asks which Page and
   Instagram account to allow — pick **The WELL Co.** page and
   **@thewellco.lab**, and approve.
6. Copy the token from the Explorer box.
7. Also grab the app's **App ID** and **App Secret** from
   **App settings → Basic** in your app dashboard.
8. **Paste all three to Claude** (token, App ID, App Secret). Claude exchanges
   them for a permanent Page token, confirms Instagram data flows, and tells
   you exactly what to save as `META_PAGE_TOKEN`.

> Why the exchange step: the Explorer token expires in about an hour, but it
> can be converted into a Page token that does not expire. Claude does that
> conversion for you.

## Part 2 — Threads token · ~10 min

1. In the same app dashboard, click **Add use case** (or "Add product") and add
   **Threads API** (you may be asked to create a separate Threads app — that's
   fine, same steps).
2. Under the Threads use case settings, add the permissions `threads_basic`
   and `threads_manage_insights`.
3. Open **Tools → Graph API Explorer** again, select the Threads app, choose
   **Threads** as the token type, generate the token, and approve
   **@kenisha.walker8** in the popup.
4. **Paste the token to Claude.** Claude converts it to a long-lived token
   (~60 days) and confirms it works. Save the result as
   `THREADS_ACCESS_TOKEN`.

> Threads tokens can't be made permanent. The daily refresh renews it
> automatically while it's valid and warns you in the morning summary about a
> week before a manual re-login is needed.

## Part 3 — YouTube API key · ~5 min

1. Go to **console.cloud.google.com** and log in with the Google account that
   owns your YouTube channel.
2. Create a project (top bar → New Project, any name).
3. Search for **"YouTube Data API v3"** in the top search bar → **Enable**.
4. Go to **APIs & Services → Credentials → Create credentials → API key**.
5. Copy the key and **paste it to Claude**. Save it as `YOUTUBE_API_KEY`.

## Storing the values

In Claude Code on the web: open your **environment settings** and add the
three variables above. They're stored privately with your environment and are
available to the daily refresh — they are never committed to the repository.

## What's covered afterwards

| Platform | Source | Status |
|---|---|---|
| Instagram | Meta Graph API | full daily metrics + per-post insights |
| Facebook | Meta Graph API | page metrics + posts |
| Threads | Threads API | account + per-post insights |
| YouTube | YouTube Data API | channel stats + per-video stats |
| TikTok | — | not available without a middleman; TikTok's developer API requires an approval process. Check TikTok's in-app analytics, or ask Claude to apply for TikTok developer access later. |
| X (Twitter) | — | analytics API is paid-only; account is dormant |

## Testing

Ask Claude to run `node dashboard/fetch-data.js` — it prints which sections
fetched successfully and lists anything still missing.
