import struct, zlib, math, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from png import ler

class Img:
    def __init__(self, w, h, d=None):
        self.w, self.h = w, h
        self.d = bytearray(d) if d is not None else bytearray(w*h*4)

    @staticmethod
    def abrir(caminho):
        w,h,c,d = ler(caminho)
        if c == 4: return Img(w,h,d)
        r = Img(w,h)
        for i in range(w*h):
            if c == 3: r.d[i*4:i*4+3] = d[i*3:i*3+3]
            elif c == 1: r.d[i*4] = r.d[i*4+1] = r.d[i*4+2] = d[i]
            elif c == 2: r.d[i*4] = r.d[i*4+1] = r.d[i*4+2] = d[i*2]; r.d[i*4+3] = d[i*2+1]; continue
            r.d[i*4+3] = 255
        return r

    def px(self, x, y):
        i = (y*self.w + x)*4
        return self.d[i:i+4]

    def recortar(self, x0, y0, x1, y1):
        w, h = x1-x0, y1-y0
        r = Img(w, h)
        for y in range(h):
            o = ((y+y0)*self.w + x0)*4
            r.d[y*w*4:(y+1)*w*4] = self.d[o:o+w*4]
        return r

    def redimensionar(self, nw, nh):
        """Área média (caixa) — o filtro certo para reduzir: pega todos os
        pixels de origem, então não perde traço fino nem cria serrilhado."""
        r = Img(nw, nh)
        ex, ey = self.w/nw, self.h/nh
        for y in range(nh):
            y0, y1 = int(y*ey), max(int(y*ey)+1, int((y+1)*ey))
            for x in range(nw):
                x0, x1 = int(x*ex), max(int(x*ex)+1, int((x+1)*ex))
                sa=sr=sg=sb=0; n=0
                for yy in range(y0, min(y1, self.h)):
                    o = (yy*self.w)*4
                    for xx in range(x0, min(x1, self.w)):
                        i = o + xx*4
                        a = self.d[i+3]
                        # média PONDERADA pelo alfa: sem isso a cor dos pixels
                        # transparentes (preto) escorre para a borda e o traço
                        # ganha um contorno escuro que não existia.
                        sr += self.d[i]*a; sg += self.d[i+1]*a; sb += self.d[i+2]*a
                        sa += a; n += 1
                i = (y*nw + x)*4
                if sa:
                    r.d[i] = min(255, sr//sa); r.d[i+1] = min(255, sg//sa); r.d[i+2] = min(255, sb//sa)
                r.d[i+3] = sa//n if n else 0
        return r

    def colar(self, outra, dx, dy):
        for y in range(outra.h):
            ty = y+dy
            if not (0 <= ty < self.h): continue
            for x in range(outra.w):
                tx = x+dx
                if not (0 <= tx < self.w): continue
                i, j = (ty*self.w+tx)*4, (y*outra.w+x)*4
                a = outra.d[j+3]
                if a == 0: continue
                if a == 255:
                    self.d[i:i+4] = outra.d[j:j+4]
                else:
                    ab = self.d[i+3]
                    na = a + ab*(255-a)//255
                    for k in range(3):
                        self.d[i+k] = (outra.d[j+k]*a + self.d[i+k]*ab*(255-a)//255)//max(na,1)
                    self.d[i+3] = na
        return self

    def preencher(self, r, g, b, a=255):
        for i in range(0, len(self.d), 4):
            self.d[i:i+4] = bytes((r,g,b,a))
        return self

    def mascara_circulo(self, raio=None):
        cx = cy = (self.w-1)/2
        raio = raio or self.w/2
        for y in range(self.h):
            for x in range(self.w):
                if math.hypot(x-cx, y-cy) > raio:
                    self.d[(y*self.w+x)*4+3] = 0
        return self

    def salvar(self, caminho):
        cru = bytearray()
        for y in range(self.h):
            cru.append(0)
            cru += self.d[y*self.w*4:(y+1)*self.w*4]
        def bloco(tag, corpo):
            return (struct.pack('>I', len(corpo)) + tag + corpo +
                    struct.pack('>I', zlib.crc32(tag+corpo) & 0xffffffff))
        png = (b'\x89PNG\r\n\x1a\n'
               + bloco(b'IHDR', struct.pack('>IIBBBBB', self.w, self.h, 8, 6, 0, 0, 0))
               + bloco(b'IDAT', zlib.compress(bytes(cru), 9))
               + bloco(b'IEND', b''))
        open(caminho, 'wb').write(png)

    def caixa(self, teste):
        x0,y0,x1,y1 = self.w, self.h, -1, -1
        for y in range(self.h):
            for x in range(self.w):
                if teste(self.px(x,y)):
                    x0=min(x0,x); x1=max(x1,x); y0=min(y0,y); y1=max(y1,y)
        return x0,y0,x1+1,y1+1

def colorido(p, limiar=40):
    """Traço da logo: tem cor. Sombra e fundo são cinza/creme."""
    if p[3] < 100: return False
    return max(p[0],p[1],p[2]) - min(p[0],p[1],p[2]) > limiar
