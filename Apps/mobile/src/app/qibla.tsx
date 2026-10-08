/**
 * The qibla as on the site (/qibla): the bearing and distance from
 * src/lib/qibla.ts for the saved place, and a compass dial turned by the
 * phone's heading (expo-location), the Kaaba marker on the qibla.
 */
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { Animated, View } from "react-native";
import Svg, { Circle, G, Line, Rect, Text as SvgText } from "react-native-svg";
import { toArabicDigits } from "@lib/content/arabic";
import { compassPoint, kaabaDistanceKm, qiblaBearing } from "@lib/qibla";
import { CityPicker, useLocate } from "@/components/city-picker";
import { haptic } from "@/components/counter";
import { CircleCheck, Compass, LocateFixed, MapPin } from "@/components/icons";
import { Screen } from "@/components/screen";
import { Button, Card, Row, T } from "@/components/ui";
import { useStore } from "@/core/store";
import { FAMILY } from "@/theme/fonts";
import { useTheme } from "@/theme/theme";

const n = toArabicDigits;
/** Within this many degrees the phone counts as facing the qibla (as on the site). */
const ON_TARGET = 4;
const DIAL = 280;

type Status = "starting" | "on" | "denied" | "none";

/**
 * Where the top of the phone points, degrees from north (true north when the
 * phone knows it, else magnetic), smoothed a little against jitter.
 */
function useHeading() {
  const [heading, setHeading] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("starting");
  const smooth = useRef<number | null>(null);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let alive = true;
    void (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!alive) return;
        if (!perm.granted) return setStatus("denied");
        sub = await Location.watchHeadingAsync((h) => {
          const raw = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (!(raw >= 0)) return;
          const prev = smooth.current;
          const next = prev == null ? raw : (prev + (((raw - prev + 540) % 360) - 180) * 0.35 + 360) % 360;
          smooth.current = next;
          setHeading(next);
          setStatus("on");
        });
        if (!alive) sub.remove();
      } catch {
        if (alive) setStatus("none");
      }
    })();
    // No reading after a few seconds: no compass on this device.
    const check = setTimeout(() => alive && smooth.current == null && setStatus((s) => (s === "starting" ? "none" : s)), 5000);
    return () => {
      alive = false;
      clearTimeout(check);
      sub?.remove();
    };
  }, []);
  return { heading, status };
}

export default function Qibla() {
  const { prefs } = useStore();
  const [picking, setPicking] = useState(false);
  const place = prefs.place;
  return (
    <Screen back title="القبلة">
      {place ? <QiblaDial latitude={place.latitude} longitude={place.longitude} city={place.city} /> : <NoPlace onPick={() => setPicking(true)} />}
      <CityPicker open={picking} onClose={() => setPicking(false)} />
    </Screen>
  );
}

function NoPlace({ onPick }: { onPick: () => void }) {
  const { locate, busy, error } = useLocate();
  return (
    <Card style={{ gap: 12 }}>
      <T color="mutedForeground">نحتاج مكانك لنحسب اتجاه القبلة.</T>
      <Button label={busy ? "جارٍ تحديد موقعك…" : "استخدم موقعي"} icon={LocateFixed} disabled={busy} onPress={() => void locate()} />
      <Button label="اختر مدينتك" icon={MapPin} variant="outline" onPress={onPick} />
      {error ? (
        <T size={13} color="destructive">
          {error}
        </T>
      ) : null}
    </Card>
  );
}

