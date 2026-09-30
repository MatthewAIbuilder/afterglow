// Metro, Expo's bundler: the defaults, plus one fix for the web.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `obscenity` (the word filter for handles and bios) ships an ES module wrapper that the web bundle
// can't read (it crashes on start). Its CommonJS build works everywhere, so the web uses that.
// Node's own resolution picks that CommonJS build (dist/index.js).
const obscenity = require.resolve('obscenity');
const resolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, name, platform) => {
  if (platform === 'web' && name === 'obscenity') return { type: 'sourceFile', filePath: obscenity };
  return (resolve ?? context.resolveRequest)(context, name, platform);
};

module.exports = config;
