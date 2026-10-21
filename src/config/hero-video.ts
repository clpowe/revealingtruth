// Build-time URL: use the R2 development URL for previews, then a cached
// custom domain for production. An unset URL keeps the image fallback.
const baseUrl = import.meta.env.PUBLIC_HERO_VIDEO_BASE_URL?.trim().replace(
  /\/+$/,
  "",
);

export const heroVideo = baseUrl
  ? [
      {
        src: `${baseUrl}/hero/hero-mobile-v1.mp4`,
        type: "video/mp4",
        media: "(max-width: 767px)",
      },
      {
        src: `${baseUrl}/hero/hero-desktop-v1.mp4`,
        type: "video/mp4",
      },
    ]
  : undefined;