function QiblaDial({ latitude, longitude, city }: { latitude: number; longitude: number; city: string }) {
  const { colors } = useTheme();
  const { heading, status } = useHeading();
  const bearing = qiblaBearing(latitude, longitude);
  const diff = heading != null ? ((bearing - heading + 540) % 360) - 180 : null;
  const onTarget = diff != null && Math.abs(diff) <= ON_TARGET;
  const buzzed = useRef(false);

  // The dial turns the short way round: an unwrapped angle, animated.
  const angle = useRef(new Animated.Value(0)).current;
  const unwrapped = useRef(0);
  useEffect(() => {
    if (heading == null) return;
    const target = -heading;
    const cur = unwrapped.current;
    const delta = ((target - cur + 540) % 360) - 180;
    unwrapped.current = cur + delta;
    Animated.timing(angle, { toValue: unwrapped.current, duration: 120, useNativeDriver: true }).start();
  }, [heading, angle]);

  useEffect(() => {
    if (onTarget && !buzzed.current) {
      buzzed.current = true;
      haptic("done");
    }
    if (!onTarget) buzzed.current = false;
  }, [onTarget]);

  const rotate = angle.interpolate({ inputRange: [-36000, 36000], outputRange: ["-36000deg", "36000deg"] });
  const ring = onTarget ? colors.primary : colors.border;

  return (
    <View style={{ gap: 18 }}>
      <View style={{ alignItems: "center", gap: 4 }}>
        <Row gap={6}>
          <MapPin size={16} color={colors.primary} />
          <T weight="semibold">{city}</T>
        </Row>
        <T size={14} color="mutedForeground" align="center">
          القبلة على {n(Math.round(bearing))}° من الشمال ({compassPoint(bearing)}) · تبعد مكة {n(Math.round(kaabaDistanceKm(latitude, longitude)))} كم
        </T>
      </View>

      <View style={{ alignItems: "center", paddingTop: 14 }}>
        {/* The phone's top: the direction to face. */}
        <View style={{ position: "absolute", top: 0, width: 5, height: 26, borderRadius: 3, backgroundColor: onTarget ? colors.primary : colors.foreground, zIndex: 2 }} />
        <Animated.View style={{ width: DIAL, height: DIAL, transform: [{ rotate }] }}>
          <Svg width={DIAL} height={DIAL} viewBox="-100 -100 200 200">
            <Circle r={96} fill={colors.card} stroke={ring} strokeWidth={3} />
            {Array.from({ length: 72 }, (_, i) => (
              <Line
                key={i}
                x1={0}
                y1={i % 18 === 0 ? -80 : i % 6 === 0 ? -85 : -89}
                x2={0}
                y2={-93}
                transform={`rotate(${i * 5})`}
                stroke={colors.mutedForeground}
                strokeOpacity={0.6}
                strokeWidth={i % 18 === 0 ? 2 : 1}
              />
            ))}
            {["ش", "شر", "ج", "غ"].map((t, i) => (
              <G key={t} transform={`rotate(${i * 90}) translate(0 -66)`}>
                <SvgText textAnchor="middle" y={5} fontSize={14} fontFamily={FAMILY.bold} fill={i === 0 ? colors.destructive : colors.mutedForeground}>
                  {t}
                </SvgText>
              </G>
            ))}
            {/* The qibla: a line from the centre and the Kaaba at its end. */}
            <G transform={`rotate(${bearing})`}>
              <Line x1={0} y1={0} x2={0} y2={-56} stroke={onTarget ? colors.primary : colors.gold} strokeWidth={4} strokeLinecap="round" />
              <G transform="translate(0 -72)">
                <Rect x={-10} y={-10} width={20} height={20} rx={2} fill={colors.foreground} />
                <Rect x={-10} y={-5} width={20} height={3} fill={colors.gold} />
              </G>
            </G>
            <Circle r={5} fill={colors.foreground} />
          </Svg>
        </Animated.View>
      </View>

      <View style={{ alignItems: "center", gap: 8 }}>
        {status === "on" && diff != null ? (
          onTarget ? (
            <Row gap={8}>
              <CircleCheck size={20} color={colors.primary} />
              <T size={18} weight="bold" color="primary">
                أنت متجه إلى القبلة
              </T>
            </Row>
          ) : (
            <T size={18} weight="bold" align="center">
              استدر {diff > 0 ? "يمينًا" : "يسارًا"} {n(Math.abs(Math.round(diff)))}°
            </T>
          )
        ) : status === "denied" ? (
          <T size={14} color="mutedForeground" align="center">
            البوصلة تحتاج إذن الموقع. اسمح به لذِكرى من إعدادات الجهاز ثم افتح الصفحة من جديد.
          </T>
        ) : status === "none" ? (
          <T size={14} color="mutedForeground" align="center">
            لا تتوفر بوصلة في هذا الجهاز: اجعل حرف «ش» نحو الشمال، والقبلة حيث الكعبة.
          </T>
        ) : (
          <Row gap={6}>
            <Compass size={16} color={colors.mutedForeground} />
            <T size={14} color="mutedForeground">
              جارٍ تشغيل البوصلة…
            </T>
          </Row>
        )}
        <T size={12} color="mutedForeground" align="center">
          ضع الهاتف مسطحًا وبعيدًا عن المعادن والمغناطيس. إن اضطربت البوصلة، حرّك الهاتف على شكل الرقم ٨ لمعايرتها.
        </T>
      </View>
    </View>
  );
}
