# المصادر والرخص · Sources and licenses

رخصة [GPL-3.0](LICENSE) تشمل كود المشروع وحده. أما النصوص والأصوات والخطوط والصور التالية فلأصحابها وبشروطهم.
The GPL-3.0 covers the project's own code only. The texts, recordings, fonts and pictures below belong to their owners, under their terms.

## النصوص · Texts (`data/`)

النصوص الدينية تُعرض كما جاءت من مصادرها، ولا تُكتب أو تُعدَّل يدويًا.
Religious texts are shown exactly as their sources give them, never written or edited by hand.

| الملف · File | المحتوى · Content | المصدر · Source |
|---|---|---|
| `quran.json` | نص القرآن (الرسم العثماني) · Quran text (Uthmani) | [Tanzil Project](https://tanzil.net) via [alquran.cloud](https://alquran.cloud). Copied verbatim under the [Tanzil terms](https://tanzil.net/docs/text_license): no changes to the text, with attribution and a link to tanzil.net. |
| `qcf.json` | رموز خطوط مصحف المدينة لكل سطر · King Fahd (QCF V2) glyph codes per printed line | [Quran.com API](https://api.quran.com). The page fonts themselves are loaded at runtime from the Quran.com CDN, © King Fahd Glorious Quran Printing Complex. |
| `hisn.json` | أذكار حصن المسلم · Hisn al-Muslim | [hisnmuslim.com](https://www.hisnmuslim.com) — the book by Sa'id ibn Ali ibn Wahf al-Qahtani. |
| `tafsir-muyassar.json` | التفسير الميسر · Al-Tafsir al-Muyassar | King Fahd Glorious Quran Printing Complex, via [alquran.cloud](https://alquran.cloud) (`ar.muyassar`). |
| `asma-husna.json` | أسماء الله الحسنى كما في سنن الترمذي (٣٥٠٧) · The 99 names as in Jami' at-Tirmidhi 3507 | [fawazahmed0/hadith-api](https://github.com/fawazahmed0/hadith-api) |
| `reciters.json`, `radios.json` | القراء والإذاعات · Reciters and radio stations | [mp3quran.net](https://mp3quran.net) API; the recitations stream from mp3quran.net. |

## الأصوات · Recordings

- `Apps/extension/adhan/` (and the apps' copies): adhan recordings by the muezzins named in each file, from the collection of the [Quran Tab](https://chromewebstore.google.com/search/Quran%20Tab) extension. © their owners.
- `Apps/extension/zikr/`: short recordings of the azkar. © their owners.
- Recitation is streamed at runtime from [mp3quran.net](https://mp3quran.net) and, ayah by ayah, from [everyayah.com](https://everyayah.com); word audio from [Quran.com](https://quran.com).

If you own one of these recordings and want it credited differently or removed, please open an issue.
إن كنت صاحب أحد هذه التسجيلات وتريد ذكر اسمك بشكل آخر أو حذفه، افتح بلاغًا.

## الخطوط · Fonts (`assets/fonts/`)

Amiri, Amiri Quran and IBM Plex Sans Arabic, under the [SIL Open Font License 1.1](https://openfontlicense.org) (the `OFL-*.txt` files beside them; see `SOURCES.md`). The extension's build downloads the same families from Google Fonts.

## الصور · Pictures

- `Apps/extension/backgrounds.json`: photos from [Wikimedia Commons](https://commons.wikimedia.org); each entry names its author and license, shown in the extension's settings.
- `public/bg/`: the project's own pictures, under the project's license.

## خدمات تستعملها التطبيقات · Services the apps call

Weather and place names from [Open-Meteo](https://open-meteo.com) (CC BY 4.0), addresses from [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org) (© OpenStreetMap contributors, ODbL), site icons from Google's favicon service, and the Zekra API at [zekra.site](https://zekra.site).

## كود من مشاريع أخرى · Third-party code

`Apps/desktop/Zekra.Core/Adhan.cs` is a port of [adhan-js](https://github.com/batoulapps/adhan-js) 4.4.6, under the MIT License:

```
Copyright (c) 2016 Batoul Apps

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Packages installed by `bun install` keep their own licenses.
