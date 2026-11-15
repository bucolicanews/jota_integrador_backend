import logging
import time

import cliente_api
import config
import estado_local
import scanner

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("agente_notas_fiscais")


def ciclo() -> None:
    for pasta in (config.PASTA_ENTRADA, config.PASTA_SAIDA):
        if not pasta:
            continue
        for caminho, hash_sha256 in scanner.arquivos_novos(pasta):
            status = cliente_api.enviar_xml(caminho)
            estado_local.marcar_enviado(hash_sha256, caminho, status)


def main() -> None:
    if not config.TOKEN:
        logger.error(
            "token não configurado -- rode 'python gui.py' pra colar o token na tela (recomendado), "
            "ou copie config.exemplo.yaml para config.yaml e preencha à mão."
        )
        return

    logger.info(
        "agente iniciado -- entrada=%s saida=%s intervalo=%ss backend=%s",
        config.PASTA_ENTRADA, config.PASTA_SAIDA, config.INTERVALO_SEGUNDOS, config.URL_BACKEND,
    )
    while True:
        try:
            ciclo()
        except Exception:
            logger.exception("erro inesperado no ciclo -- tenta de novo no próximo")
        time.sleep(config.INTERVALO_SEGUNDOS)


if __name__ == "__main__":
    main()
