import type { ImageMetadata } from "astro";
import deborahPowe from "../assets/images/pastordeborahpowe.png";
import bryanAndRashidaPowe from "../assets/images/bryan-rashida-powe.png";
import worship from "../assets/images/media-strip.png";
import baptism from "../assets/images/testimonial.png";
import teaching from "../assets/images/PastorBryan.jpg";
import family from "../assets/images/locations/family.webp";
import aerial from "../assets/images/locations/cypress-ridge.webp";
import waterfront from "../assets/images/locations/waterfront.webp";
import park from "../assets/images/locations/vinoy-park.webp";
import tampaMap from "../assets/images/locations/tampa-map.webp";
import wesleyMap from "../assets/images/locations/wesley-map.webp";

import tampaKeys from "../assets/images/locations/placeholders/tampa-keys.webp";
import tampaRiver from "../assets/images/locations/placeholders/tampa-river.webp";
import tampaCoffee from "../assets/images/locations/placeholders/tampa-coffee.webp";
import tampaRehearsal from "../assets/images/locations/placeholders/tampa-rehearsal.webp";
import wesleyOaks from "../assets/images/locations/placeholders/wesley-oaks.webp";
import wesleyStudy from "../assets/images/locations/placeholders/wesley-study.webp";
import wesleyChairs from "../assets/images/locations/placeholders/wesley-chairs.webp";
import wesleyCypress from "../assets/images/locations/placeholders/wesley-cypress.webp";
import stPeteMarina from "../assets/images/locations/placeholders/st-pete-marina.webp";
import stPetePicnic from "../assets/images/locations/placeholders/st-pete-picnic.webp";
import stPetePalms from "../assets/images/locations/placeholders/st-pete-palms.webp";
import stPeteGuitar from "../assets/images/locations/placeholders/st-pete-guitar.webp";

export interface CampusPastor {
  role: string;
  name: { before: string; accent: string; after?: string };
  bio: string[];
  photo?: { image: ImageMetadata; alt: string };
  milestones?: { value: string; note: string }[];
}

interface CampusPage {
  time: string;
  welcome: { before: string; accent: string; after: string };
  invitation: string;
  noteTitle: string;
  note: string;
  hero: ImageMetadata;
  heroFocus: string;
  heroScale?: number;
  heroGathering: string;
  heroAddress: string;
  map?: ImageMetadata;
  addressLines?: [string, string];
  gatheringLabel?: string;
  gallery: { image: ImageMetadata; caption: string; focus?: string }[];
  pastors: CampusPastor[];
}

