Pod::Spec.new do |s|
  s.name           = 'AfterglowLive'
  s.version        = '1.0.0'
  s.summary        = 'Afterglow outside the app: Live Activity, widgets and the Apple Watch'
  s.description    = 'Shares your festival at a glance with the widgets (App Group), starts and updates the festival Live Activity, and sends it to the Apple Watch.'
  s.license        = 'UNLICENSED'
  s.author         = 'Afterglow'
  s.homepage       = 'https://afterglowmusic.app'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'ActivityKit', 'WidgetKit', 'WatchConnectivity'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,swift}'
end
