"""Voz en off de los Reels con las voces neuronales de Microsoft Edge (gratis, sin clave).

Uso: python reel_tts.py <entrada.json> <carpeta_salida>
  entrada.json: {"voice": "es-MX-JorgeNeural", "rate": "+8%", "pitch": "+0Hz", "lines": ["...", "..."]}
Escribe a0.mp3, a1.mp3... y timings.json: [[{"t": inicio_s, "d": duracion_s, "text": "palabra"}, ...], ...]
"""
import asyncio
import json
import os
import sys

import edge_tts


async def speak(text, voice, rate, pitch, out_mp3):
    comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
    words = []
    with open(out_mp3, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append({"t": chunk["offset"] / 1e7, "d": chunk["duration"] / 1e7, "text": chunk["text"]})
    return words


async def main():
    cfg = json.load(open(sys.argv[1], encoding="utf-8"))
    out_dir = sys.argv[2]
    timings = []
    for i, line in enumerate(cfg["lines"]):
        last = None
        for _ in range(3):  # el servicio a veces corta la conexión: reintento
            try:
                timings.append(await speak(line, cfg["voice"], cfg.get("rate", "+0%"), cfg.get("pitch", "+0Hz"),
                                           os.path.join(out_dir, f"a{i}.mp3")))
                break
            except Exception as err:  # noqa: BLE001
                last = err
                await asyncio.sleep(2)
        else:
            raise SystemExit(f"Edge TTS falló en la línea {i}: {last}")
    with open(os.path.join(out_dir, "timings.json"), "w", encoding="utf-8") as f:
        json.dump(timings, f, ensure_ascii=False)


asyncio.run(main())
