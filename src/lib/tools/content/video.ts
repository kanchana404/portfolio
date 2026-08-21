import type { ToolDef } from "../types";

/** Subtitle and video tools. */
export const VIDEO_TOOLS: readonly ToolDef[] = [
  {
    slug: "srt-to-vtt",
    title: "SRT to VTT Converter",
    metaTitle: "SRT to VTT Converter (and VTT to SRT)",
    description:
      "Convert subtitles between SRT and WebVTT, fix a line, or shift the " +
      "timing, without uploading the file. Adds the header players require.",
    category: "video",
    audience: ["general", "developers"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-17",
    updatedAt: "2026-08-17",
    keywords: [
      "srt to vtt",
      "vtt to srt",
      "subtitle converter",
      "convert srt to webvtt",
      "subtitle timing shift",
      "srt converter online",
    ],
    intro:
      "Drop in an SRT or WebVTT file and get the other format back. Every line " +
      "stays editable, timing can be shifted at the same time, and the file " +
      "never leaves your browser.",
    howToUse: [
      "Drop your .srt or .vtt file in, or paste its contents.",
      "The format you gave it is detected, and the other one is preselected.",
      "Search a word to jump to that line. It lands selected, so typing replaces it.",
      "To fix subtitles that run early or late, set a shift in seconds. Negative moves them earlier.",
      "Copy the result, or download it with the right extension.",
    ],
    faqs: [
      {
        q: "Why doesn't my VTT file work in a browser video player?",
        a: "Almost always a missing WEBVTT header. The format requires that exact word on the first line, and a converter that only swaps commas for dots leaves it out. Nothing renders and no error appears.",
      },
      {
        q: "What is the actual difference between SRT and VTT?",
        a: "WebVTT uses a dot before milliseconds, allows an optional hour field, and supports styling and cue identifiers. SRT uses a comma, always writes the hour, and numbers its cues.",
      },
      {
        q: "Can it fix subtitles that are out of sync?",
        a: "Yes, if they are off by a constant amount. Set the shift in seconds and every cue moves together. Subtitles that drift further out as the video plays are a frame-rate mismatch and need rescaling instead.",
      },
      {
        q: "Can I fix a typo without opening another editor?",
        a: "Yes. Every line in the list is editable in place, and searching a word jumps to it with the word selected, so typing replaces it. Your edits are in the file you download.",
      },
      {
        q: "Is my file uploaded anywhere?",
        a: "No. The conversion is JavaScript running on this page, so the file is read by your own browser and no copy is sent to a server.",
      },
    ],
    related: ["word-counter", "text-diff-checker"],
  },

  {
    slug: "video-downloader",
    title: "Video Downloader",
    metaTitle: "Video and Reel Downloader",
    description:
      "Save a video from a public post on nine sites, without an account, a " +
      "watermark or an install. Nothing to sign up for and nothing to fetch.",
    category: "video",
    audience: ["general"],
    // Not "browser": resolving a link needs a server-side extractor. The meta
    // row says so, and `caveats` below is what the validator requires for it.
    compute: "railway",
    // `compute` alone would print "Processed on my server, then deleted", which
    // is true of the PDF tools and not of this one: the finished file is written
    // to object storage so the link works, and lives there for six hours. That
    // difference is the part a reader would most want to know before pasting.
    privacyLine: "Fetched by my server, stored 6 hours, then deleted",
    status: "stable",
    publishedAt: "2026-08-20",
    updatedAt: "2026-08-20",
    keywords: [
      "video downloader",
      "download reels",
      "save video from link",
      "tiktok video download",
      "download without watermark",
    ],
    intro:
      "Paste a link to a public post and pick the quality you want. On X " +
      "and Snapchat your browser takes the file straight from the platform. " +
      "Everywhere else video and audio usually arrive separately, so my " +
      "server joins them for you.",
    howToUse: [
      "Copy the link to one public post. Channels and playlists are refused.",
      "Paste it in and press Get links.",
      "Pick the quality you want. Sizes are shown where the platform reports them.",
      "Press Download and wait. Save appears when the file is ready.",
      "On X and Snapchat you get Open instead, which opens the video on the platform to save from there. Pinterest can give either.",
      "Private, deleted and age-restricted posts cannot be read and will say so.",
    ],
    caveats:
      "This one is different from every other tool here. The link goes to a " +
      "server, the file passes through it for most sites, and downloading a " +
      "video is not always yours to do: most platforms forbid it in their " +
      "terms, and the content belongs to whoever made it. Use it for your own " +
      "uploads, for content you have permission to keep, or where the licence " +
      "allows. The service is rate limited and can be switched off at any time.",
    faqs: [
      {
        q: "Does the file go through this site?",
        a: "For X and Snapchat, no. Your browser fetches from their network and I never see it. Everywhere else it usually does, because they serve video and audio separately. My server joins them, keeps the file six hours, then deletes it.",
      },
      {
        q: "Why is TikTok slower than X?",
        a: "X hands out one finished MP4 your browser can take directly. TikTok, Instagram and Facebook do not, so a server has to fetch the video, fetch the audio, and join them. That wait is the work.",
      },
      {
        q: "Why can it not open a private post?",
        a: "Because there is nothing public to read. The resolver sees exactly what a logged-out visitor sees, and it does not log in as anyone or accept credentials.",
      },
      {
        q: "Is downloading videos legal?",
        a: "It depends on the video and where you are. Most platforms prohibit it in their terms regardless, and copyright belongs to the creator. Your own uploads and permissively licensed material are the safe cases.",
      },
      {
        q: "Why did a link that worked yesterday stop working?",
        a: "Platforms change how their pages are built, often without notice, and every extractor breaks when they do. It usually returns within a few days of the upstream project catching up.",
      },
    ],
    related: ["srt-to-vtt"],
  },
];
