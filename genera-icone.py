#!/usr/bin/env python3
"""
genera-icone.py
Genera le icone PWA senza dipendenze esterne — usa solo librerie Python standard.
Crea PNG con sfondo navy e lettera B azzurra.

Esecuzione: python3 genera-icone.py
"""

import os
import struct
import zlib
import math

DIMENSIONI = [72, 96, 128, 144, 152, 192, 384, 512]
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'public', 'icons')

# Colori Brianzascherma
NAVY  = (0, 36, 79)    # #00244F
BLUE  = (1, 121, 192)  # #0179C0
WHITE = (255, 255, 255)

def crea_png(width, height, pixels):
    """Crea un PNG a partire da una matrice di pixel RGBA."""
    def pack_chunk(tipo, dati):
        c = struct.pack('>I', len(dati)) + tipo + dati
        return c + struct.pack('>I', zlib.crc32(tipo + dati) & 0xffffffff)

    righe = b''
    for riga in pixels:
        r = b'\x00'
        for px in riga:
            r += bytes(px)
        righe += r

    compressa = zlib.compress(righe, 9)

    png  = b'\x89PNG\r\n\x1a\n'
    png += pack_chunk(b'IHDR',
        struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    png += pack_chunk(b'IDAT', compressa)
    png += pack_chunk(b'IEND', b'')
    return png

def dentro_rettangolo_arrotondato(x, y, w, h, r):
    """Restituisce True se il punto (x,y) è dentro il rettangolo arrotondato."""
    if x < 0 or x >= w or y < 0 or y >= h:
        return False
    # Angoli
    angoli = [(r, r), (w-r-1, r), (r, h-r-1), (w-r-1, h-r-1)]
    for cx, cy in angoli:
        if abs(x - cx) < r and abs(y - cy) < r:
            dist = math.sqrt((x-cx)**2 + (y-cy)**2)
            if dist > r:
                return False
    return True

def genera_icona(size):
    raggio = int(size * 0.22)
    pixels = []

    # Font bitmap semplice per "B" — disegnato proporzionalmente
    font_size  = size * 0.52
    centro_x   = size / 2
    centro_y   = size / 2 + size * 0.03
    larghezza_b = font_size * 0.55
    altezza_b   = font_size * 0.85

    for y in range(size):
        riga = []
        for x in range(size):
            if dentro_rettangolo_arrotondato(x, y, size, size, raggio):
                # Siamo dentro l'icona — disegna la B
                # Normalizza rispetto al centro della B
                nx = (x - (centro_x - larghezza_b/2)) / larghezza_b
                ny = (y - (centro_y - altezza_b/2))   / altezza_b

                pixel = NAVY  # sfondo

                # Tratto verticale sinistro della B (spessore ~20%)
                sp = 0.20
                if 0.0 <= nx <= sp and 0.0 <= ny <= 1.0:
                    pixel = BLUE

                # Tratto orizzontale top
                if 0.0 <= nx <= 0.85 and 0.0 <= ny <= sp:
                    pixel = BLUE

                # Tratto orizzontale medio
                if 0.0 <= nx <= 0.75 and 0.45 <= ny <= 0.45 + sp:
                    pixel = BLUE

                # Tratto orizzontale bottom
                if 0.0 <= nx <= 0.85 and 1.0 - sp <= ny <= 1.0:
                    pixel = BLUE

                # Tratto curvo destro superiore (semplificato come rettangolo)
                if 0.65 <= nx <= 0.85 and sp <= ny <= 0.45:
                    pixel = BLUE

                # Tratto curvo destro inferiore
                if 0.65 <= nx <= 0.85 and 0.45 + sp <= ny <= 1.0 - sp:
                    pixel = BLUE

                riga.append(pixel + (255,))
            else:
                # Trasparente fuori dal rettangolo
                riga.append((0, 0, 0, 0))
        pixels.append(riga)

    return crea_png(size, size, pixels)

os.makedirs(OUTPUT_DIR, exist_ok=True)

for dim in DIMENSIONI:
    dati = genera_icona(dim)
    path = os.path.join(OUTPUT_DIR, f'icon-{dim}.png')
    with open(path, 'wb') as f:
        f.write(dati)
    print(f'✓ icon-{dim}.png ({dim}x{dim})')

print(f'\nIcone generate in {OUTPUT_DIR}')
