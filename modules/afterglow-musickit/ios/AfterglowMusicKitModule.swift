import ExpoModulesCore
import MusicKit

/// Apple Music for Afterglow: Apple's permission prompt, and the two tokens the
/// Apple Music API needs. The developer token comes from MusicKit itself (the
/// app's identifier has the MusicKit service switched on), so no key or token
/// server is needed. Nothing is kept here; the app keeps the user token in the
/// keychain. Problems come back by name (MusicKit's own error, or "no-library"),
/// never with a token, so the app can say what to fix. See docs/music-integrations.md.
public class AfterglowMusicKitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AfterglowMusicKit")

    AsyncFunction("developerToken") { () async -> [String: String] in
      do {
        return ["token": try await DefaultMusicTokenProvider().developerToken(options: [])]
      } catch {
        return ["error": "developerToken: \(String(describing: error))"]
      }
    }

    AsyncFunction("authorize") { (developerToken: String) async -> [String: String] in
      let status = await MusicAuthorization.request()
      switch status {
      case .authorized:
        do {
          let userToken = try await MusicUserTokenProvider().userToken(for: developerToken, options: [])
          // Without a library (no subscription, or Sync Library off) there's nothing to read.
          if let subscription = try? await MusicSubscription.current, !subscription.hasCloudLibraryEnabled {
            return ["status": "failed", "reason": "no-library"]
          }
          return ["status": "authorized", "userToken": userToken]
        } catch {
          return ["status": "failed", "reason": String(describing: error)]
        }
      case .denied:
        return ["status": "denied"]
      case .restricted:
        return ["status": "restricted"]
      default:
        return ["status": "cancelled"]
      }
    }
  }
}
