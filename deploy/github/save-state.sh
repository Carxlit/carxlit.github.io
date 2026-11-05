#!/usr/bin/env bash
# Guarda en el repositorio el estado de la redacción (cola, historial, sitio, tarjetas).
# Escribe site=true|false en $GITHUB_OUTPUT para decidir si hay que republicar el sitio.
set -e
git config user.name "punto-ciego-bot"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add storage/*.json site public/news-cards
if [ -f storage/.ai-cooldown.json ]; then git add -f storage/.ai-cooldown.json; fi
if [ -n "$GITHUB_OUTPUT" ]; then
  if git diff --cached --quiet -- site; then echo "site=false" >> "$GITHUB_OUTPUT"; else echo "site=true" >> "$GITHUB_OUTPUT"; fi
fi
if git diff --cached --quiet; then echo "Sin cambios"; exit 0; fi
git commit -m "${1:-Estado de la redacción} $(date -u +%Y-%m-%dT%H:%MZ)"
for attempt in 1 2 3 4 5 6; do
  if git pull --rebase --autostash && git push; then
    exit 0
  fi
  case $attempt in
    1) sleep 5 ;;
    2) sleep 10 ;;
    3) sleep 20 ;;
    4) sleep 30 ;;
    5) sleep 45 ;;
    *) sleep 60 ;;
  esac
done
echo "No se pudo guardar el estado tras 6 intentos"
exit 1
