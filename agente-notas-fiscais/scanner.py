import hashlib
import logging
from pathlib import Path
from typing import Iterator, Tuple

import estado_local

logger = logging.getLogger("agente_notas_fiscais.scanner")


def _hash_arquivo(caminho: Path) -> str:
    sha256 = hashlib.sha256()
    with open(caminho, "rb") as arquivo:
        for bloco in iter(lambda: arquivo.read(65536), b""):
            sha256.update(bloco)
    return sha256.hexdigest()


def arquivos_novos(pasta: Path) -> Iterator[Tuple[Path, str]]:
    """Varre a pasta por *.xml e devolve (caminho, hash) só dos que ainda não foram enviados com sucesso -- nunca reenvia hash já confirmado 200 (ver estado_local.ja_enviado)."""
    if not pasta or not pasta.is_dir():
        logger.warning("pasta %s não existe ou não é um diretório -- pulando", pasta)
        return
    for caminho in sorted(pasta.glob("*.xml")):
        try:
            hash_sha256 = _hash_arquivo(caminho)
        except OSError:
            logger.warning("falha ao ler %s (arquivo em uso/sendo gravado?) -- tenta de novo no próximo ciclo", caminho, exc_info=True)
            continue
        if estado_local.ja_enviado(hash_sha256):
            continue
        yield caminho, hash_sha256
