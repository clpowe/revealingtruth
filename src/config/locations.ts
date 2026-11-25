import type { Item } from "../components/ListA/ListA.astro";

export const locations = [
  {
    index: "tp" as const,
    title: "Tampa",
    href: "/locations/tampa",
    metadata: {
      time: "Sun 9:00 & 11:00AM",
      location: "5201 N. Armenia Ave. Tampa, FL 33603",
      phone: "(813) 354-1135",
    },
  },
  {
    index: "wc" as const,
    title: "Wesley Chapel",
    href: "/locations/wesley-chapel",
    metadata: {
      time: "Sun 9:00AM",
      location: "2644 Cypress Ridge Blvd, Suite 102, Wesley Chapel, FL 33544",
      phone: "(813) 354-1135",
    },
  },
  {
    index: "sp" as const,
    title: "St. Petersburg",
    href: "/locations/st-petersburg",
    metadata: {
      time: "Sun 11:00AM",
      location: "Meeting location varies by week",
      phone: "(813) 354-1135",
    },
  },
] satisfies Item[];
