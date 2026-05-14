#!/bin/zsh

set -euo pipefail

ROOT_DIR="${0:A:h:h}"
SOURCE_DIR="$ROOT_DIR/assets/videos"
OUTPUT_DIR="$ROOT_DIR/assets/videos-web"

mkdir -p "$OUTPUT_DIR"

for category_path in "$SOURCE_DIR"/*; do
  [[ -d "$category_path" ]] || continue

  category_name="${category_path:t}"
  category_output="$OUTPUT_DIR/$category_name"
  mkdir -p "$category_output"

  for video_file in "$category_path"/*.(MOV|mov|MP4|mp4|M4V|m4v|WEBM|webm)(N); do
    [[ -f "$video_file" ]] || continue

    file_name="${video_file:t}"
    [[ "$file_name" == ._* ]] && continue

    extension="${video_file:e:l}"
    base_name="${video_file:t:r}"

    if [[ "$extension" == "mov" ]]; then
      avconvert --source "$video_file" --output "$category_output/$base_name.m4v" --preset PresetAppleM4V1080pHD --multiPass --replace >/dev/null 2>&1 || true
    elif [[ "$extension" == "mp4" || "$extension" == "m4v" || "$extension" == "webm" ]]; then
      cp -f "$video_file" "$category_output/${video_file:t}"
    fi
  done

  find "$category_output" -maxdepth 1 -name '._*' -delete
done

echo "Browser-friendly videos generated in $OUTPUT_DIR"