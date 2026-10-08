/** Picking the place: the site's city list (src/lib/cities.ts) by country, with a filter, or the device's location. */
import * as Location from "expo-location";
import { useMemo, useState } from "react";
import { TextInput, View } from "react-native";
import { CITIES, citiesOf, type CityPreset } from "@lib/cities";
import { placeAt } from "@/core/prayer";
import { useStore } from "@/core/store";
import { START } from "@/theme/rtl";
import { useTheme } from "@/theme/theme";
import { Check, LocateFixed, Search } from "./icons";
import { Sheet } from "./sheet";
import { Button, ListRow, Row, SectionTitle, T } from "./ui";

const COUNTRIES = [...new Set(CITIES.map((c) => c.country))];

/**
 * Asks for the location and saves the place for it; false when it couldn't,
 * with `error` to show where the button is (a sheet can't open a dialog over itself on iOS).
 */
export function useLocate() {
  const { dispatch } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locate = async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setError("لم يُسمح بالوصول إلى الموقع. اسمح به من إعدادات الجهاز، أو اختر مدينتك من القائمة.");
        return false;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return dispatch({ type: "place", ...placeAt(pos.coords.latitude, pos.coords.longitude) });
    } catch {
      setError("تعذّر تحديد الموقع. تأكد من تشغيل خدمة الموقع وحاول مرة أخرى، أو اختر مدينتك من القائمة.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { locate, busy, error };
}

export function CityPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { prefs, dispatch } = useStore();
  const { colors } = useTheme();
  const [q, setQ] = useState("");
  const { locate, busy, error } = useLocate();

  const groups = useMemo(() => {
    const query = q.trim();
    return COUNTRIES.map((country) => ({
      country,
      cities: citiesOf(country).filter((c) => !query || c.name.includes(query) || c.country.includes(query)),
    })).filter((g) => g.cities.length > 0);
  }, [q]);

  const pick = (c: CityPreset) => {
    dispatch({ type: "place", city: c.name, timezone: c.timezone, latitude: c.latitude, longitude: c.longitude, calcMethod: c.calcMethod });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="اختر مدينتك">
      <Button
        label={busy ? "جارٍ تحديد موقعك…" : "حدّد موقعي"}
        icon={LocateFixed}
        variant="outline"
        disabled={busy}
        onPress={async () => {
          if (await locate()) onClose();
        }}
      />
      {error ? (
        <T size={13} color="destructive" style={{ marginTop: 8 }}>
          {error}
        </T>
      ) : null}
      <Row style={{ marginTop: 12, backgroundColor: colors.muted, borderRadius: 14, paddingHorizontal: 12 }}>
        <Search size={18} color={colors.mutedForeground} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="ابحث عن مدينة أو دولة"
          placeholderTextColor={colors.mutedForeground}
          style={{ flex: 1, height: 44, color: colors.foreground, fontFamily: "Plex-Regular", fontSize: 15, textAlign: START, writingDirection: "rtl" }}
        />
      </Row>
      {groups.map((g) => (
        <View key={g.country}>
          <SectionTitle>{g.country}</SectionTitle>
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
            {g.cities.map((c, i) => (
              <ListRow
                key={c.name}
                title={c.name}
                onPress={() => pick(c)}
                last={i === g.cities.length - 1}
                trailing={prefs.place?.city === c.name ? <Check size={18} color={colors.primary} /> : <View />}
              />
            ))}
          </View>
        </View>
      ))}
      {groups.length === 0 && (
        <T color="mutedForeground" align="center" style={{ marginTop: 16 }}>
          لا توجد مدينة بهذا الاسم في القائمة. جرّب «حدّد موقعي».
        </T>
      )}
    </Sheet>
  );
}
