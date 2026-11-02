#!/usr/bin/env bash
# Guarda en el repositorio el estado de la redacción (cola, historial, sitio, tarjetas).
# Escribe site=true|false en $GITHUB_OUTPUT para decidir si hay que republicar el sitio.
set -e
git config user.name "punto-ciego-bot"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add storage/*.json site public/news-cards
if [ -f storage/.ai-cooldown.json ]; then git add -f storage/.ai-cooldown.json; fi
if git diff --cached --quiet -- site; then echo "site=false" >> "$GITHUB_OUTPUT"; else echo "site=true" >> "$GITHUB_OUTPUT"; fi
if git diff --cached --quiet; then echo "Sin cambios"; exit 0; fi
git commit -m "${1:-Estado de la redacción} $(date -u +%Y-%m-%dT%H:%MZ)"
for i in 1 2 3; do
  git pull --rebase --autostash && git push && exit 0
  sleep 5
done
echo "No se pudo guardar el estado"
exit 1
