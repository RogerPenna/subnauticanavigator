# Subnautica Map & Navigation - Grist Widget

Este é um widget customizado para o Grist projetado para auxiliar na navegação no jogo Subnautica. Ele permite calcular coordenadas (X, Z) baseadas em distância e ângulo, visualizar a posição em um mapa e calibrar a escala do mapa.

## Funcionalidades

- **Bússola Interativa:** Role a bússola para definir o ângulo (bearing).
- **Cálculo de Coordenadas:** Converte distância e ângulo para o sistema de coordenadas do Subnautica.
- **Mapa Dinâmico:** Carrega o mapa diretamente de uma coluna de anexos do Grist.
- **Calibração de Escala:** Clique em um ponto do mapa e informe a distância real para ajustar a escala automaticamente.
- **Calibração de Alinhamento:** Ajuste fino para alinhar a bússola e o mapa.
- **Integração com Grist:** Sincroniza a profundidade e a imagem do mapa com os registros selecionados.

## Como usar no Grist

1. Hospede estes arquivos em um servidor estático (ex: GitHub Pages).
2. No seu documento Grist, adicione um novo Widget do tipo **Custom**.
3. Nas configurações do Widget, cole a URL do `index.html` (ex: `https://seu-usuario.github.io/subnautica-map/index.html`).
4. Mapeie as colunas necessárias:
   - **Mapa:** Coluna de anexo contendo a imagem do mapa.
   - **Profundidade (Opcional):** Coluna numérica para exibir a profundidade atual.

## Estrutura do Projeto

- `index.html`: Estrutura principal e interface.
- `style.css`: Estilização (tema Subnautica).
- `script.js`: Lógica de navegação, desenho no canvas e API do Grist.

## Créditos

Desenvolvido para auxiliar exploradores de 4546B.
