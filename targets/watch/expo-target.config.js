/**
 * Afterglow on the Apple Watch (docs/apple-extras.md): on a festival night,
 * the set on your route now and the next, counting down by themselves; before
 * it, the countdown to your next festival. The iPhone sends it what to show
 * (modules/afterglow-live). Built by @bacons/apple-targets.
 * @type {import('@bacons/apple-targets/app.plugin').Config}
 */
module.exports = {
  type: 'watch',
  name: 'AfterglowWatch',
  displayName: 'Afterglow',
  icon: '../../assets/icon.png',
  deploymentTarget: '10.0',
  frameworks: ['SwiftUI', 'WatchConnectivity'],
  colors: {
    $accent: '#A97CFF',
    night: '#0A0918',
    nightRaised: '#121026',
    glow: '#A97CFF',
    glowDeep: '#6B3FE0',
    moon: '#F3F0FF',
  },
};
