/** The bottom corners: the site and the live radio on one side, another background and the settings on the other. */
import { $, fill, h, icon, siteUrl } from "../lib/dom";
import { sendRadio, trackLabel, type RadioState } from "../lib/radio";
import { isGlass } from "../lib/settings";
import { openFavorites } from "./ayah";
import { shuffleBackground, shownBackground } from "./background";
import { openSettings } from "./settings-dialog";
import { S } from "./state";
import { iconButton } from "./ui";

export function renderBottomEnd() {
  const bg = shownBackground()?.bg;
  fill(
    $("#bottom-end"),
    isGlass(S.theme) && iconButton("image", bg ? `خلفية أخرى — الصورة: ${bg.author} (${bg.license})` : "خلفية أخرى", () => void shuffleBackground().then(renderBottomEnd)),
    iconButton("heart", "الآيات المفضلة", () => void openFavorites()),
    iconButton("settings", "الإعدادات", () => openSettings()),
  );
}

export function renderBottomStart(r: RadioState) {
  const on = !!r.track && r.status !== "stopped";
  const name = r.track ? trackLabel(r.track)[0] : "";
  fill(
    $("#bottom-start"),
    h("a", { class: "chip", href: siteUrl("/"), title: "موقع ذِكرى" }, h("img", { class: "brand-mark", src: "icons/32.png", alt: "" }), "ذِكرى"),
    on
      ? h(
          "div",
          { class: "chip radio-on" },
          h(
            "button",
            { type: "button", class: "radio-toggle", title: "إيقاف", "aria-label": "إيقاف", onclick: () => void sendRadio({ type: "radio:stop" }) },
            r.status === "loading" ? icon("loader-circle", "icon spin") : icon("square"),
          ),
          h("button", { type: "button", class: "radio-name", onclick: openRadio, title: "الإذاعة والتلاوات" }, r.status === "error" ? `${name} — تعذّر التشغيل` : name),
        )
      : h("button", { type: "button", class: "chip", onclick: openRadio, title: "إذاعات القرآن الكريم" }, icon("radio-tower"), "الإذاعة"),
  );
}

/** The toolbar popup holds the station list; without it, the site's radio page. */
function openRadio() {
  chrome.action.openPopup().catch(() => (location.href = siteUrl("/radio")));
}
