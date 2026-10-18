import AVFoundation
import ExpoModulesCore
import ShazamKit

/// Track ID for Afterglow: finds the song playing in a video on the phone with
/// ShazamKit. Only a signature of the sound goes to Apple, never the video.
/// Tries up to three short stretches (the middle, the start, the end), since
/// crowd noise or a DJ's transition can hide the song in one of them.
/// Needs iOS 17 and the ShazamKit app service on the app's identifier.
public class AfterglowShazamModule: Module {
  /// Seconds of sound sent for each try.
  static let stretch: Double = 12

  public func definition() -> ModuleDefinition {
    Name("AfterglowShazam")

    AsyncFunction("matchVideo") { (uri: String) async -> [String: String] in
      guard #available(iOS 17.0, *) else { return ["status": "unsupported"] }
      guard let url = URL(string: uri) else { return ["status": "failed", "reason": "bad-uri"] }
      let asset = AVURLAsset(url: url)
      do {
        guard let audio = try await asset.loadTracks(withMediaType: .audio).first else { return ["status": "none"] }
        let length = try await asset.load(.duration).seconds
        guard length.isFinite, length >= 3 else { return ["status": "none"] }
        let seconds = min(AfterglowShazamModule.stretch, length)
        for start in AfterglowShazamModule.starts(length: length, seconds: seconds) {
          let piece = AVMutableComposition()
          guard let out = piece.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else { continue }
          let range = CMTimeRange(start: CMTime(seconds: start, preferredTimescale: 600), duration: CMTime(seconds: seconds, preferredTimescale: 600))
          try out.insertTimeRange(range, of: audio, at: .zero)
          let signature = try await SHSignatureGenerator.signature(from: piece)
          switch await SHSession().result(from: signature) {
          case .match(let match):
            guard let item = match.mediaItems.first, let title = item.title, let artist = item.artist else { continue }
            var found = ["status": "match", "title": title, "artist": artist]
            if let link = item.appleMusicURL { found["appleMusicUrl"] = link.absoluteString }
            return found
          case .noMatch:
            continue
          case .error(let error, _):
            return ["status": "failed", "reason": String(describing: error)]
          }
        }
        return ["status": "none"]
      } catch {
        return ["status": "failed", "reason": String(describing: error)]
      }
    }
  }

  /// Where each try starts: the middle first, then the start and the end (short videos: once).
  static func starts(length: Double, seconds: Double) -> [Double] {
    if length <= seconds + 2 { return [0] }
    let middle = max(0, (length - seconds) / 2)
    let end = max(0, length - seconds)
    var out: [Double] = []
    for s in [middle, 0, end] where !out.contains(where: { abs($0 - s) < seconds / 2 }) { out.append(s) }
    return out
  }
}
