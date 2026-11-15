import logging
from pathlib import Path

import requests

import config

logger = logging.getLogger("agente_notas_fiscais.cliente_api")

TIMEOUT_SEGUNDOS = 30  # XML é pequeno, mas dá margem pra rede ruim


def enviar_xml(caminho: Path) -> int:
    """Sobe o XML cru pro endpoint de ingestão -- auth por Bearer (token da empresa, não usuário humano). Devolve o status HTTP (200/201 = sucesso, qualquer outro = tenta de novo no próximo ciclo)."""
    with open(caminho, "rb") as arquivo:
        try:
            resposta = requests.post(
                f"{config.URL_BACKEND}/notas-fiscais/ingestao",
                headers={"Authorization": f"Bearer {config.TOKEN}"},
                files={"arquivo": (caminho.name, arquivo, "application/xml")},
                timeout=TIMEOUT_SEGUNDOS,
            )
        except requests.RequestException:
            logger.warning("falha de rede ao enviar %s -- tenta de novo no próximo ciclo", caminho.name, exc_info=True)
            return 0

    if resposta.status_code == 401:
        logger.error("token rejeitado (401) -- gere um novo token em Notas Fiscais > Configurar no painel e atualize config.yaml")
    elif resposta.status_code >= 400:
        logger.warning("falha ao enviar %s: HTTP %s -- %s", caminho.name, resposta.status_code, resposta.text[:300])
    else:
        logger.info("%s enviado com sucesso (HTTP %s)", caminho.name, resposta.status_code)

    return resposta.status_code
