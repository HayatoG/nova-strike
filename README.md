# NOVA STRIKE — Operação Última Fronteira

Space shooter vertical 2D feito em HTML5 Canvas + JavaScript puro (sem dependências).
Arte e áudio: [Kenney](https://kenney.nl) (licença CC0).

## Como jogar

O jogo precisa de um servidor local (por causa do carregamento de áudio/fontes):

```bash
cd nova-strike
python3 -m http.server 8642
```

Depois abra **http://localhost:8642** no navegador.

## História

Ano 2347. A colônia de Kepler-186f silenciou. A ARMADA VAZIA — uma frota de
guerra autônoma de uma era esquecida — despertou. Você pilota o último caça
experimental da base Aurora através de cinco setores hostis até a nave-mãe
HEGEMONIA.

## Controles

| Tecla | Ação |
|---|---|
| Setas / WASD | Mover |
| Espaço (segurar) | Atirar |
| Enter | Confirmar / avançar diálogos |
| P | Pausar |
| M | Ligar/desligar som |

## Conteúdo

- **3 naves jogáveis** com atributos distintos (Falcão-7, Vingador, Espectro)
- **5 setores** com inimigos e intensidade progressivos
- **7 tipos de inimigos**: batedor, caça, bombardeiro, kamikaze, elite, OVNI e discos de guerra (miniboss)
- **Chefe final com 3 fases** de padrões de tiro + invocação de reforços
- **Power-ups**: melhoria de arma (3 níveis), escudo (3 cargas), tiro rápido e reparo de casco
- **Meteoros destrutíveis** que se fragmentam (grande → médio → pequeno)
- Dano visual progressivo na nave, partículas, tremor de tela, parallax de estrelas
- Trilha sonora dinâmica (menu / combate / chefe / fim de jogo) e efeitos sonoros
- Recorde salvo no navegador (localStorage)

## Atalhos de teste

- `index.html#select` — vai direto à seleção de nave
- `index.html#game` — começa a partida no setor 1
- `index.html#boss` — vai direto à luta contra o chefe
