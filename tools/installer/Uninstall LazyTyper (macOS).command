#!/bin/bash
# LazyTyper - removes the panel. Your saved presets and settings are removed
# too, but only if you say so. Rigs already in your projects keep working.
set -u

DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.sohan.LazyTyper"
DATA="$HOME/Library/Application Support/LazyTyper"

echo "Removing the LazyTyper panel..."
read -r -p "Close After Effects, then press return. " _

if [ -e "${DEST}" ]; then
  rm -rf "${DEST}" && echo "Removed the panel."
else
  echo "The panel was not installed."
fi

if [ -d "${DATA}" ]; then
  echo
  echo "LazyTyper keeps your saved presets and settings in"
  echo "  ${DATA}"
  read -r -p "Delete your presets and settings as well? [y/N] " answer
  case "${answer}" in
    [yY]*) rm -rf "${DATA}" && echo "Removed your presets and settings." ;;
    *) echo "Kept them." ;;
  esac
fi

echo
echo "Typing rigs already in your projects keep working without the panel."
read -r -p "Press return to close. " _
