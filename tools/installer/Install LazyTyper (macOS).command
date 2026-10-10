#!/bin/bash
# LazyTyper - installs the panel for After Effects.
# Double-click this file. If macOS refuses, right-click it and choose Open.
set -u

cd "$(dirname "$0")"
EXT_ROOT="$HOME/Library/Application Support/Adobe/CEP/extensions"
DEST="$EXT_ROOT/com.sohan.LazyTyper"
LEGACY="$EXT_ROOT/LazyTyper"

echo "============================================================"
echo "  LazyTyper - install"
echo "  After Effects"
echo "============================================================"
echo
echo "Close After Effects before going on."
read -r -p "Press return when they are closed. " _
echo

zxp=$(ls -1 ./*.zxp 2>/dev/null | head -1 || true)
if [ -z "${zxp}" ]; then
  echo "[!] There is no LazyTyper .zxp file next to this one."
  echo "    Unzip the whole download first, then run this from inside that folder."
  read -r -p "Press return to close. " _
  exit 1
fi

echo "Installing ${zxp}"
echo "        to ${DEST}"
rm -rf "${DEST}"
mkdir -p "${DEST}"
if ! unzip -q -o "${zxp}" -d "${DEST}"; then
  echo "[!] Could not unpack the panel."
  read -r -p "Press return to close. " _
  exit 1
fi
# Quarantine flags on a downloaded file travel into what it unpacks.
xattr -dr com.apple.quarantine "${DEST}" 2>/dev/null || true

if [ ! -f "${DEST}/CSXS/manifest.xml" ]; then
  echo "[!] The panel did not unpack correctly."
  read -r -p "Press return to close. " _
  exit 1
fi

# A copy unpacked or linked by hand as "LazyTyper" has the same extension ID,
# and two panels with one ID clash, so that copy is moved aside - not deleted.
if [ -f "${LEGACY}/CSXS/manifest.xml" ] && grep -q "com.sohan.LazyTyper" "${LEGACY}/CSXS/manifest.xml"; then
  if [ -L "${LEGACY}" ]; then
    rm "${LEGACY}"
    echo "Removed the developer link ${LEGACY}."
  else
    PARKED="$HOME/Library/Application Support/Adobe/CEP/LazyTyper-old-copy"
    [ -e "${PARKED}" ] && PARKED="${PARKED}-$$"
    mv "${LEGACY}" "${PARKED}" && echo "Moved the older LazyTyper copy to ${PARKED}."
  fi
fi

echo
echo "============================================================"
echo "  Installed."
echo "============================================================"
echo
echo "  Open it:"
echo "    After Effects  Window > Extensions > LazyTyper"
echo
echo "  Your saved presets and settings from an earlier LazyTyper are kept."
echo
echo "  If the panel opens blank, run this in Terminal and restart the app:"
echo "    defaults write com.adobe.CSXS.11 PlayerDebugMode 1"
echo "    defaults write com.adobe.CSXS.12 PlayerDebugMode 1"
echo
read -r -p "Press return to close. " _
