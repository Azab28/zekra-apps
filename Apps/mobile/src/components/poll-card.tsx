/**
 * The open poll on the home page, as the site's PollCard (/api/poll; nothing
 * when there isn't one): this phone votes by its id (core/rooms.ts deviceId),
 * the results show after voting, and the answer can be changed.
 */
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { toArabicDigits } from "@lib/content/arabic";
import { deviceId } from "@/core/rooms";
import { SITE_URL } from "@/core/site";
import { authHeader } from "@/core/sync";
import { useTheme } from "@/theme/theme";
import { CircleCheck, Vote } from "./icons";
import { Card, Row, T } from "./ui";

type PollView = {
  poll: { id: number; question: string; options: string[] } | null;
  mine?: number | null;
  results?: { total: number; counts: number[] } | null;
};

async function call(vote?: { poll: number; option: number }): Promise<PollView | null> {
  try {
    const res = await fetch(`${SITE_URL}/api/poll`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeader() },
      body: JSON.stringify({ device: await deviceId(), vote }),
    });
    return res.ok ? ((await res.json()) as PollView) : null;
  } catch {
    return null;
  }
}

const n = toArabicDigits;

export function PollCard() {
  const { colors } = useTheme();
  const [view, setView] = useState<PollView | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void call().then(setView);
  }, []);
  if (!view?.poll) return null;
  const { poll, mine, results } = view;

  const choose = async (option: number) => {
    setBusy(true);
    const next = await call({ poll: poll.id, option });
    setBusy(false);
    if (next) setView(next);
  };

  return (
    <Card style={{ gap: 10 }}>
      <Row gap={6}>
        <Vote size={16} color={colors.primary} />
        <T size={13} weight="semibold" color="primary">
          شاركنا رأيك
        </T>
      </Row>
      <T size={17} weight="bold">
        {poll.question}
      </T>
      {poll.options.map((o, i) => {
        const pct = results?.total ? Math.round((results.counts[i] / results.total) * 100) : 0;
        return (
          <Pressable
            key={i}
            disabled={busy}
            onPress={() => void choose(i)}
            accessibilityRole="button"
            accessibilityState={{ selected: mine === i }}
            style={{ borderRadius: 12, borderWidth: 1, borderColor: mine === i ? colors.primary : colors.border, overflow: "hidden" }}
          >
            {results ? <View style={{ position: "absolute", top: 0, bottom: 0, start: 0, width: `${pct}%`, backgroundColor: colors.accent }} /> : null}
            <Row style={{ justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10 }}>
              <Row gap={6} style={{ flexShrink: 1 }}>
                {mine === i ? <CircleCheck size={16} color={colors.primary} /> : null}
                <T size={14} style={{ flexShrink: 1 }}>
                  {o}
                </T>
              </Row>
              {results ? (
                <T size={13} color="mutedForeground">
                  {n(pct)}٪
                </T>
              ) : null}
            </Row>
          </Pressable>
        );
      })}
      {results ? (
        <T size={12} color="mutedForeground">
          شارك {n(results.total)} حتى الآن. يمكنك تغيير إجابتك.
        </T>
      ) : null}
    </Card>
  );
}
