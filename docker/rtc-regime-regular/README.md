# RTC Regime Regular (RFB) -- build local

Serviço oficial da Receita Federal, sem imagem Docker publicada. Diferente do
simples-nacional, é autossuficiente (flyway/ próprio no repositório). Pra buildar a imagem
local usada no `docker-compose.yml` deste projeto:

```bash
mkdir -p rtc-build && cd rtc-build
git clone https://github.com/ReceitaFederal/calculadora-rtc-regime-regular.git
docker build -t jota-rtc-regime-regular -f ../docker/rtc-regime-regular/Dockerfile calculadora-rtc-regime-regular
```

O `docker-compose.yml` referencia a tag `jota-rtc-regime-regular:latest` em vez de `build:`
direto, mesmo motivo do rtc-simples-nacional: não versionamos código de terceiros aqui.

Atualizar a imagem: `git pull` no clone + `docker build` de novo.
