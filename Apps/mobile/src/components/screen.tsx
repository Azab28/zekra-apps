/**
 * A page: the mosque background (scene.tsx), our own header (title, back
 * button on the start side, actions on the end) and scrolling content that
 * clears the floating bar on tab pages.
 */
import { router } from "expo-router";
import { useRef, useState, type ReactNode } from "react";
import { Animated, RefreshControl, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { useBarSpace, useMiniPlayerSpace } from "./layout-metrics";
import { ChevronRight } from "./icons";
import { SceneBackground, type SceneKind } from "./scene";
import { IconButton, T } from "./ui";

type Props = {
  children: ReactNode;
  title?: string;
  /** A back button (pushed pages); tab pages have none. */
  back?: boolean;
  /** Buttons at the end (left) of the header. */
  actions?: ReactNode;
  /** A custom header instead of the title row. */
  header?: ReactNode;
  scene?: SceneKind;
  /** A tab page: leave room for the floating bar. */
  tab?: boolean;
  onRefresh?: () => Promise<void> | void;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({ children, title, back, actions, header, scene = "quiet", tab, onRefresh, contentStyle }: Props) {
  const insets = useSafeAreaInsets();
  const barSpace = useBarSpace();
  const miniSpace = useMiniPlayerSpace();
  const { colors } = useTheme();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [range, setRange] = useState({ content: 1, view: 1 });
  const [refreshing, setRefreshing] = useState(false);
  const max = Math.max(1, range.content - range.view);
  const progress = scrollY.interpolate({ inputRange: [0, max], outputRange: [0, 1], extrapolate: "clamp" });

  const refresh = onRefresh
    ? async () => {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      }
    : undefined;

  return (
    <View style={{ flex: 1, direction: "rtl" }}>
      <SceneBackground kind={scene} progress={progress} />
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        onLayout={(e) => {
          const view = e.nativeEvent.layout.height;
          setRange((r) => (r.view === view ? r : { ...r, view }));
        }}
        onContentSizeChange={(_, content) => setRange((r) => (r.content === content ? r : { ...r, content }))}
        contentContainerStyle={[{ paddingTop: insets.top + 8, paddingBottom: (tab ? barSpace : insets.bottom + miniSpace) + 16, paddingHorizontal: 16, gap: 12 }, contentStyle]}
        refreshControl={refresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
        keyboardShouldPersistTaps="handled"
      >
        {header ??
          (title ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, marginBottom: 4 }}>
              {back && <IconButton icon={ChevronRight} label="رجوع" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
              <T size={22} weight="bold" style={{ flex: 1 }} lines={1}>
                {title}
              </T>
              {actions}
            </View>
          ) : null)}
        {children}
      </Animated.ScrollView>
    </View>
  );
}
