Pod::Spec.new do |s|
  s.name           = 'AfterglowShazam'
  s.version        = '1.0.0'
  s.summary        = 'Track ID for Afterglow videos with ShazamKit'
  s.description    = 'Finds the song playing in a video file with ShazamKit (iOS 17 and later).'
  s.license        = 'UNLICENSED'
  s.author         = 'Afterglow'
  s.homepage       = 'https://afterglowmusic.app'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'ShazamKit', 'AVFoundation'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,swift}'
end
