import logging
from pathlib import Path
from typing import Optional

import yaml

logger = logging.getLogger("agente_notas_fiscais.config")

BASE_DIR = Path(__file__).resolve().parent
CAMINHO_CONFIG = BASE_DIR / "config.yaml"
CAMINHO_ESTADO = BASE_DIR / "data" / "estado.db"

_PADRAO = {
    "token": "",
    "url_backend": "https://api.jotafiscal.com.br",
    "pasta_entrada": "",
    "pasta_saida": "",
    "intervalo_segundos": 30,
}

# Globais recarregáveis -- a GUI (gui.py) chama salvar() depois de editar os campos na
# tela, que grava o YAML e já atualiza estas variáveis de módulo na mesma chamada (outros
# módulos leem `config.TOKEN` etc. como atributo, não copiam valor no import, então a troca
# aparece pra eles no próximo uso sem precisar reiniciar o processo).
TOKEN: str = ""
URL_BACKEND: str = _PADRAO["url_backend"]
PASTA_ENTRADA: Optional[Path] = None
PASTA_SAIDA: Optional[Path] = None
INTERVALO_SEGUNDOS: float = 30.0


def _ler_arquivo() -> dict:
    if not CAMINHO_CONFIG.exists():
        return dict(_PADRAO)
    with open(CAMINHO_CONFIG, "r", encoding="utf-8") as arquivo:
        dados = yaml.safe_load(arquivo) or {}
    return {**_PADRAO, **dados}


def recarregar() -> None:
    """Relê config.yaml do disco e atualiza as globais do módulo -- chamado no import e depois de salvar() na GUI."""
    global TOKEN, URL_BACKEND, PASTA_ENTRADA, PASTA_SAIDA, INTERVALO_SEGUNDOS
    cfg = _ler_arquivo()
    TOKEN = cfg["token"]
    URL_BACKEND = str(cfg["url_backend"]).rstrip("/")
    PASTA_ENTRADA = Path(cfg["pasta_entrada"]) if cfg["pasta_entrada"] else None
    PASTA_SAIDA = Path(cfg["pasta_saida"]) if cfg["pasta_saida"] else None
    INTERVALO_SEGUNDOS = float(cfg["intervalo_segundos"])


def salvar(token: str, url_backend: str, pasta_entrada: str, pasta_saida: str, intervalo_segundos: float = 30) -> None:
    """Grava config.yaml (usado pela GUI) e recarrega as globais na mesma chamada."""
    with open(CAMINHO_CONFIG, "w", encoding="utf-8") as arquivo:
        yaml.safe_dump(
            {
                "token": token,
                "url_backend": url_backend,
                "pasta_entrada": pasta_entrada,
                "pasta_saida": pasta_saida,
                "intervalo_segundos": intervalo_segundos,
            },
            arquivo,
            allow_unicode=True,
        )
    recarregar()


if not CAMINHO_CONFIG.exists():
    logger.warning("config.yaml não encontrado em %s -- use a GUI (python gui.py) ou copie config.exemplo.yaml antes de rodar.", CAMINHO_CONFIG)
recarregar()
