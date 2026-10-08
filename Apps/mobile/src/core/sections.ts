/** Every section of the app, for the home page and «المزيد». */
import type { Href } from "expo-router";
import {
  AlarmClock,
  BookHeart,
  BookMarked,
  BookOpen,
  CalendarDays,
  CircleDot,
  Clock,
  Compass,
  FileDown,
  HandHeart,
  HardDriveDownload,
  Headphones,
  Image as ImageIcon,
  ListChecks,
  MoonStar,
  Radio,
  Search,
  Sparkles,
  UsersRound,
  ScrollText,
  Wheat,
  type LucideIcon,
} from "@/components/icons";

export type Section = { id: string; title: string; note: string; icon: LucideIcon; href: Href };

export const SECTIONS: Section[] = [
  { id: "prayer", title: "المواقيت", note: "مواقيت الصلاة وتنبيه الأذان", icon: Clock, href: "/prayer" },
  { id: "quran", title: "المصحف", note: "مصحف المدينة صفحة صفحة", icon: BookOpen, href: "/quran" },
  { id: "azkar", title: "الأذكار", note: "حصن المسلم بعدّاد", icon: HandHeart, href: "/azkar" },
  { id: "tasbeeh", title: "السبحة", note: "عدّاد التسبيح", icon: CircleDot, href: "/tasbeeh" },
  { id: "reminders", title: "التذكيرات", note: "الذكر، والكهف، ومنبّه القرآن، والمناسبات", icon: AlarmClock, href: "/reminders" },
  { id: "salat", title: "سجل الصلوات", note: "صلواتك في وقتها وأيامك المتتالية", icon: ListChecks, href: "/salat" },
  { id: "qibla", title: "القبلة", note: "اتجاه القبلة بالبوصلة", icon: Compass, href: "/qibla" },
  { id: "hijri", title: "التقويم", note: "التاريخ الهجري والمناسبات", icon: CalendarDays, href: "/hijri" },
  { id: "khatma", title: "ختمتي", note: "وردك اليومي من المصحف", icon: BookMarked, href: "/khatma" },
  { id: "k", title: "ختمة جماعية", note: "ختمة مع أهلك، وصدقة جارية عن متوفى", icon: UsersRound, href: "/k" },
  { id: "dua-poster", title: "بوستر دعاء", note: "دعاء للمتوفى باسمه صورةً", icon: ImageIcon, href: "/dua-poster" },
  { id: "ramadan", title: "رمضان", note: "الإفطار والسحور وختمة الشهر", icon: MoonStar, href: "/ramadan" },
  { id: "sunnah", title: "السنة", note: "الكتب التسعة وشرح الأحاديث", icon: ScrollText, href: "/sunnah" },
  { id: "recap", title: "حصادي", note: "ما قرأت وسبّحت وصلّيت في الشهر والعام", icon: Wheat, href: "/recap" },
  { id: "asma", title: "أسماء الله الحسنى", note: "الأسماء التسعة والتسعون وصورها", icon: Sparkles, href: "/asma" },
  { id: "listen", title: "الاستماع", note: "المقترح الآن، وورد الاستماع، والمفضّلة", icon: Sparkles, href: "/listen" },
  { id: "recitations", title: "التلاوات", note: "سور كاملة بأصوات القرّاء", icon: Headphones, href: "/recitations" },
  { id: "downloads", title: "التنزيلات", note: "تلاوات محفوظة للاستماع بلا إنترنت", icon: HardDriveDownload, href: "/downloads" },
  { id: "radio", title: "الإذاعات", note: "إذاعات القرآن مباشرة", icon: Radio, href: "/radio" },
  { id: "quran-duas", title: "أدعية القرآن", note: "«ربنا» وأدعية الأنبياء", icon: BookHeart, href: "/quran-duas" },
  { id: "search", title: "البحث", note: "ابحث في القرآن", icon: Search, href: "/search" },
  { id: "pdf", title: "تحميل PDF", note: "المصحف وأجزاؤه وكتيّب الأذكار", icon: FileDown, href: "/pdf" },
];

export const sectionById = (id: string) => SECTIONS.find((s) => s.id === id);
