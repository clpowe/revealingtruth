import { seo } from "./seo";

// Home page JSON-LD (schema.org). One graph: the organization, its campuses,
// the website and the home page, linked together by @id.
const siteURL = "https://www.revealingtruth.org/";
const id = (fragment: string) => `${siteURL}#${fragment}`;

const tampaAddress = {
  "@type": "PostalAddress",
  streetAddress: "5201 N Armenia Ave",
  addressLocality: "Tampa",
  addressRegion: "FL",
  postalCode: "33603",
  addressCountry: "US",
};

const telephone = seo.telephone;

export const homeStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ReligiousOrganization",
      "@id": id("organization"),
      name: seo.siteName,
      alternateName: "Revealing Truth Ministries",
      url: siteURL,
      description:
        "Revealing Truth Church is a Christian ministry where lives are changed, communities are impacted, and Christ is put on display through the simple truth of God's Word.",
      logo: {
        "@type": "ImageObject",
        "@id": id("logo"),
        url: new URL(seo.logo, siteURL).href,
      },
      telephone,
      address: tampaAddress,
      founder: {
        "@type": "Person",
        name: "Greg Powe",
      },
      contactPoint: {
        "@type": "ContactPoint",
        telephone,
        contactType: "general inquiries",
        availableLanguage: "English",
      },
      sameAs: Object.values(seo.social),
      location: [
        { "@id": id("tampa-campus") },
        { "@id": id("wesley-chapel-campus") },
      ],
    },
    {
      "@type": "Church",
      "@id": id("tampa-campus"),
      name: "Revealing Truth Church - Main Campus",
      description:
        "In-person and virtual Sunday services at 9:00 AM and 11:00 AM; Wednesday virtual service at 7:00 PM.",
      address: tampaAddress,
      telephone,
    },
    {
      "@type": "Church",
      "@id": id("wesley-chapel-campus"),
      name: "Revealing Truth Church - Wesley Chapel Extended Campus",
      description: "In-person Sunday service at 9:00 AM.",
      address: {
        "@type": "PostalAddress",
        streetAddress: "2644 Cypress Ridge Blvd",
        addressLocality: "Wesley Chapel",
        addressRegion: "FL",
        postalCode: "33544",
        addressCountry: "US",
      },
    },
    {
      "@type": "WebSite",
      "@id": id("website"),
      url: siteURL,
      name: seo.siteName,
      publisher: { "@id": id("organization") },
      inLanguage: "en-US",
    },
    {
      "@type": "WebPage",
      "@id": id("webpage"),
      url: siteURL,
      // Matches the home page <title> and meta description
      name: seo.siteName,
      description: seo.defaultDescription,
      isPartOf: { "@id": id("website") },
      mainEntity: { "@id": id("organization") },
      inLanguage: "en-US",
    },
  ],
};
