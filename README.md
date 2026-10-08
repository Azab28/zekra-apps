# ذِكرى · Zekra apps

تطبيقات «[ذِكرى](https://zekra.site)»: القرآن والأذكار ومواقيت الصلاة، مجانًا وبلا إعلانات.

| التطبيق | الفولدر | |
|---|---|---|
| إضافة المتصفح (Chrome، Edge، Firefox) | [`Apps/extension`](Apps/extension) | صفحة تبويب جديدة فيها آية ومواقيت وأذان وإذاعات |
| تطبيق الهاتف (Android) | [`Apps/mobile`](Apps/mobile) | Expo / React Native |
| برنامج ويندوز | [`Apps/desktop`](Apps/desktop) | C# و WinUI 3 |

المشروع صدقة جارية عن **علي متولي عزب** رحمه الله. ادعُ له.

## البناء

تحتاج [Node.js](https://nodejs.org) 24 و [Bun](https://bun.sh) 1.4:

```sh
bun install
bun run ext:build                      # Apps/extension/dist (Chrome)
bun run ext:build -- --browser=edge    # Apps/extension/dist-edge
bun run ext:build -- --browser=firefox # Apps/extension/dist-firefox
```

ثم حمّل الفولدر الناتج من صفحة الإضافات في المتصفح («تحميل إضافة غير مضغوطة»).
تطبيق الهاتف وبرنامج ويندوز: انظر README داخل فولدر كلٍّ منهما.

## ما في هذا المستودع

- `Apps/`: التطبيقات.
- `src/lib/`: الأجزاء المشتركة التي تبنى منها التطبيقات (حساب المواقيت، التاريخ الهجري، المدن، البحث في القرآن…)، وهي جزء من كود الموقع.
- `data/`: نصوص القرآن والأذكار والتفسير وقوائم القراء، وتُعرض كما هي دون تعديل (المصادر في [NOTICE.md](NOTICE.md)).

خادم الموقع والبوت ليس هنا؛ التطبيقات تكلّم واجهة `https://zekra.site/api` المفتوحة.

هذا المستودع نسخة تُحدَّث تلقائيًا من المستودع الأساسي. طريقة المساهمة في [CONTRIBUTING.md](CONTRIBUTING.md).

## الرخصة

الكود تحت [GPL-3.0](LICENSE): لك أن تستعمله وتعدّله وتنشره، بشرط أن تنشر ما تبنيه منه تحت الرخصة نفسها مع الكود.
النصوص والأصوات والخطوط لأصحابها وبرخصهم، كما في [NOTICE.md](NOTICE.md).

---

## English

The apps of [Zekra](https://zekra.site) (ذِكرى): Quran, azkar and prayer times, free and without ads. A browser extension (Chrome, Edge, Firefox) in `Apps/extension`, an Android app (Expo / React Native) in `Apps/mobile`, and a Windows app (C#, WinUI 3) in `Apps/desktop`.

Build the extension with Node.js 24 and Bun 1.4: `bun install`, then `bun run ext:build` (add `-- --browser=edge` or `-- --browser=firefox`), and load the output folder as an unpacked extension. The other apps have their own README.

`src/lib` holds the shared modules the apps are built from (prayer times, the Hijri calendar, cities, Quran search…), taken from the website's code; `data` holds the Quran, azkar and tafsir texts, shown as they are. The server and the bot aren't here: the apps use the public API at `https://zekra.site/api`. This repo is synced automatically from the main one; see [CONTRIBUTING.md](CONTRIBUTING.md).

Code: [GPL-3.0](LICENSE). Texts, recordings and fonts belong to their owners, under their terms: see [NOTICE.md](NOTICE.md).
