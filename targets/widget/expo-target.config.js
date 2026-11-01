/**
 * Afterglow's widget extension (docs/apple-extras.md): the "Next set" widgets
 * on the home and lock screens, and the festival Live Activity on the lock
 * screen and in the Dynamic Island. Built by @bacons/apple-targets.
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'widget',
  name: 'AfterglowWidget',
  displayName: 'Afterglow',
  icon: '../../assets/icon.png',
  // iOS 17: widget backgrounds and Live Activities as written here; older phones just don't offer them.
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
  colors: {
    $accent: '#A97CFF',
    $widgetBackground: '#0A0918',
    night: '#0A0918',
    nightRaised: '#121026',
    glow: '#A97CFF',
    glowDeep: '#6B3FE0',
    haze: '#3A2380',
    moon: '#F3F0FF',
  },
  entitlements: {
    // The same App Group as the app, where it leaves the glance (modules/afterglow-live).
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
