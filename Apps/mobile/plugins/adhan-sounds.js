/**
 * The adhan recordings as notification sounds (src/core/adhan-voices.ts):
 * Android plays the whole adhan, copied from the extension's recordings
 * (Apps/extension/adhan, read only) into res/raw with names Android accepts;
 * iOS plays at most 30 s of a notification sound, so it gets the first 28 s
 * of each (assets/adhan-ios/*.caf, made with ffmpeg: -t 28, a 3 s fade,
 * mono 22.05 kHz IMA4). The JS bundle doesn't carry them.
 */
const fs = require("fs");
const path = require("path");
const { withDangerousMod, withXcodeProject } = require("expo/config-plugins");
const { setNotificationSounds } = require("expo-notifications/plugin/build/withNotificationsIOS");

const SOURCE = path.join(__dirname, "..", "..", "extension", "adhan");
const IOS = path.join(__dirname, "..", "assets", "adhan-ios");
const resName = (file) => path.basename(file, ".mp3").replace(/-/g, "_");

module.exports = function withAdhanSounds(config) {
  config = withDangerousMod(config, [
    "android",
    (c) => {
      const raw = path.join(c.modRequest.platformProjectRoot, "app", "src", "main", "res", "raw");
      fs.mkdirSync(raw, { recursive: true });
      for (const file of fs.readdirSync(SOURCE).filter((f) => f.endsWith(".mp3"))) {
        fs.copyFileSync(path.join(SOURCE, file), path.join(raw, `${resName(file)}.mp3`));
      }
      // The channels name them only at runtime, so the release build's resource shrinker would drop them.
      fs.writeFileSync(
        path.join(raw, "zekra_keep_adhan.xml"),
        '<?xml version="1.0" encoding="utf-8"?>\n<resources xmlns:tools="http://schemas.android.com/tools" tools:keep="@raw/adhan_*" />\n',
      );
      return c;
    },
  ]);
  config = withXcodeProject(config, (c) => {
    const sounds = fs.readdirSync(IOS).filter((f) => f.endsWith(".caf")).map((f) => path.relative(c.modRequest.projectRoot, path.join(IOS, f)));
    c.modResults = setNotificationSounds(c.modRequest.projectRoot, { sounds, project: c.modResults, projectName: c.modRequest.projectName });
    return c;
  });
  return config;
};
