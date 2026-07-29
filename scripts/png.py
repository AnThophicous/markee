import struct, zlib

def ler(caminho):
    """PNG 8 bits, sem entrelace -> (largura, altura, canais, bytes)."""
    b = open(caminho, 'rb').read()
    assert b[:8] == b'\x89PNG\r\n\x1a\n', 'não é PNG'
    o, dados, plte, trns = 8, bytearray(), None, None
    larg = alt = prof = tipo = None
    while o < len(b):
        n = struct.unpack_from('>I', b, o)[0]
        tag = b[o+4:o+8]
        corpo = b[o+8:o+8+n]
        if tag == b'IHDR':
            larg, alt, prof, tipo, _, _, entre = struct.unpack('>IIBBBBB', corpo)
            assert prof == 8 and entre == 0, f'só 8 bits sem entrelace (veio {prof}/{entre})'
        elif tag == b'PLTE': plte = corpo
        elif tag == b'tRNS': trns = corpo
        elif tag == b'IDAT': dados += corpo
        elif tag == b'IEND': break
        o += 12 + n

    canais = {0:1, 2:3, 3:1, 4:2, 6:4}[tipo]
    cru = zlib.decompress(bytes(dados))
    passo = larg * canais
    saida = bytearray(passo * alt)
    ant = bytearray(passo)
    p = 0
    for y in range(alt):
        f = cru[p]; p += 1
        linha = bytearray(cru[p:p+passo]); p += passo
        if f == 1:
            for i in range(canais, passo): linha[i] = (linha[i] + linha[i-canais]) & 255
        elif f == 2:
            for i in range(passo): linha[i] = (linha[i] + ant[i]) & 255
        elif f == 3:
            for i in range(passo):
                e = linha[i-canais] if i >= canais else 0
                linha[i] = (linha[i] + ((e + ant[i]) >> 1)) & 255
        elif f == 4:
            for i in range(passo):
                a = linha[i-canais] if i >= canais else 0
                c = ant[i-canais] if i >= canais else 0
                bb = ant[i]
                pa, pb, pc = abs(bb-c), abs(a-c), abs(a+bb-2*c)
                pr = a if (pa <= pb and pa <= pc) else (bb if pb <= pc else c)
                linha[i] = (linha[i] + pr) & 255
        saida[y*passo:(y+1)*passo] = linha
        ant = linha

    if tipo == 3:  # paleta -> RGBA
        rgba = bytearray(larg*alt*4)
        for i in range(larg*alt):
            j = saida[i]
            rgba[i*4:i*4+3] = plte[j*3:j*3+3]
            rgba[i*4+3] = trns[j] if trns and j < len(trns) else 255
        return larg, alt, 4, rgba
    return larg, alt, canais, saida
