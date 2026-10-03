import { useNetworkState } from "expo-network";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { showAlert } from "../../lib/dialog";
import { haptic } from "../../lib/haptics";
import { useCrewUpdates } from "../../state/crewUpdates";
import { color, radius, space, type } from "../../theme/tokens";
import { isOffline } from "../offline/status";
import { CHECK_INS, clock } from "./updates";

const GREEN = "#5BE3B5";
const AMBER = "#FFB86B";
const RED = "#FF8A8A";

/**
 * How you're doing, as chips like the check-ins: "I'm OK", "Can't find you"
 * (to your meeting spot when there is one) and "Need help" (asked first).
 * After asking for help, "I'm OK now" clears it. Each waits for signal like
 * any check-in and keeps the time you tapped. `onSent` gets the update's id.
 */
export function StatusChips({
  festivalId,
  onSent,
}: {
  festivalId: string;
  onSent: (id: string, what: string) => void;
}) {
  const { sendCare, callLost, myCare } = useCrewUpdates();
  const asked = myCare?.care === "help";
  const ok = () => {
    const id = sendCare(festivalId, "ok");
    if (id) onSent(id, asked ? "I’m OK now" : "I’m OK");
  };
  const lost = () =>
    showAlert(
      "Tell your crew you can’t find them?",
      "They’ll see it with the time you sent it, and your meeting spot if you have one.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: () => {
            const id = callLost(festivalId);
            if (id) onSent(id, "Can’t find you");
          },
        },
      ],
    );
  const help = () =>
    showAlert(
      "Ask your crew to come find you?",
      "They’ll see “Not feeling great” with the time you sent it, and their phones nudge them. A check-in with where you are helps them find you.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Ask my crew",
          onPress: () => {
            const id = sendCare(festivalId, "help");
            if (id) onSent(id, "Need help");
          },
        },
      ],
    );
  return (
    <View style={{ gap: space.sm }}>
      {asked && myCare ? (
        <Text style={styles.asked}>
          You asked your crew for help at {clock(myCare.at)}. Feeling better?
          Let them know.
        </Text>
      ) : null}
      <View style={styles.chips}>
        <Chip
          label={asked ? "I’m OK now" : "I’m OK"}
          tint={GREEN}
          a11y={asked ? "I’m OK now. Tell my crew" : "I’m OK. Tell my crew"}
          onPress={ok}
        />
        <Chip
          label="Can’t find you"
          tint={AMBER}
          a11y="Can’t find my crew. Tell them"
          onPress={lost}
        />
        {asked ? null : (
          <Chip
            label="Need help"
            tint={RED}
            a11y="Not feeling great. Ask my crew to come find me"
            onPress={help}
          />
        )}
      </View>
    </View>
  );
}

/**
 * Check in with your crew right where you are: the quick check-ins as one
 * tap each, how you're doing below them, and the full check-in (stage, a
 * photo, your own words) a tap away. Says honestly whether it got through.
 */
export function CheckInPanel({
  festivalId,
  title = "Check in",
}: {
  festivalId: string;
  title?: string;
}) {
  const { checkIn, outbox, dropped, ready } = useCrewUpdates();
  const offline = isOffline(useNetworkState());
  const [sent, setSent] = useState<{ id: string; what: string; at: string }>();
  if (!ready) return null;

  const done = (id: string, what: string) => {
    haptic.settle();
    setSent({ id, what, at: new Date().toISOString() });
  };
  const waiting = sent ? outbox.some((o) => o.id === sent.id) : false;
  const status = !sent
    ? undefined
    : dropped.includes(sent.id)
      ? `Couldn’t reach your crew with “${sent.what}”. Try again.`
      : waiting
        ? offline
          ? `“${sent.what}” is saved for when there’s signal, marked ${clock(sent.at)}.`
          : `Sending “${sent.what}”…`
        : `Sent “${sent.what}” · ${clock(sent.at)}`;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Pressable
          onPress={() => {
            haptic.select();
            router.push("/check-in");
          }}
          accessibilityRole="button"
          accessibilityLabel="Check in with a stage, a photo or your own words"
          hitSlop={8}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
        >
          <Text style={styles.moreText}>Stage, photo, words ›</Text>
        </Pressable>
      </View>
      <View style={styles.chips}>
        {CHECK_INS.map((words) => (
          <Chip
            key={words}
            label={words}
            a11y={`Send “${words}” to your crew`}
            onPress={() => {
              const id = checkIn(festivalId, { note: words });
              if (id) done(id, words);
            }}
          />
        ))}
      </View>
      <Text style={styles.label}>Let them know</Text>
      <StatusChips festivalId={festivalId} onSent={done} />
      {status ? (
        <Text
          style={[
            styles.status,
            sent && dropped.includes(sent.id) && { color: RED },
            waiting && offline && { color: AMBER },
          ]}
          accessibilityLiveRegion="polite"
        >
          {status}
        </Text>
      ) : null}
    </View>
  );
}

function Chip({
  label,
  a11y,
  tint,
  onPress,
}: {
  label: string;
  a11y: string;
  tint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        styles.chip,
        tint
          ? { borderColor: `${tint}66`, backgroundColor: `${tint}14` }
          : null,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, tint ? { color: tint } : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.lg,
    backgroundColor: color.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    marginBottom: space.xs,
  },
  title: { ...type.headline, color: color.moon },
  more: { paddingVertical: 4 },
  moreText: { ...type.label, color: color.glow },
  label: {
    ...type.caption,
    color: color.moonFaint,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: space.sm,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm + 2,
    borderRadius: radius.md,
    backgroundColor: "rgba(169,124,255,0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(169,124,255,0.4)",
  },
  chipText: { ...type.label, fontSize: 14, color: color.moon },
  asked: { ...type.caption, color: RED },
  status: { ...type.caption, color: color.moonDim, marginTop: space.xs },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
