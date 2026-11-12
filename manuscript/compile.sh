#!/usr/bin/env bash
set -e

MAIN="leaf_gbc1_community_npj_microgravity"
echo "=== Compiling ${MAIN}.tex via pdflatex + bibtex ==="

pdflatex -interaction=nonstopmode "${MAIN}.tex"
bibtex "${MAIN}"
pdflatex -interaction=nonstopmode "${MAIN}.tex"
pdflatex -interaction=nonstopmode "${MAIN}.tex"

echo "=== Copying compiled PDF to app/public/ ==="
mkdir -p ../app/public
cp "${MAIN}.pdf" ../app/public/leaf_gbc1_community_npj_microgravity.pdf
echo "=== Done: ../app/public/leaf_gbc1_community_npj_microgravity.pdf generated ==="
