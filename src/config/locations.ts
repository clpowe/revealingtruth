import type { Item } from "../components/ListA/ListA.astro";

export const locations: Item[] = [
  {
    index: "tp",
    title: "Tampa",
    href: "#",
    metadata: {
      time: "Sun 9:00 & 11:00AM",
      location: "5201 N. Armenia Ave. Tampa, FL 33603",
      phone: "(813) 354-1135",
    },
  },
  {
    index: "wc",
    title: "Wesley Chapel",
    href: "#",
    metadata: {
      time: "Sun 9:00AM",
      location: "2644 Cypress Ridge Blvd, Wesley Chapel, FL 33544",
      phone: "(813) 354-1135",
    },
  },
  {
    index: "sp",
    title: "St. Petersburg",
    href: "#",
    metadata: {
      time: "Sun 11:00AM",
      location: "Contact Us For Park Locations",
      phone: "(813) 354-1135",
    },
  },
];
