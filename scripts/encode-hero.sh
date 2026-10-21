#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo 'Usage: bash scripts/encode-hero.sh /path/to/source.mp4 /path/to/output-directory' >&2
  exit 1
fi

source_video="$1"
output_directory="$2"
mkdir -p "$output_directory"

# Encode from the original, retaining its duration and frame rate. -n protects
# existing exports. No audio; faststart lets playback begin before download ends.
ffmpeg -hide_banner -n -i "$source_video" -map 0:v:0 -an -sn -dn \
  -c:v libx264 -preset slow -crf 26 -maxrate 2200k -bufsize 4400k \
  -pix_fmt yuv420p -movflags +faststart \
  "$output_directory/hero-desktop-v1.mp4"

ffmpeg -hide_banner -n -i "$source_video" -map 0:v:0 -an -sn -dn \
  -vf scale=1280:-2 -c:v libx264 -preset slow -crf 28 \
  -maxrate 900k -bufsize 1800k -pix_fmt yuv420p -movflags +faststart \
  "$output_directory/hero-mobile-v1.mp4"
