#!/bin/sh
set -eu

cd "$(dirname "$0")"

if [ "$(uname -s)" != "Darwin" ] || [ "$(uname -m)" != "arm64" ]; then
  echo "Turtorge macOS releases must be built on Apple Silicon." >&2
  exit 1
fi

TURTORGE_BUILD_STAMP="${TURTORGE_BUILD_STAMP:-$(date '+%Y-%m-%d_%H-%M-%S')}"
TURTORGE_TARGET_DIR="$(pwd)/artifacts/${TURTORGE_BUILD_STAMP}"
TURTORGE_VERSION="$(node -e "process.stdout.write(require('./apps/desktop/package.json').version)")"
TURTORGE_APP="$TURTORGE_TARGET_DIR/release/bundle/macos/Turtorge.app"
TURTORGE_DMG="$TURTORGE_TARGET_DIR/release/bundle/dmg/Turtorge_${TURTORGE_VERSION}_aarch64.dmg"
TURTORGE_DMG_STAGE="$(mktemp -d "${TMPDIR:-/tmp}/turtorge-dmg-stage.XXXXXX")"
export CARGO_TARGET_DIR="$TURTORGE_TARGET_DIR"

cleanup() {
  rm -rf -- "$TURTORGE_DMG_STAGE"
}
trap cleanup EXIT HUP INT TERM

TURTORGE_NOTARY_MODE="none"
if [ -n "${APPLE_API_KEY:-}${APPLE_API_ISSUER:-}${APPLE_API_KEY_PATH:-}" ]; then
  if [ -z "${APPLE_API_KEY:-}" ] || [ -z "${APPLE_API_ISSUER:-}" ] || [ -z "${APPLE_API_KEY_PATH:-}" ]; then
    echo "APPLE_API_KEY, APPLE_API_ISSUER, and APPLE_API_KEY_PATH must be provided together." >&2
    exit 1
  fi
  TURTORGE_NOTARY_MODE="api-key"
elif [ -n "${APPLE_ID:-}${APPLE_PASSWORD:-}${APPLE_TEAM_ID:-}" ]; then
  if [ -z "${APPLE_ID:-}" ] || [ -z "${APPLE_PASSWORD:-}" ] || [ -z "${APPLE_TEAM_ID:-}" ]; then
    echo "APPLE_ID, APPLE_PASSWORD, and APPLE_TEAM_ID must be provided together." >&2
    exit 1
  fi
  TURTORGE_NOTARY_MODE="apple-id"
elif [ -n "${APPLE_KEYCHAIN_PROFILE:-}" ]; then
  TURTORGE_NOTARY_MODE="keychain-profile"
fi

TURTORGE_SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:--}"
if [ "$TURTORGE_NOTARY_MODE" != "none" ] && [ "$TURTORGE_SIGNING_IDENTITY" = "-" ]; then
  echo "Notarization requires APPLE_SIGNING_IDENTITY to name an installed Developer ID Application certificate." >&2
  exit 1
fi

corepack prepare pnpm@11.9.0 --activate
pnpm install --frozen-lockfile
pnpm tauri:build --bundles app

mkdir -p "$(dirname "$TURTORGE_DMG")"
cp -R "$TURTORGE_APP" "$TURTORGE_DMG_STAGE/"
ln -s /Applications "$TURTORGE_DMG_STAGE/Applications"
hdiutil create \
  -volname Turtorge \
  -srcfolder "$TURTORGE_DMG_STAGE" \
  -ov \
  -format UDZO \
  "$TURTORGE_DMG"

if [ "$TURTORGE_SIGNING_IDENTITY" != "-" ]; then
  codesign --force --sign "$TURTORGE_SIGNING_IDENTITY" --timestamp "$TURTORGE_DMG"
fi

case "$TURTORGE_NOTARY_MODE" in
  api-key)
    xcrun notarytool submit "$TURTORGE_DMG" \
      --key "$APPLE_API_KEY_PATH" \
      --key-id "$APPLE_API_KEY" \
      --issuer "$APPLE_API_ISSUER" \
      --wait
    ;;
  apple-id)
    xcrun notarytool submit "$TURTORGE_DMG" \
      --apple-id "$APPLE_ID" \
      --password "$APPLE_PASSWORD" \
      --team-id "$APPLE_TEAM_ID" \
      --wait
    ;;
  keychain-profile)
    xcrun notarytool submit "$TURTORGE_DMG" \
      --keychain-profile "$APPLE_KEYCHAIN_PROFILE" \
      --wait
    ;;
esac

if [ "$TURTORGE_NOTARY_MODE" != "none" ]; then
  xcrun stapler staple "$TURTORGE_DMG"
fi

codesign --verify --deep --strict "$TURTORGE_APP"
hdiutil verify "$TURTORGE_DMG"

echo "Turtorge macOS artifacts:"
echo "$TURTORGE_APP"
echo "$TURTORGE_DMG"
