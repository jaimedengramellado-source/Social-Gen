import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadSans } from "@remotion/google-fonts/Inter";

const serif = loadSerif("normal", { weights: ["400"], subsets: ["latin"] });
const sans = loadSans("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const fontFamilySerif = serif.fontFamily;
export const fontFamilySans = sans.fontFamily;

export const waitForFonts = () =>
  Promise.all([serif.waitUntilDone(), sans.waitUntilDone()]);
