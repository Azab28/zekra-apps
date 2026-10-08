// Client-safe: occasion names and when each posts (the rules are in schedule/occasion-days.ts).
import type { OccasionKind } from "./types";

export const OCCASIONS: Record<OccasionKind, { label: string; when: string }> = {
  fasting: {
    label: "صيام الأيام الفاضلة",
    when: "٩:٠٠ مساءً قبل الأيام البيض، وعرفة، وتاسوعاء وعاشوراء",
  },
  fasting_weekly: { label: "صيام الاثنين والخميس", when: "٩:٠٠ مساءً قبل كل اثنين وخميس" },
  iftar: { label: "الإفطار في رمضان", when: "عند أذان المغرب في رمضان: دعاء الإفطار" },
  suhoor: { label: "السحور في رمضان", when: "قبل أذان الفجر بـ٤٥ دقيقة في رمضان" },
  dhul_hijjah: { label: "عشر ذي الحجة", when: "١٠:٠٠ صباحًا من ١ إلى ٩ ذي الحجة، ودعاء يوم عرفة" },
  hijri_month: { label: "بداية الشهر الهجري", when: "٨:٠٠ صباحًا أول كل شهر: دعاء رؤية الهلال" },
  eid: { label: "العيد", when: "٧:٣٠ صباحًا يوم عيد الفطر وعيد الأضحى" },
  arafah: {
    label: "يوم عرفة",
    when: "أربع مرات يوم ٩ ذي الحجة: بعد الفجر والظهر والعصر، وقبل المغرب بساعة (دعاء يوم عرفة والذكر)",
  },
  qadr_nights: { label: "ليالي الوتر في العشر الأواخر", when: "بعد العشاء بنصف ساعة ليلة ٢١ و٢٣ و٢٥ و٢٧ و٢٩ رمضان: سورة القدر ودعاء" },
  qiyam: { label: "قيام الليل", when: "كل ليلة عند بداية الثلث الأخير من الليل (بين المغرب والفجر)" },
  duha: { label: "صلاة الضحى", when: "كل يوم بعد الشروق بربع ساعة: دخول وقت صلاة الضحى" },
  imsakiya: { label: "إمساكية رمضان", when: "٨:٠٠ مساءً يوم ٢٧ شعبان: صورة مواقيت رمضان كاملًا لمدينة القناة" },
};

export const ALL_OCCASIONS = Object.keys(OCCASIONS) as OccasionKind[];

/** A new occasions schedule: all of them but the daily qiyam and duha reminders, which each channel turns on itself. */
export const DEFAULT_OCCASIONS: OccasionKind[] = ALL_OCCASIONS.filter((k) => k !== "qiyam" && k !== "duha");
