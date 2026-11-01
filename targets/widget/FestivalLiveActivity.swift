import ActivityKit
import SwiftUI
import WidgetKit

/// The festival Live Activity: on the lock screen and in the Dynamic Island
/// on a festival night, the set on your route now (with the time left,
/// counting down by itself) and the next one (where, when, and the walk).
/// The app starts it and keeps it current (src/lib/glance.ts).
struct FestivalLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: FestivalActivityAttributes.self) { context in
      LockScreenView(attributes: context.attributes, state: context.state)
        .activityBackgroundTint(Color("night").opacity(0.92))
        .activitySystemActionForegroundColor(Color("moon"))
        .widgetURL(URL(string: "afterglow://tonight"))
    } dynamicIsland: { context in
      let state = context.state
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          VStack(alignment: .leading, spacing: 2) {
            Text(state.nowArtist == nil ? "NEXT" : "NOW").font(.caption2.weight(.semibold)).foregroundStyle(Color("glow"))
            Text(state.nowArtist ?? state.nextArtist ?? "").font(.headline).lineLimit(1).minimumScaleFactor(0.7)
            Text(state.nowStage ?? state.nextStage ?? "").font(.caption).foregroundStyle(.secondary).lineLimit(1)
          }
          .padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Countdown(state: state)
            .font(.title3.weight(.semibold)).monospacedDigit()
            .foregroundStyle(Color("glow"))
            .frame(maxWidth: 80, alignment: .trailing)
            .padding(.trailing, 4)
        }
        DynamicIslandExpandedRegion(.bottom) {
          if state.nowArtist != nil, let next = state.nextArtist {
            HStack(spacing: 6) {
              Image(systemName: "arrow.right.circle.fill").foregroundStyle(Color("glow"))
              Text("Next: \(next)").lineLimit(1)
              Spacer(minLength: 4)
              if let start = state.nextStart {
                Text(start, style: .time).foregroundStyle(.secondary)
              }
              if let walk = state.nextWalk {
                Label("\(walk) min", systemImage: "figure.walk").labelStyle(.titleAndIcon).foregroundStyle(.secondary)
              }
            }
            .font(.caption)
          }
        }
      } compactLeading: {
        HStack(spacing: 4) {
          Circle().fill(tint(state.color)).frame(width: 8, height: 8)
          Text(initials(state.nowArtist ?? state.nextArtist ?? "")).font(.caption2.weight(.bold))
        }
      } compactTrailing: {
        Countdown(state: state)
          .font(.caption2).monospacedDigit()
          .foregroundStyle(Color("glow"))
          .frame(maxWidth: 44)
      } minimal: {
        Image(systemName: "music.note").foregroundStyle(Color("glow"))
      }
      .widgetURL(URL(string: "afterglow://tonight"))
      .keylineTint(Color("glow"))
    }
  }
}

private func tint(_ hex: String?) -> Color {
  guard let (r, g, b) = hex?.rgb else { return Color("glow") }
  return Color(red: r, green: g, blue: b)
}

/// "Subtronics" → "SUB"; short enough for the island's corner.
private func initials(_ name: String) -> String {
  String(name.filter { $0.isLetter || $0.isNumber }.prefix(3)).uppercased()
}

/// Time left of the set on now, else time until the next one starts. Counts by itself.
struct Countdown: View {
  let state: FestivalActivityAttributes.ContentState

  var body: some View {
    let now = Date.now
    if let end = state.nowEnd, end > now {
      Text(timerInterval: now...end, countsDown: true)
    } else if let start = state.nextStart, start > now {
      Text(timerInterval: now...start, countsDown: true)
    } else {
      Text("–")
    }
  }
}

struct LockScreenView: View {
  let attributes: FestivalActivityAttributes
  let state: FestivalActivityAttributes.ContentState

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack {
        Text("\(attributes.night.uppercased()) · \(attributes.festival)")
          .font(.caption2.weight(.semibold)).foregroundStyle(Color("glow")).lineLimit(1)
        Spacer()
        Image(systemName: "sparkles").font(.caption2).foregroundStyle(Color("glow"))
      }
      if let artist = state.nowArtist {
        HStack(alignment: .center) {
          VStack(alignment: .leading, spacing: 2) {
            Text("NOW").font(.caption2.weight(.semibold)).foregroundStyle(Color("moon").opacity(0.6))
            Text(artist).font(.title3.weight(.bold)).foregroundStyle(Color("moon")).lineLimit(1).minimumScaleFactor(0.7)
            Text(state.nowStage ?? "").font(.caption).foregroundStyle(Color("moon").opacity(0.65)).lineLimit(1)
          }
          Spacer(minLength: 8)
          VStack(alignment: .trailing, spacing: 2) {
            Countdown(state: state).font(.title2.weight(.semibold)).monospacedDigit().foregroundStyle(tint(state.color))
            Text("left").font(.caption2).foregroundStyle(Color("moon").opacity(0.6))
          }
        }
      }
      if let next = state.nextArtist {
        HStack(spacing: 8) {
          Image(systemName: "arrow.right.circle.fill").foregroundStyle(Color("glow"))
          VStack(alignment: .leading, spacing: 1) {
            Text(state.nowArtist == nil ? "NEXT" : "Next").font(.caption2.weight(.semibold)).foregroundStyle(Color("moon").opacity(0.6))
            Text(next).font(state.nowArtist == nil ? .title3.weight(.bold) : .subheadline.weight(.semibold)).foregroundStyle(Color("moon")).lineLimit(1)
          }
          Spacer(minLength: 8)
          VStack(alignment: .trailing, spacing: 1) {
            if let start = state.nextStart {
              Text(start, style: .time).font(.subheadline.weight(.semibold)).foregroundStyle(Color("moon"))
            }
            Text([state.nextStage, state.nextWalk.map { "\($0) min walk" }].compactMap { $0 }.joined(separator: " · "))
              .font(.caption2).foregroundStyle(Color("moon").opacity(0.65)).lineLimit(1)
          }
        }
      }
    }
    .padding(16)
  }
}
