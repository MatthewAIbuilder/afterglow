import ExpoModulesCore
import MusicKit

/// Apple Music for Afterglow: Apple's permission prompt, and the two tokens the
/// Apple Music API needs. The developer token comes from MusicKit itself (the
/// app's identifier has the MusicKit service switched on), so no key or token
/// server is needed. Nothing is kept here; the app keeps the user token in the
/// keychain. See docs/music-integrations.md.
public class AfterglowMusicKitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AfterglowMusicKit")

    AsyncFunction("developerToken") { () async throws -> String in
      return try await DefaultMusicTokenProvider().developerToken(options: [])
    }

    AsyncFunction("authorize") { (developerToken: String) async throws -> [String: String] in
      let status = await MusicAuthorization.request()
      switch status {
      case .authorized:
        let userToken = try await MusicUserTokenProvider().userToken(for: developerToken, options: [])
        return ["status": "authorized", "userToken": userToken]
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
