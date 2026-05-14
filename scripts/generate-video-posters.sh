#!/bin/zsh

set -euo pipefail

ROOT_DIR="${0:A:h:h}"
VIDEO_DIR="$ROOT_DIR/assets/videos"
POSTER_DIR="$ROOT_DIR/assets/posters"

mkdir -p "$POSTER_DIR"

for category_path in "$VIDEO_DIR"/*; do
  [[ -d "$category_path" ]] || continue

  category_name="${category_path:t}"
  output_dir="$POSTER_DIR/$category_name"
  mkdir -p "$output_dir"

  find "$category_path" -maxdepth 1 -type f \( -iname '*.mov' -o -iname '*.mp4' -o -iname '*.m4v' -o -iname '*.webm' \) | while read -r video_file; do
    file_name="${video_file:t}"
    [[ "$file_name" == ._* ]] && continue
    qlmanage -t -s 1200 -o "$output_dir" "$video_file" >/dev/null 2>&1 || true
  done

  find "$output_dir" -maxdepth 1 -name '._*' -delete
done

echo "Video posters generated in $POSTER_DIR"