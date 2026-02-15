// Testimonial data used across marketing surfaces.
export interface Testimonial {
  id: string;
  name: string;
  age: number;
  role: string;
  quote: string;
  initials: string;
  image?: string;
}

// The optional 'image' field allows easy migration to real images:
// 1. Add image files to public/testimonials/ directory
// 2. Update the image field with path: '/testimonials/person-1.jpg'
// 3. Carousel component will automatically use image if present, fallback to initials
export const TESTIMONIALS: Testimonial[] = [
  {
    id: "testimonial-1",
    name: "Margarete S.",
    age: 67,
    role: "Rentnerin",
    quote:
      "Endlich habe ich alle wichtigen Unterlagen beisammen. Meine Tochter kann im Notfall sofort darauf zugreifen. Das gibt mir ein gutes Gefühl.",
    initials: "MS",
  },
  {
    id: "testimonial-2",
    name: "Klaus M.",
    age: 72,
    role: "Rentner",
    quote:
      "Ich war skeptisch wegen der Technik. Aber es ist wirklich einfach. Sogar ich bekomme das hin – und ich bin kein Computer-Experte.",
    initials: "KM",
  },
  {
    id: "testimonial-3",
    name: "Andrea K.",
    age: 45,
    role: "Tochter",
    quote:
      "Für meine Mutter eingerichtet. Sie fühlt sich jetzt sicherer, und ich weiß, wo alles ist. Perfekt für beide Seiten.",
    initials: "AK",
  },
  {
    id: "testimonial-4",
    name: "Helmut B.",
    age: 69,
    role: "Witwer",
    quote:
      "Ich habe endlich Ordnung in meine Unterlagen gebracht. Wenn etwas passiert, findet meine Familie alles sofort. Das nimmt mir viel Stress.",
    initials: "HB",
  },
  {
    id: "testimonial-5",
    name: "Petra W.",
    age: 58,
    role: "Hausfrau",
    quote:
      "Die Bedienung ist leicht und sehr übersichtlich. Meine Kinder sind beruhigt, weil sie wissen, wo alles liegt. Das ist Gold wert.",
    initials: "PW",
  },
  {
    id: "testimonial-6",
    name: "Werner F.",
    age: 73,
    role: "Pensionär",
    quote:
      "Ich fühle mich jetzt sicherer, weil alles an einem Ort ist. Im Notfall kann meine Frau sofort handeln. Das gibt uns beiden Ruhe.",
    initials: "WF",
  },
];
