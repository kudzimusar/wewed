# Wewed Android wrapper

This directory contains the Trusted Web Activity wrapper for `https://wewed.pro`.

- Application ID: `pro.wewed.app`
- Launch URL: `https://wewed.pro/app?source=google-play`
- Minimum SDK: 21
- Compile and target SDK: 36
- Initial version code: 1
- Initial version name: 1

The project was generated with Bubblewrap CLI 1.24.1 and Bubblewrap Core 1.25.0. The generated Android resources use the repository's Wewed launcher, maskable, shortcut, splash, and monochrome notification artwork.

## Build prerequisites

- A native ARM64 JDK 17 on Apple silicon
- Android SDK platform 36 and build tools
- Network access to Google's Maven repository and Gradle distribution service on the first build
- A separately managed upload keystore for a signed release

Do not add a keystore or its passwords to this repository. `wewed-upload.jks` is only the placeholder path in `twa-manifest.json`; no key is included here.

For an unsigned compile check after installing JDK 17:

```sh
export JAVA_HOME="/path/to/arm64/jdk-17/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
./gradlew :app:assembleRelease :app:bundleRelease
```

Before a release, deploy the current PWA icons and manifest, add the Play app-signing certificate fingerprint to `https://wewed.pro/.well-known/assetlinks.json`, and verify the domain association on a physical Android device.
