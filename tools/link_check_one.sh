#!/bin/bash
u="$1"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36"
case "$u" in
  *youtube.com/watch*)
    id="${u##*v=}"; id="${id%%&*}"
    c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=$id&format=json") ;;
  *)
    c=$(curl -sSL -o /dev/null -w "%{http_code}" --max-time 25 -A "$UA" "$u") ;;
esac
printf "%s\t%s\n" "$c" "$u"
