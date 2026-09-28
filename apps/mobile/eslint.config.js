const { defineConfig, globalIgnores } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  globalIgnores(['dist-android/**', '.expo/**', 'android/**', 'ios/**']),
  expoConfig,
])
