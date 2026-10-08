/**
 * The muezzins whose adhan can ring for the prayers: 
 * recordings (Apps/extension/ADHAN_VOICES, the same order), built into the
 * app as notification sounds by plugins/adhan-sounds.js. Android plays the
 * whole adhan; iOS its first 28 seconds (its limit is 30).
 */
export const ADHAN_VOICES: [id: string, name: string][] = [
  ["adhan_muhammad_refaat", "محمد رفعت"],
  ["adhan_abdulbasit_abdusamad", "عبد الباسط عبد الصمد"],
  ["adhan_mustafa_ismail", "مصطفى إسماعيل"],
  ["adhan_mahmoud_ali_al_banna", "محمود علي البنا"],
  ["adhan_nasr_eldin_tobar", "نصر الدين طوبار"],
  ["adhan_abul_ainain_shuaisha", "أبو العينين شعيشع"],
  ["adhan_ali_ibn_ahmad_mala", "علي أحمد ملا"],
  ["adhan_abdalmajeed_alsarihi", "عبد المجيد السريحي"],
  ["adhan_nasser_al_qatami", "ناصر القطامي"],
  ["adhan_muhammad_jazy", "محمد جازي عبدالله"],
  ["adhan_mohamed_qassas", "محمد بن مروان قصاص"],
];

/** "system": the phone's own notification sound. */
export const SYSTEM_SOUND = "system";
export const isAdhanVoice = (v: unknown): v is string => v === SYSTEM_SOUND || ADHAN_VOICES.some(([id]) => id === v);
export const voiceName = (id: string) => (id === SYSTEM_SOUND ? "صوت الإشعارات في الجهاز" : (ADHAN_VOICES.find(([v]) => v === id)?.[1] ?? ""));
