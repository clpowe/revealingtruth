// This public origin must also be available to clean CI builds, which do not
// receive the gitignored local .env. Override it with a cached custom domain
// before launch. An explicitly empty override keeps the image-only option.
const previewOrigin = "https://pub-67c32fbe2c6e4b858c94913f928e6e5f.r2.dev";
const baseUrl = (import.meta.env.PUBLIC_HERO_VIDEO_BASE_URL ?? previewOrigin)
  .trim()
  .replace(/\/+$/, "");

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
