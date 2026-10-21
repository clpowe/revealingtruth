# Hero video

The hero plays ordinary MP4 files from the `revealingtruth-media` R2 bucket.
Its existing styling and priority image are unchanged. The browser selects a
720p rendition on viewports up to 767px and a 1080p rendition otherwise, once
per page load. It never switches downloads when the viewport resizes.

Current public preview origin:
`https://pub-67c32fbe2c6e4b858c94913f928e6e5f.r2.dev`.
The bucket's development URL is enabled for these public media files.

## Encode and upload

FFmpeg and FFprobe are required. Encode from the original 1080p source:

```sh
bash scripts/encode-hero.sh /path/to/hero.mp4 /tmp/hero-encoded
pnpm exec wrangler r2 object put revealingtruth-media/hero/hero-desktop-v1.mp4 --remote --file /tmp/hero-encoded/hero-desktop-v1.mp4 --content-type video/mp4 --cache-control 'public, max-age=31536000, immutable'
pnpm exec wrangler r2 object put revealingtruth-media/hero/hero-mobile-v1.mp4 --remote --file /tmp/hero-encoded/hero-mobile-v1.mp4 --content-type video/mp4 --cache-control 'public, max-age=31536000, immutable'
```

Use new versioned filenames when changing video content, and update
`src/config/hero-video.ts`; do not overwrite files cached as immutable.
The exports contain no audio and use MP4 faststart for progressive playback.
Review compression quality before publishing a different source.

## Configure playback

Copy `.env.example` to `.env` and set `PUBLIC_HERO_VIDEO_BASE_URL` to the media
origin. This is a public build-time setting; restart development or rebuild
after changing it. Without it, the hero renders only its existing image.

The bucket must permit public reads for the browser to play these videos.
For previews, its public `r2.dev` URL can be enabled. That endpoint is rate
limited and has no Cloudflare CDN cache. Before launch, attach a custom domain
to the bucket, configure caching, and replace the environment value with that
domain. Disable the development URL when it is no longer needed.

No Worker proxy or R2 binding is needed: the browser requests the files
directly. Ordinary video playback does not require cross-origin credentials.

## Playback behavior

- Video URLs are held in `data-src` until initial page loading finishes and
  the hero is visible, so the priority image loads first.
- Reduced motion and Save-Data leave the image visible without starting video.
- Native looping reuses buffered frames, with no end-of-loop reload.
- Scrolling away or hiding the tab pauses playback; returning resumes unless
  the visitor manually paused or autoplay was denied.
- The existing button offers Play when autoplay is denied. Media failures
  return to the image and hide the unusable control.

References: [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/),
[R2 uploads](https://developers.cloudflare.com/r2/objects/upload-objects/).
