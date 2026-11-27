#!/usr/bin/env bash
# Run after `npx cap add android`. Customises the generated project.
set -euo pipefail
M=android/app/src/main/AndroidManifest.xml
G=android/app/build.gradle
CODE="${VERSION_CODE:-1}"
NAME="${VERSION_NAME:-1.0}"

# camera (QR scanner uses getUserMedia) - optional hardware so install never fails
if ! grep -q "android.permission.CAMERA" "$M"; then
  sed -i 's#</manifest>#    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />\n</manifest>#' "$M"
fi

sed -i "s/versionCode [0-9]*/versionCode $CODE/; s/versionName \"[^\"]*\"/versionName \"$NAME\"/" "$G"
grep -n "versionCode\|versionName" "$G"
grep -n "CAMERA" "$M"
