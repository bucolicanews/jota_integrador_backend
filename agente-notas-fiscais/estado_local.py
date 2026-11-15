import sqlite3
from contextlib import contextmanager
from pathlib import Path

import config

_SQL_CRIAR_TABELA = """
create table if not exists arquivos_enviados (
  hash_sha256 text primary key,
  caminho text not null,
  enviado_em text not null default (datetime('now')),
  status_http integer
)
"""


def _conectar() -> sqlite3.Connection:
    config.CAMINHO_ESTADO.parent.mkdir(parents=True, exist_ok=True)
    conexao = sqlite3.connect(config.CAMINHO_ESTADO)
    conexao.execute(_SQL_CRIAR_TABELA)
    return conexao


@contextmanager
def _sessao():
    conexao = _conectar()
    try:
        yield conexao
        conexao.commit()
    finally:
        conexao.close()


def ja_enviado(hash_sha256: str) -> bool:
    with _sessao() as conexao:
        linha = conexao.execute(
            "select 1 from arquivos_enviados where hash_sha256 = ? and status_http in (200, 201)", (hash_sha256,)
        ).fetchone()
        return linha is not None


def marcar_enviado(hash_sha256: str, caminho: Path, status_http: int) -> None:
    with _sessao() as conexao:
        conexao.execute(
            "insert or replace into arquivos_enviados (hash_sha256, caminho, status_http) values (?, ?, ?)",
            (hash_sha256, str(caminho), status_http),
        )
