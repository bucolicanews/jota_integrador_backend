# Gerador DANFSe (RFB) -- build local

Diferente dos 2 calculadores RTC, este repositório **já tem Dockerfile oficial** (Go,
multi-stage, Alpine) -- não precisamos escrever um próprio, só clonar e buildar:

```bash
mkdir -p rtc-build && cd rtc-build
git clone https://github.com/ReceitaFederal/calculadora-rtc-gerador-danfse.git
docker build -t jota-rtc-gerador-danfse calculadora-rtc-gerador-danfse
```

Porta default do serviço: 8080 (dentro do container). O `docker-compose.yml` deste projeto
mapeia pra `8081` no host porque a 8080 já está ocupada pelo `rtc-regime-regular`.

Atualizar a imagem: `git pull` no clone + `docker build` de novo.
