# APS em Foco

Painel estático para leitura local de relatórios agregados do SIAPS e acompanhamento de indicadores da Atenção Primária à Saúde.

## O que esta versão faz

- Lê no próprio navegador arquivos CSV de visão por equipe do SIAPS.
- Reconhece o CVAT — Relatório CVAT - Visão por Equipe.
- Reconhece o indicador C3 — Cuidado na Gestação e Puerpério.
- Confere o numerador, o denominador, a pontuação e a classificação do C3.
- Mostra contagens agregadas por boa prática e quantas pessoas ficaram sem registro computado no arquivo.
- Não envia os relatórios a um servidor, não usa banco de dados e não salva informações no navegador.

## Limites desta versão

O painel analisa totais da equipe. Ele não identifica pessoas individualmente nem confirma que uma prática está pendente para uma gestante específica. No C3, uma prática pode depender da idade gestacional ou do período puerperal. A equipe deve validar cada caso no prontuário.

Esta versão aceita CSV. Relatórios PDF e planilhas Excel ainda não são processados. Para gerar listas individuais, será necessário definir e validar arquivos nominais apropriados do PEC/SIAPS, com identificadores e eventos compatíveis. Não publique dados pessoais ou de saúde neste repositório.

Os CSVs fornecidos para orientar o desenvolvimento não foram incluídos no código nem no repositório.

## Regras do C3 implementadas

A versão atual segue a Nota Metodológica C3 do Ministério da Saúde: primeira consulta até a 12ª semana vale 10 pontos; cada uma das outras dez boas práticas vale 9 pontos. O painel calcula a soma dos pontos dividida pelo número de gestantes e puérperas vinculadas. A classificação exibida é Regular (até 25), Suficiente (acima de 25 até 50), Bom (acima de 50 até 75) e Ótimo (acima de 75 até 100).

Fonte oficial: [Nota Metodológica C3 — Ministério da Saúde](https://www.gov.br/saude/pt-br/composicao/saps/publicacoes/fichas-tecnicas/equipe-de-atencao-primaria-e-saude-da-familia/nota-metodologica-c3-cuidado-na-gestacao-e-puerperio).

## Publicar com GitHub Pages

O repositório precisa estar configurado para publicar a branch `main` na pasta raiz:

1. Abra **Settings → Pages** neste repositório.
2. Em **Build and deployment**, escolha **Deploy from a branch**.
3. Selecione a branch **main** e a pasta **/(root)**; salve.

O endereço esperado será:

`https://alexlima1315.github.io/SISTEMA-DE-ACOMPANHAMENTO-DOS-INDICADORES-DO-PEC-ESUS/`

O GitHub pode levar alguns minutos para publicar a primeira versão. A configuração de Pages é feita nas configurações do repositório e não altera os dados enviados ao painel.
