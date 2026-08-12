import type { ToolDef } from "../types";

/**
 * Video downloaders.
 *
 * Unlike everything else in this registry these are `compute: "railway"` — the
 * file genuinely passes through a server. That is not a shortcut: almost every
 * platform publishes video and audio as separate streams, so a single URL handed
 * to a browser is a silent clip. Muxing needs ffmpeg, ffmpeg needs a worker.
 *
 * Each `caveats` line says so plainly. A tool that quietly uploads when the rest
 * of the site promises "runs in your browser" would make the site's most
 * load-bearing claim untrue, and a visitor can check it in devtools in seconds.
 */
export const VIDEO_TOOLS: readonly ToolDef[] = [
  {
    slug: "tiktok-video-downloader",
    title: "TikTok Video Downloader",
    metaTitle: "TikTok Video Downloader",
    description:
      "Save any public TikTok as an MP4 with the sound intact. No watermark " +
      "overlay added, no signup, no app install, and nothing kept afterwards.",
    category: "video",
    audience: ["general"],
    compute: "railway",
    status: "stable",
    publishedAt: "2026-08-12",
    updatedAt: "2026-08-12",
    keywords: [
      "tiktok video downloader",
      "download tiktok video",
      "tiktok to mp4",
      "save tiktok video",
      "tiktok downloader no watermark",
    ],
    intro:
      "Paste a TikTok link and get the video back as a normal MP4 file you can " +
      "keep, edit or send on. The audio comes with it, which is the part most " +
      "browser tricks lose.",
    howToUse: [
      "Open the TikTok post and copy its link from the share menu.",
      "Paste it into the box above and press Get video.",
      "Pick a quality. The first one is H.264, which plays on every phone and laptop.",
      "Press Download. Larger clips take a few seconds while the audio is merged in.",
    ],
    caveats:
      "TikTok links expire quickly and the file is fetched by my server, then deleted a few hours later. Private and age-restricted posts cannot be read at all.",
    faqs: [
      {
        q: "Why is the biggest resolution marked as maybe not playing?",
        a: "TikTok serves its highest quality as H.265, which Apple devices handle and many Android phones and Windows players do not. The H.264 option is smaller but plays everywhere, so it is listed first.",
      },
      {
        q: "Does this remove the TikTok watermark?",
        a: "No. Nothing is added by me, but the watermark is burned into the video by TikTok before it is published. Any tool claiming to strip it is either re-encoding and blurring it or lying.",
      },
      {
        q: "Can I download a private or friends-only video?",
        a: "No. The tool only sees what a logged-out visitor sees, which is the correct behaviour. If a post needs an account to view, it needs an account to download.",
      },
      {
        q: "Where does the file go after I download it?",
        a: "It sits on my server for a few hours behind a single-use link, then a lifecycle rule deletes it. I log a hash of the link, never the link itself.",
      },
    ],
    related: ["instagram-video-downloader", "youtube-video-downloader"],
  },
  {
    slug: "youtube-video-downloader",
    title: "YouTube Video Downloader",
    metaTitle: "YouTube Video Downloader",
    description:
      "Grab a YouTube clip as MP4 video or M4A audio. Audio is the default " +
      "because it is a fraction of the size and finishes far quicker.",
    category: "video",
    audience: ["general"],
    compute: "railway",
    status: "stable",
    publishedAt: "2026-08-12",
    updatedAt: "2026-08-12",
    keywords: [
      "youtube video downloader",
      "youtube to mp4",
      "youtube to mp3",
      "download youtube video",
      "youtube audio download",
    ],
    intro:
      "Paste a YouTube link and choose what you actually want: the full video, " +
      "or just the audio track. YouTube splits the two, so either way they are " +
      "recombined server-side before you get the file.",
    howToUse: [
      "Copy the link from the address bar or the Share button.",
      "Paste it above and press Get video.",
      "Choose audio if you only need the sound — it is a fraction of the size.",
      "Press Download and wait. Long videos take longer because the streams are merged.",
    ],
    caveats:
      "YouTube blocks datacentre traffic aggressively, so this fails more often than the other platforms here and there is no way around that from a server.",
    faqs: [
      {
        q: "Why does this fail more often than other downloaders?",
        a: "YouTube actively blocks requests from server IP ranges and rotates how its player works every few weeks. When it fails you get a clear error rather than a silent broken file.",
      },
      {
        q: "Why is audio the default rather than 1080p?",
        a: "An audio track is a few megabytes where 1080p is often several hundred. It is faster for you and dramatically cheaper for me to serve, so it leads.",
      },
      {
        q: "Can I download an age-restricted or members-only video?",
        a: "No. Those need a signed-in account and this tool has none, deliberately. Holding YouTube credentials on a public service is a problem I am not interested in owning.",
      },
      {
        q: "Are playlists supported?",
        a: "No, and that is intentional. One pasted playlist URL could turn into hundreds of downloads, so playlist links are rejected outright. Download videos one at a time.",
      },
    ],
    related: ["tiktok-video-downloader", "loom-video-downloader"],
  },
  {
    slug: "instagram-video-downloader",
    title: "Instagram Video Downloader",
    metaTitle: "Instagram Video Downloader",
    description:
      "Download a public Instagram reel or video post as a playable MP4 file, " +
      "with audio merged back in. Works from a link — no login, no extension.",
    category: "video",
    audience: ["general"],
    compute: "railway",
    status: "stable",
    publishedAt: "2026-08-12",
    updatedAt: "2026-08-12",
    keywords: [
      "instagram video downloader",
      "instagram reel download",
      "download instagram video",
      "instagram to mp4",
      "save instagram reel",
    ],
    intro:
      "Paste a link to a public reel or video post and get an MP4 back. " +
      "Instagram serves picture and sound separately, so they are stitched " +
      "together before the file reaches you.",
    howToUse: [
      "Tap the three dots on the post and choose Copy link.",
      "Paste the link above and press Get video.",
      "Pick a quality from the list that appears.",
      "Press Download. The audio is merged in during this step.",
    ],
    caveats:
      "Only public posts work. Instagram increasingly hides media from logged-out visitors, so some links fail even when the post looks public in your own browser.",
    faqs: [
      {
        q: "Why does a link that works for me fail here?",
        a: "You are probably logged in. Instagram shows far less to a logged-out visitor, and this tool has no account, so anything gated behind a session is invisible to it.",
      },
      {
        q: "Can I download stories or private accounts?",
        a: "No. Stories usually require a session, and private accounts are private. The tool sees exactly what an anonymous visitor sees and nothing more.",
      },
      {
        q: "Does it work with carousels that mix photos and video?",
        a: "It picks up the video in the post. Multi-item carousels are hit and miss right now, and a post with no video at all will report that nothing downloadable was found.",
      },
    ],
    related: ["tiktok-video-downloader", "facebook-video-downloader"],
  },
  {
    slug: "facebook-video-downloader",
    title: "Facebook Video Downloader",
    metaTitle: "Facebook Video Downloader",
    description:
      "Save a public Facebook video or reel to your device as MP4. Paste the " +
      "post link, choose a size, and the sound is merged back in for you.",
    category: "video",
    audience: ["general"],
    compute: "railway",
    status: "stable",
    publishedAt: "2026-08-12",
    updatedAt: "2026-08-12",
    keywords: [
      "facebook video downloader",
      "download facebook video",
      "facebook reel download",
      "fb video to mp4",
      "save facebook video",
    ],
    intro:
      "Paste the link to a public Facebook video or reel and download it as a " +
      "normal MP4. Of the three Meta platforms this one is the most reliable " +
      "for anonymous visitors.",
    howToUse: [
      "Open the video, use the share menu and choose Copy link.",
      "Paste it above and press Get video.",
      "Pick the quality you want from the list.",
      "Press Download and the finished file arrives in your downloads folder.",
    ],
    caveats:
      "Public Page videos and reels work well. Anything posted to friends only, to a private group, or by a personal profile with restricted settings will not resolve.",
    faqs: [
      {
        q: "Which Facebook links actually work?",
        a: "Public Page videos, watch links and reels. Personal posts limited to friends, private group content and anything behind a login will fail, because the tool browses as an anonymous visitor.",
      },
      {
        q: "Why do I sometimes get fewer quality options?",
        a: "Facebook publishes different renditions per video. Short reels often ship one or two sizes where a longer upload might offer several, so the list reflects whatever that post actually has.",
      },
      {
        q: "Is the video re-encoded and made worse?",
        a: "No. The original streams are copied and placed into one MP4 container. Picture and sound are untouched, which is also why it finishes in seconds rather than minutes.",
      },
    ],
    related: ["instagram-video-downloader", "tiktok-video-downloader"],
  },
  {
    slug: "loom-video-downloader",
    title: "Loom Video Downloader",
    metaTitle: "Loom Video Downloader",
    description:
      "Keep a copy of a Loom recording as an MP4 before a share link expires " +
      "or a workspace plan lapses. Works on public share links only.",
    category: "video",
    audience: ["general", "developers"],
    compute: "railway",
    status: "stable",
    publishedAt: "2026-08-12",
    updatedAt: "2026-08-12",
    keywords: [
      "loom video downloader",
      "download loom video",
      "loom to mp4",
      "save loom recording",
      "loom download link",
    ],
    intro:
      "Paste a public Loom share link and get the recording as an MP4. Useful " +
      "for archiving a walkthrough before a free workspace clears it out or a " +
      "share link is turned off.",
    howToUse: [
      "Open the Loom recording and copy its share link.",
      "Paste it above and press Get video.",
      "Pick a resolution — 1080p if the recording is a screen share with small text.",
      "Press Download. Loom always needs merging, so give it a few seconds.",
    ],
    caveats:
      "Public share links only. Recordings restricted to a workspace or to named viewers require a session this tool does not have, and will report an error.",
    faqs: [
      {
        q: "Can I download a private or workspace-only Loom?",
        a: "No. If the link needs you to be signed in or invited, the tool cannot open it either. Only recordings shared as Anyone with the link will resolve.",
      },
      {
        q: "Why does Loom always take longer than TikTok?",
        a: "Loom never publishes a single combined file. Every recording is separate video and audio streams that have to be merged before you get anything playable, and screen recordings are large.",
      },
      {
        q: "Which quality should I pick for a screen recording?",
        a: "The highest available. Screen shares carry small text and interface detail that turns to mush at lower resolutions, and the file size difference is usually modest.",
      },
    ],
    related: ["youtube-video-downloader", "tiktok-video-downloader"],
  },
];
