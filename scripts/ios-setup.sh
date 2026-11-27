#!/usr/bin/env bash
# Run after `npx cap add ios`. Customises the generated Xcode project.
set -euo pipefail
PLIST="ios/App/App/Info.plist"

[ -f "$PLIST" ] || { echo "Missing $PLIST - run 'npx cap add ios' first" >&2; exit 1; }

# iOS kills the app the moment it touches the camera without a usage string.
# The QR scanner uses getUserMedia (video only, no microphone).
python3 - "$PLIST" <<'PY'
import plistlib, sys
path = sys.argv[1]
with open(path, "rb") as f:
    data = plistlib.load(f)
data.setdefault("NSCameraUsageDescription", "TEDxMSA uses the camera to scan QR codes.")
# No custom crypto, only HTTPS. Saves the export-compliance prompt if this ever goes to TestFlight.
data.setdefault("ITSAppUsesNonExemptEncryption", False)
with open(path, "wb") as f:
    plistlib.dump(data, f)
PY

python3 - "$PLIST" <<'PY'
import plistlib, sys
with open(sys.argv[1], "rb") as f:
    d = plistlib.load(f)
for k in ("NSCameraUsageDescription", "ITSAppUsesNonExemptEncryption", "CFBundleDisplayName"):
    print(f"{k} = {d.get(k)!r}")
PY
