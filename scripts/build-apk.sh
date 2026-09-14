#!/usr/bin/env bash
# สร้างไฟล์ APK สำหรับติดตั้งบน Android
#
# รวมสามขั้นไว้ที่เดียว: build เว็บ -> คัดลอกเข้าโปรเจกต์ Android -> สร้าง APK
# เพราะถ้าลืมขั้นกลาง จะได้ APK ที่ห่อโค้ดเก่าไว้โดยไม่มีอะไรเตือน
set -euo pipefail

cd "$(dirname "$0")/.."

# ---- หา JDK ที่ใช้ได้ ----
# Gradle 8.14 รองรับ Java ถึงรุ่น 24 เท่านั้น เครื่องที่มีแต่ Java 25 จะ build ไม่ผ่าน
# โดยขึ้น error ว่า "Unsupported class file major version 69" ซึ่งไม่ได้บอกว่าต้องทำอะไร
if [ -z "${JAVA_HOME:-}" ] || ! "$JAVA_HOME/bin/java" -version 2>&1 | grep -qE '"(17|21)'; then
  for candidate in "$HOME/Library/Java/JavaVirtualMachines"/jdk-21*/Contents/Home \
                   "$HOME/Library/Java/JavaVirtualMachines"/jdk-17*/Contents/Home \
                   /Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home \
                   /Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home; do
    if [ -x "$candidate/bin/java" ]; then
      export JAVA_HOME="$candidate"
      break
    fi
  done
fi

if [ -z "${JAVA_HOME:-}" ] || [ ! -x "$JAVA_HOME/bin/java" ]; then
  echo "ไม่พบ JDK 17 หรือ 21 — Gradle 8.14 ใช้ Java 25 ไม่ได้" >&2
  echo "ติดตั้งได้โดยไม่ต้องใช้ sudo:" >&2
  echo "  curl -L 'https://api.adoptium.net/v3/binary/latest/21/ga/mac/aarch64/jdk/hotspot/normal/eclipse' | tar -xz -C ~/Library/Java/JavaVirtualMachines/" >&2
  exit 1
fi

# ---- หา Android SDK ----
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
if [ ! -d "$ANDROID_HOME" ]; then
  echo "ไม่พบ Android SDK ที่ $ANDROID_HOME — ติดตั้งผ่าน Android Studio ก่อน" >&2
  exit 1
fi
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

echo "==> ใช้ JDK: $("$JAVA_HOME/bin/java" -version 2>&1 | head -1)"
echo "==> build เว็บ"
npm run build

echo "==> คัดลอกเข้าโปรเจกต์ Android"
npx cap sync android

echo "==> สร้าง APK"
VARIANT="${1:-debug}"
case "$VARIANT" in
  debug)   (cd android && ./gradlew assembleDebug) ;;
  release) (cd android && ./gradlew assembleRelease) ;;
  *) echo "ใช้ได้แค่ debug หรือ release" >&2; exit 1 ;;
esac

APK=$(find android/app/build/outputs/apk/"$VARIANT" -name '*.apk' | head -1)
echo
echo "เสร็จแล้ว: $APK"
ls -lh "$APK"
