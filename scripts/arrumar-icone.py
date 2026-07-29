"""
Reencaixa a logo dentro da máscara do launcher.

O ícone adaptativo do Android tem 108dp, mas o launcher só mostra os 72dp do
meio e ainda passa uma máscara por cima — círculo, no Pixel. O que passar do
círculo é cortado. A logo tinha raio de tinta de 41,5% do lado quando o círculo
visível tem 33,3%: as pontas das duas diagonais e o pé das duas hastes batiam
na borda e saíam decepados, e o desenho ainda estava fora do centro.

A régua da Material para logo quadradona é a linha-guia de 44dp: meia diagonal
de 31,1dp em 108dp, ou 28,8% do lado. É esse o alvo.
"""
import sys, math
sys.path.insert(0, __import__('os').path.dirname(__file__))
from img import Img

A = '/home/dev/markee/assets'
ALVO = 0.288
CREME = (254, 244, 232)   # o fundo da marca, e a cor da sombra assada no desenho

def tinta(p):
    """Traço da logo, separado da sombra.

    Tentei primeiro por croma, e estava errado: o verde tem croma 56 e o corte
    ficava em 60, então o verde inteiro era descartado — o que além de sumir com
    a diagonal ainda puxava a centralização para o lado errado.

    A sombra é CREME, da cor do fundo. Medido nos três arquivos, a distância até
    o creme separa em dois montes com um vale largo no meio: sombra fica abaixo
    de 150, traço fica acima de 200. O corte vai no vale.
    """
    if p[3] <= 100: return False
    return abs(p[0]-CREME[0]) + abs(p[1]-CREME[1]) + abs(p[2]-CREME[2]) > 180

def raio(im, cx, cy):
    r = 0.0
    for y in range(im.h):
        for x in range(im.w):
            if tinta(im.px(x,y)):
                r = max(r, math.hypot(x-cx, y-cy))
    return r

def centro(im):
    x0,y0,x1,y1 = im.caixa(tinta)
    return (x0+x1-1)/2, (y0+y1-1)/2, x1-x0, y1-y0

def relatar(nome, im, extra=''):
    cx, cy, w, h = centro(im)
    r = raio(im, (im.w-1)/2, (im.h-1)/2)
    print(f'{nome:26} traço {w}x{h}  centro ({cx:.0f},{cy:.0f})  raio {r/im.w*100:.1f}%  {extra}')

def reencaixar(nome, encolher=True):
    """Centraliza pelo TRAÇO e, se pedido, reduz até caber na máscara.

    Centralizar pelo desenho inteiro seria errado: a sombra cai para baixo e
    para a direita, então incluí-la empurra a logo para cima e para a esquerda
    — que é exatamente o defeito sendo consertado.
    """
    im = Img.abrir(f'{A}/{nome}.png')
    tcx, tcy, _, _ = centro(im)
    s = (ALVO*im.w)/raio(im, tcx, tcy) if encolher else 1.0

    fx0,fy0,fx1,fy1 = im.caixa(lambda p: p[3] > 0)      # a sombra vai junto
    corte = im.recortar(fx0, fy0, fx1, fy1)
    if s != 1.0:
        corte = corte.redimensionar(max(1,round(corte.w*s)), max(1,round(corte.h*s)))
    saida = Img(im.w, im.w)
    saida.colar(corte, round((im.w-1)/2 - (tcx-fx0)*s), round((im.w-1)/2 - (tcy-fy0)*s))
    saida.salvar(f'{A}/{nome}.png')
    relatar(nome, saida, f'escala {s:.3f}')

def recentralizar_opaco(nome):
    """Para imagem sem transparência: desloca o conteúdo e repinta a sobra."""
    im = Img.abrir(f'{A}/{nome}.png')
    cx, cy, _, _ = centro(im)
    dx, dy = round((im.w-1)/2 - cx), round((im.w-1)/2 - cy)
    f = im.px(2,2)
    saida = Img(im.w, im.w).preencher(f[0], f[1], f[2], 255).colar(im, dx, dy)
    saida.salvar(f'{A}/{nome}.png')
    relatar(nome, saida, f'deslocado ({dx:+d},{dy:+d})')

def refazer_monocromatico():
    """Redesenha a silhueta a partir das formas da frente, JÁ corrigida.

    O monocromático que existia trazia a mesma sombra borrada assada por dentro,
    e ali isso não é sombra: o Android pinta essa camada inteira com UMA cor só,
    do tema do aparelho, então o borrão vira um halo da mesma cor da silhueta.

    Sai da frente já reencaixada, e não do arquivo antigo, para as duas camadas
    terem exatamente a mesma geometria — o ícone temático precisa cair no mesmo
    lugar do colorido.
    """
    frente = Img.abrir(f'{A}/android-icon-foreground.png')
    mono = Img(frente.w, frente.h)
    for i in range(0, len(frente.d), 4):
        if tinta(frente.d[i:i+4]):
            mono.d[i+3] = frente.d[i+3]
    mono.salvar(f'{A}/android-icon-monochrome.png')
    relatar('android-icon-monochrome', mono, 'redesenhado')

reencaixar('android-icon-foreground')
refazer_monocromatico()
# iOS e splash não passam por máscara circular: o ícone do iPhone é quadrado de
# cantos arredondados e a splash é desenhada inteira. Encolher seria perder
# tamanho à toa; só faltava centralizar.
recentralizar_opaco('icon')
reencaixar('splash-icon', encolher=False)
Img.abrir(f'{A}/icon.png').redimensionar(96,96).salvar(f'{A}/favicon.png')
print('favicon.png                regerado do ícone corrigido')
