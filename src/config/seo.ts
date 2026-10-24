import type { ImageMetadata } from "astro";
import defaultImage from "../assets/images/testimonial.png";

// Site-wide SEO defaults. Pages override title, description and image
// through BaseLayout props; everything else stays fixed here.
export const seo = {
  siteName: "Revealing Truth Church",
  titleSeparator: " — ",
  // Keep near 150–160 characters
  defaultDescription:
    "Revealing Truth Church gathers in Tampa, Wesley Chapel and St. Petersburg. Join us Sunday for worship, Bible teaching and a church family to grow with.",
  // Swap for a dedicated 1200×630 share image before launch
  defaultImage: defaultImage as ImageMetadata | string,
  defaultImageAlt: "Revealing Truth Church",
  themeColor: "#c8d500",
  locale: "en_US",
  // Files served from /public
  favicons: {
    svgLight: "/favicon-light.svg",
    svgDark: "/favicon-dark.svg",
    ico: "/favicon.ico",
    appleTouch: "/apple-touch-icon.png",
  },
};
