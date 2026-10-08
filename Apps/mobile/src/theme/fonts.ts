/** The site's face (IBM Plex Sans Arabic, src/app/layout.tsx), one family per weight: Android won't synthesize weights of a custom font. */
import { AmiriQuran_400Regular } from "@expo-google-fonts/amiri-quran/400Regular";
import { IBMPlexSansArabic_400Regular } from "@expo-google-fonts/ibm-plex-sans-arabic/400Regular";
import { IBMPlexSansArabic_500Medium } from "@expo-google-fonts/ibm-plex-sans-arabic/500Medium";
import { IBMPlexSansArabic_600SemiBold } from "@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold";
import { IBMPlexSansArabic_700Bold } from "@expo-google-fonts/ibm-plex-sans-arabic/700Bold";

export const FONT_FILES = {
  "Plex-Regular": IBMPlexSansArabic_400Regular,
  "Plex-Medium": IBMPlexSansArabic_500Medium,
  "Plex-SemiBold": IBMPlexSansArabic_600SemiBold,
  "Plex-Bold": IBMPlexSansArabic_700Bold,
  // Quran text outside the mushaf pages (search results, the ayah panel), as the site's .quran-text.
  "Amiri-Quran": AmiriQuran_400Regular,
};

export const QURAN_FONT = "Amiri-Quran";

export type Weight = "regular" | "medium" | "semibold" | "bold";

export const FAMILY: Record<Weight, keyof typeof FONT_FILES> = {
  regular: "Plex-Regular",
  medium: "Plex-Medium",
  semibold: "Plex-SemiBold",
  bold: "Plex-Bold",
};
