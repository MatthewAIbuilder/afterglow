import ActivityKit
import ExpoModulesCore
import Foundation
import WatchConnectivity
import WidgetKit

/// Shared with the widget extension (targets/widget), which reads the glance from it.
let appGroup = "group.app.afterglowmusic"
let glanceKey = "glance"

/// Afterglow outside the app (src/lib/glance.ts is the JavaScript side):
/// - `setGlance`: your festival at a glance (JSON from features/glance) for the
///   widgets (App Group, then a timeline reload) and the Apple Watch.
/// - `showActivity` / `endActivities`: the festival Live Activity on the lock
///   screen and in the Dynamic Island (iOS 17 and later).
public class AfterglowLiveModule: Module {
  private let watch = WatchLink()

  public func definition() -> ModuleDefinition {
    Name("AfterglowLive")

    OnCreate {
      self.watch.activate()
    }

    Function("setGlance") { (json: String) in
      UserDefaults(suiteName: appGroup)?.set(json, forKey: glanceKey)
      WidgetCenter.shared.reloadAllTimelines()
      self.watch.send(json)
    }

    Function("lastGlance") { () -> String? in
      UserDefaults(suiteName: appGroup)?.string(forKey: glanceKey)
    }

    Function("activitiesEnabled") { () -> Bool in
      if #available(iOS 17.0, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    // Shows (or updates) tonight's Live Activity. `state` is the ContentState as JSON, dates in milliseconds.
    AsyncFunction("showActivity") { (festival: String, night: String, state: String, staleAt: Double) async -> Bool in
      guard #available(iOS 17.0, *) else { return false }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
      let decoder = JSONDecoder()
      decoder.dateDecodingStrategy = .millisecondsSince1970
      guard let data = state.data(using: .utf8),
            let content = try? decoder.decode(FestivalActivityAttributes.ContentState.self, from: data)
      else { return false }
      let stale = staleAt > 0 ? Date(timeIntervalSince1970: staleAt / 1000) : nil
      let update = ActivityContent(state: content, staleDate: stale)
      var mine: Activity<FestivalActivityAttributes>?
      for activity in Activity<FestivalActivityAttributes>.activities {
        if mine == nil && activity.attributes.festival == festival && activity.attributes.night == night && activity.activityState == .active {
          mine = activity
        } else {
          // Another night's (or a duplicate): it goes.
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
      if let mine {
        await mine.update(update)
        return true
      }
      do {
        _ = try Activity.request(attributes: FestivalActivityAttributes(festival: festival, night: night), content: update, pushType: nil)
        return true
      } catch {
        return false
      }
    }

    AsyncFunction("endActivities") { () async in
      guard #available(iOS 17.0, *) else { return }
      for activity in Activity<FestivalActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }
  }
}

/// The phone's side of the link to the Apple Watch app: the latest glance goes
/// as the application context (the Watch gets it the next time it can, even if
/// its app isn't open).
final class WatchLink: NSObject, WCSessionDelegate {
  private var pending: String?

  func activate() {
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  func send(_ json: String) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated else {
      pending = json
      return
    }
    guard session.isPaired, session.isWatchAppInstalled else { return }
    try? session.updateApplicationContext([glanceKey: json])
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    if activationState == .activated, let json = pending {
      pending = nil
      send(json)
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    // Switching to another watch: start again with it.
    WCSession.default.activate()
  }
}
