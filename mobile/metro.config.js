const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// The pure policy lives in the Functions deployment so both runtimes use one definition.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, '../functions/shared')];
module.exports = config;
