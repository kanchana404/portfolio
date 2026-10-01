# content/inbox

Image uploads for a blog post wait here, on the post's pull request branch,
until the blog-images Action (`.github/workflows/blog-images.yml`) converts
them.

1. Make the image in the ChatGPT app. Save it to Files and rename it there
   (Photos cannot name a file, and GitHub's upload cannot rename one). Use
   PNG: a JPEG works only if it is stored upright, and a phone photo usually
   is not.
2. **Put the image's line in the post first**, named as the upload will be:
   `1-agents.png` becomes `public/blog/<slug>/1-agents.webp`, shown with
   `![Alt text](/blog/<slug>/1-agents.webp)` (or used as the post's
   `cover`). Other names are lowercased and every run of other characters
   becomes one hyphen (`My Image.PNG` becomes `my-image.webp`). The Action
   converts nothing while any upload has no line; its run summary lists the
   lines to paste.
3. On github.com, open the pull request, tap its branch name to switch to
   that branch, open this folder, and use Add file > Upload files. An upload
   here belongs to the one post the pull request adds or changes. For a pull
   request with several posts, put it in `content/inbox/<slug>/` instead,
   where `<slug>` is the post's file name without `.md` (for example
   `ai-dev-news-2026-w40`).
4. The Action converts every upload to WebP (at most 1600 px wide, no
   metadata, at most 400 KiB), runs the tests, commits the WebP files to the
   branch and deletes the uploads.

Nothing but this README may reach `main`: the publish gate
(`src/lib/blog/validate.ts`) fails while any upload is still here, so a pull
request's checks stay red until the Action has run. docs/weekly-digest.md has
the whole routine.
