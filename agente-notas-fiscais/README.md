# Agente de captura de notas fiscais -- JOTA FISCAL

Programa Python que roda na máquina do contador/empresa (onde o sistema emissor de nota
salva os XML), varre as pastas de entrada e saída configuradas, e envia cada XML novo pro
backend do JOTA FISCAL. O backend decide tudo (direção entrada/saída pelo CNPJ, duplicidade,
classificação tributária) -- este agente só lê arquivo e sobe, nunca decide nada.

## Instalação

```bash
cd agente-notas-fiscais
pip install -r requirements.txt
```

## Rodar (GUI -- recomendado, cola o token na tela)

```bash
python gui.py
```

1. No painel do JOTA FISCAL, abra **Notas Fiscais > Configurar > Agente local** e clique em
   **Gerar token do agente**. Copie o token (só aparece uma vez).
2. Na janela do agente, cole o token, escolha as pastas de entrada/saída (botão
   "Procurar...") e clique **▶ Ligar**. Isso grava `config.yaml` sozinho (nunca precisa
   editar o arquivo na mão) e começa a varrer as pastas -- o log na janela mostra cada XML
   enviado, erro de rede, ou token rejeitado.
3. **■ Parar** interrompe sem perder a configuração salva -- na próxima vez que abrir
   `gui.py`, os campos já vêm preenchidos.

## Rodar (linha de comando, sem janela)

```bash
copy config.exemplo.yaml config.yaml
```

Edite `config.yaml` à mão (token gerado no painel + `pasta_entrada`/`pasta_saida`), depois:

```bash
python main.py
```

Fica rodando em loop (varre as pastas a cada `intervalo_segundos`, 30s por padrão) até você
fechar a janela ou matar o processo. Mesmos logs de erro/token rejeitado da GUI.

Reenviar o agente (reinstalar, trocar de máquina) nunca duplica nota -- o backend também
rejeita XML já recebido pela chave de acesso, mesmo que o `data/estado.db` local (histórico
do que já foi enviado) seja perdido.

## Rodar sempre que o Windows iniciar (sem janela de console)

1. Crie um atalho apontando para:
   ```
   pythonw.exe "C:\caminho\completo\para\agente-notas-fiscais\main.py"
   ```
   (`pythonw.exe` em vez de `python.exe` -- não abre janela de console. Isso roda a versão
   sem GUI -- precisa já ter um `config.yaml` salvo antes, pela GUI ou editado à mão.)
2. Pressione `Win+R`, digite `shell:startup` e Enter -- abre a pasta de inicialização do
   usuário.
3. Cole o atalho criado no passo 1 ali dentro.

O agente passa a iniciar sozinho no login do Windows. Pra parar, use o Gerenciador de
Tarefas e finalize o processo `pythonw.exe` correspondente (ou revogue o token no painel --
o agente fica rodando mas toda tentativa de envio volta 401 e fica só registrando erro no log).
