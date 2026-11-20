# RTC Simples Nacional (RFB) -- build local

Serviço oficial da Receita Federal, sem imagem Docker publicada. Pra buildar a imagem local
usada no `docker-compose.yml` deste projeto:

```bash
mkdir -p rtc-build && cd rtc-build
git clone https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional.git
git clone https://github.com/ReceitaFederal/calculadora-rtc-regime-regular.git
docker build -t jota-rtc-simples-nacional -f ../docker/rtc-simples-nacional/Dockerfile .
```

O `docker-compose.yml` referencia a tag `jota-rtc-simples-nacional:latest` (ver serviço
`rtc-simples-nacional`) em vez de `build:` direto, porque o build precisa dos dois
repositórios RFB clonados fora deste repositório -- não versionamos código de terceiros aqui.

Atualizar a imagem: repetir o `git pull` nos dois clones + `docker build` de novo.
