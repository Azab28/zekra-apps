/** The app's building blocks in the site's look (shadcn/ui radix-nova on the site): text, cards, buttons, rows. */
import type { ReactNode } from "react";
import { Pressable, Switch, Text, View, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/theme";
import { FAMILY, type Weight } from "@/theme/fonts";
import type { TokenName } from "@/theme/colors";
import { END, START } from "@/theme/rtl";
import { ChevronLeft, type LucideIcon } from "./icons";

export const RADIUS = 20;

type TProps = {
  children: ReactNode;
  size?: number;
  weight?: Weight;
  /** A theme colour, or any colour string. */
  color?: TokenName | (string & {});
  align?: "start" | "center" | "end";
  lines?: number;
  style?: StyleProp<TextStyle>;
  selectable?: boolean;
};

/** Text in the site's face, aligned to the start (right) unless told otherwise. */
export function T({ children, size: base = 15, weight = "regular", color = "foreground", align = "start", lines, style, selectable }: TProps) {
  const { colors, scale } = useTheme();
  const size = Math.round(base * scale);
  const c = Object.hasOwn(colors, color) ? colors[color as TokenName] : color;
  return (
    <Text
      numberOfLines={lines}
      selectable={selectable}
      style={[
        {
          fontFamily: FAMILY[weight],
          fontSize: size,
          lineHeight: Math.round(size * 1.65),
          color: c,
          textAlign: align === "center" ? "center" : align === "end" ? END : START,
          writingDirection: "rtl",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Row({ children, gap = 8, style, align = "center" }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; align?: ViewStyle["alignItems"] }) {
  return <View style={[{ flexDirection: "row", alignItems: align, gap }, style]}>{children}</View>;
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const { colors, dark } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: RADIUS,
          padding: padded ? 16 : 0,
          shadowColor: "#000",
          shadowOpacity: dark ? 0 : 0.05,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: dark ? 0 : 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: PressableProps["onPress"];
  icon?: LucideIcon;
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "md" | "sm";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, icon: Icon, variant = "primary", size = "md", disabled, style }: ButtonProps) {
  const { colors } = useTheme();
  const fg = variant === "primary" ? colors.primaryForeground : variant === "danger" ? "#ffffff" : colors.foreground;
  const bg = variant === "primary" ? colors.primary : variant === "danger" ? colors.destructive : variant === "outline" ? colors.card : "transparent";
  const h = size === "sm" ? 38 : 46;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          height: h,
          paddingHorizontal: size === "sm" ? 14 : 18,
          borderRadius: 14,
          backgroundColor: bg,
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {Icon && <Icon size={size === "sm" ? 16 : 18} color={fg} />}
      <T size={size === "sm" ? 14 : 15} weight="semibold" color={fg} align="center">
        {label}
      </T>
    </Pressable>
  );
}

/** A round icon button (header actions, steppers). */
export function IconButton({ icon: Icon, onPress, label, size = 40, tone = "muted", disabled }: { icon: LucideIcon; onPress: () => void; label: string; size?: number; tone?: "muted" | "primary" | "plain"; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tone === "primary" ? colors.primary : tone === "muted" ? colors.muted : "transparent",
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Icon size={size * 0.48} color={tone === "primary" ? colors.primaryForeground : colors.foreground} />
    </Pressable>
  );
}

/** A tappable row: icon, title and note, a chevron toward the end (left). */
export function ListRow({ icon: Icon, title, note, onPress, trailing, last }: { icon?: LucideIcon; title: string; note?: string; onPress?: () => void; trailing?: ReactNode; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 13,
        paddingHorizontal: 16,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
        backgroundColor: pressed ? colors.muted : "transparent",
      })}
    >
      {Icon && (
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
          <Icon size={18} color={colors.primary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <T weight="medium">{title}</T>
        {note ? (
          <T size={13} color="mutedForeground">
            {note}
          </T>
        ) : null}
      </View>
      {trailing ?? (onPress ? <ChevronLeft size={18} color={colors.mutedForeground} /> : null)}
    </Pressable>
  );
}

export function SwitchRow({ title, note, value, onChange, last, disabled }: { title: string; note?: string; value: boolean; onChange: (v: boolean) => void; last?: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <ListRow
      title={title}
      note={note}
      last={last}
      trailing={
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          trackColor={{ true: colors.primary, false: colors.input }}
          thumbColor="#ffffff"
          ios_backgroundColor={colors.input}
        />
      }
    />
  );
}

/** A choice of a few options side by side. */
export function Segmented<V extends string | number>({ options, value, onChange }: { options: { value: V; label: string; icon?: LucideIcon }[]; value: V; onChange: (v: V) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: colors.muted, borderRadius: 14, padding: 4, gap: 4 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{
              flex: 1,
              minHeight: 38,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 6,
              paddingHorizontal: 6,
              backgroundColor: on ? colors.card : "transparent",
              shadowColor: "#000",
              shadowOpacity: on ? 0.08 : 0,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
              elevation: on ? 1 : 0,
            }}
          >
            {o.icon && <o.icon size={15} color={on ? colors.primary : colors.mutedForeground} />}
            <T size={13} weight={on ? "semibold" : "regular"} color={on ? "foreground" : "mutedForeground"} align="center" lines={1}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <T size={13} weight="semibold" color="mutedForeground" style={{ marginTop: 8, marginBottom: 6, paddingHorizontal: 4 }}>
      {children}
    </T>
  );
}