export const campusPages: Record<"tp" | "wc" | "sp", CampusPage> = {
  tp: {
    time: "9:00 AM & 11:00 AM",
    welcome: {
      before: "At RTC Tampa, we gather to ",
      accent: "worship,",
      after:
        " get into the Word, and encourage one another as we follow Jesus.",
    },
    invitation:
      "Come on your own, bring the family, or invite someone to sit with you. We’d love to meet you.",
    noteTitle: "Coming with children?",
    note: "Creative Kids serves children ages 6 weeks through 5th grade during both Sunday gatherings. Start in the lobby and we’ll help you find the right check-in desk.",
    hero: worship,
    heroFocus: "78% 15%",
    heroGathering: "Sunday Gatherings · 9:00 AM & 11:00 AM",
    heroAddress: "5201 N. Armenia Avenue, Tampa, FL 33603",
    map: tampaMap,
    addressLines: ["5201 N. Armenia Avenue", "Tampa, FL 33603"],
    gatheringLabel: "Sunday gatherings",
    gallery: [
      { image: worship, focus: "12% 24%", caption: "Sunday worship · 9:00 AM & 11:00 AM" },
      { image: teaching, focus: "50% 22%", caption: "Getting into God’s Word together" },
      { image: baptism, focus: "50% 35%", caption: "Baptism & community celebration" },
      { image: family, caption: "Family at Revealing Truth" },
      { image: tampaKeys, caption: "At the keys" },
      { image: tampaRiver, caption: "Morning on the riverwalk" },
      { image: tampaCoffee, caption: "Coffee at the welcome table" },
      { image: tampaRehearsal, caption: "Before rehearsal" },
    ],
    pastors: [
      {
        role: "co-founder & overseer",
        name: { before: "Pastor", accent: "Deborah", after: "H. Powe" },
        bio: [
          "Pastor Deborah co-founded the church with the late Pastor Greg Powe in 1991. She continues to teach God’s Word and help people understand the depth of His love and grace.",
        ],
        photo: {
          image: deborahPowe,
          alt: "Pastor Deborah H. Powe speaking at a pulpit",
        },
      },
      {
        role: "senior pastors",
        name: { before: "Pastors Bryan & Rashida", accent: "Powe" },
        bio: [
          "Pastors Bryan and Rashida are passionate about helping people know God personally, experience His love, and use the gifts He’s given them to share that love with others.",
        ],
        photo: {
          image: bryanAndRashidaPowe,
          alt: "Pastors Bryan and Rashida Powe",
        },
      },
    ],
  },
  wc: {
    time: "9:00 AM",
    welcome: {
      before: "There’s something special about seeing a ",
      accent: "familiar face",
      after: " on a Sunday morning.",
    },
    invitation:
      "At RTC Wesley Chapel, we’d love to get to know you as we worship together and learn how to put God’s Word into practice throughout the week.",
    noteTitle: "Pastors Benjamin & Greta Smith",
    note: "Pastors Benjamin and Greta look forward to welcoming you. They’ve served the Wesley Chapel community since 2017.",
    hero: baptism,
    heroFocus: "60% 35%",
    heroGathering: "Sunday Gathering · 9:00 AM",
    heroAddress: "2644 Cypress Ridge Blvd, Suite 102, Wesley Chapel, FL 33544",
    map: wesleyMap,
    addressLines: [
      "2644 Cypress Ridge Blvd, Suite 102",
      "Wesley Chapel, FL 33544",
    ],
    gatheringLabel: "Sunday gathering",
    gallery: [
      { image: baptism, focus: "50% 35%", caption: "Baptism at Revealing Truth" },
      {
        image: aerial,
        caption: "Cypress Ridge Boulevard from above · Esri World Imagery",
      },
      { image: teaching, focus: "50% 24%", caption: "Teaching at Revealing Truth" },
      { image: worship, focus: "78% 22%", caption: "Worship at Revealing Truth" },
      { image: wesleyOaks, caption: "A walk beneath the live oaks" },
      { image: wesleyStudy, caption: "A quiet moment in the Word" },
      { image: wesleyChairs, caption: "Getting the room ready" },
      { image: wesleyCypress, caption: "Cypress reflections" },
    ],
    pastors: [
      {
        role: "campus pastors",
        name: { before: "Pastors Benjamin & Greta", accent: "Smith" },
        bio: [
          "Pastors Benjamin and Greta Smith have led RTC Wesley Chapel since 2017. Before becoming campus pastors, they served in several areas of Revealing Truth Church, including leading ministries for children and young people from the nursery through college.",
          "As parents, grandparents, and godparents, the Smiths care deeply about helping families grow stronger. That heart for families continues to shape how they serve the Wesley Chapel community.",
        ],
        milestones: [
          { value: "2017", note: "Leading RTC Wesley Chapel as campus pastors" },
        ],
      },
    ],
  },
  sp: {
    time: "11:00 AM",
    welcome: {
      before:
        "Led by Pastors Lamar and Yeneka Mills, RTC St. Petersburg gathers in ",
      accent: "St. Petersburg",
      after: " and the surrounding area.",
    },
    invitation:
      "Come worship with us, get into God’s Word, and get to know the people you’ll be doing life with. We’d love to see you there!",
    noteTitle: "How Sunday locations work",
    note: "Our St. Petersburg campus meets at local community and park spaces across the city. Email info@revealingtruth.org and we’ll share this Sunday’s exact location.",
    hero: waterfront,
    heroFocus: "50% 50%",
    heroScale: 1.07,
    heroGathering: "Sunday Gathering · 11:00 AM",
    heroAddress: "Meeting Location · Varies by week",
    gallery: [
      {
        image: waterfront,
        caption:
          "Downtown waterfront · Rishabh Tatiraju · CC BY-SA 4.0 · cropped",
      },
      { image: baptism, focus: "50% 35%", caption: "Baptism at Revealing Truth" },
      {
        image: park,
        caption: "Vinoy Park · Calmuziclover · CC BY 2.0 · cropped",
      },
      { image: worship, focus: "18% 24%", caption: "Worship at Revealing Truth" },
      { image: stPeteMarina, caption: "Morning at the marina" },
      { image: stPetePicnic, caption: "Lunch in the park" },
      { image: stPetePalms, caption: "Palms along the waterfront" },
      { image: stPeteGuitar, caption: "Acoustic guitar in the park" },
    ],
    pastors: [
      {
        role: "campus pastors",
        name: { before: "Pastors Lamar & Yeneka", accent: "Mills" },
        bio: [
          "Pastors Lamar and Yeneka Mills have served as the St. Petersburg Campus Pastors of Revealing Truth Church since 2017. They love teaching God’s Word in a way people can understand and put into practice.",
          "Pastor Lamar grew up in St. Petersburg and graduated from Lakewood High School. Both pastors joined the church in 2005 and served in prayer, new member orientation, and youth ministry. Since the campus relaunched, they’ve partnered with day care centers and elementary schools to serve local children and families.",
        ],
        milestones: [
          {
            value: "2005",
            note: "Joined RTC and served in prayer, orientation, and youth ministry",
          },
          { value: "2017", note: "Became St. Petersburg campus pastors" },
        ],
      },
    ],
  },
};
