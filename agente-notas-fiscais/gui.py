"""Janela mínima (Tkinter, nativo do Python) pro contador/empresa colar o token sem
precisar editar config.yaml na mão -- mesmo padrão do print-agent (gui.py), adaptado:
aqui não tem impressora pra detectar, só as duas pastas (entrada/saída) e o loop de
varredura/envio de main.ciclo().
"""
import logging
import queue
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

import config
import main as agente_main

INTERVALO_PADRAO_SEG = 30


class HandlerFila(logging.Handler):
    """Encaminha todo log do agente (scanner/cliente_api/main) pra fila que a GUI drena -- não muda nenhum desses módulos, só escuta."""

    def __init__(self, fila: "queue.Queue[str]") -> None:
        super().__init__()
        self.fila = fila

    def emit(self, record: logging.LogRecord) -> None:
        self.fila.put(self.format(record))


class AgenteGUI:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("JOTA FISCAL -- Agente de Notas Fiscais")
        self.root.geometry("520x480")
        self.root.protocol("WM_DELETE_WINDOW", self._fechar)

        self.rodando = False
        self.fila_log: "queue.Queue[str]" = queue.Queue()

        self._montar_widgets()
        self._ligar_captura_de_log()
        self._carregar_config_existente()
        self.root.after(200, self._drenar_log)

    def _montar_widgets(self) -> None:
        frame = ttk.Frame(self.root, padding=12)
        frame.pack(fill=tk.BOTH, expand=True)

        ttk.Label(frame, text="Token do agente").pack(anchor="w")
        self.token_var = tk.StringVar()
        ttk.Entry(frame, textvariable=self.token_var, show="•").pack(fill=tk.X, pady=(0, 8))
        ttk.Label(
            frame,
            text='Gere em "Notas Fiscais > Configurar > Agente local" no painel -- aparece em claro só uma vez.',
            foreground="#71717A",
            wraplength=480,
            justify=tk.LEFT,
        ).pack(anchor="w", pady=(0, 8))

        ttk.Label(frame, text="URL do backend").pack(anchor="w")
        self.backend_url_var = tk.StringVar(value=config.URL_BACKEND)
        ttk.Entry(frame, textvariable=self.backend_url_var).pack(fill=tk.X, pady=(0, 8))

        self._campo_pasta(frame, "Pasta de entrada (compras)", "pasta_entrada_var")
        self._campo_pasta(frame, "Pasta de saída (vendas)", "pasta_saida_var")

        self.status_var = tk.StringVar(value="Parado")
        ttk.Label(frame, textvariable=self.status_var, foreground="#B91C1C").pack(anchor="w", pady=(4, 8))

        botoes = ttk.Frame(frame)
        botoes.pack(fill=tk.X, pady=(0, 8))
        self.btn_ligar = ttk.Button(botoes, text="▶ Ligar", command=self._ligar)
        self.btn_ligar.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=(0, 4))
        self.btn_parar = ttk.Button(botoes, text="■ Parar", command=self._parar, state="disabled")
        self.btn_parar.pack(side=tk.LEFT, expand=True, fill=tk.X)

        ttk.Label(frame, text="Log:").pack(anchor="w")
        self.log_text = tk.Text(frame, height=12, state="disabled")
        self.log_text.pack(fill=tk.BOTH, expand=True)

    def _campo_pasta(self, frame: ttk.Frame, rotulo: str, nome_var: str) -> None:
        ttk.Label(frame, text=rotulo).pack(anchor="w")
        linha = ttk.Frame(frame)
        linha.pack(fill=tk.X, pady=(0, 8))
        variavel = tk.StringVar()
        setattr(self, nome_var, variavel)
        ttk.Entry(linha, textvariable=variavel).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 4))
        ttk.Button(linha, text="Procurar...", command=lambda: self._escolher_pasta(variavel)).pack(side=tk.LEFT)

    def _escolher_pasta(self, variavel: tk.StringVar) -> None:
        pasta = filedialog.askdirectory()
        if pasta:
            variavel.set(pasta)

    def _ligar_captura_de_log(self) -> None:
        handler = HandlerFila(self.fila_log)
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s: %(message)s", datefmt="%H:%M:%S"))
        logging.getLogger("agente_notas_fiscais").addHandler(handler)
        logging.getLogger("agente_notas_fiscais").setLevel(logging.INFO)

    def _carregar_config_existente(self) -> None:
        self.token_var.set(config.TOKEN)
        self.backend_url_var.set(config.URL_BACKEND)
        self.pasta_entrada_var.set(str(config.PASTA_ENTRADA) if config.PASTA_ENTRADA else "")
        self.pasta_saida_var.set(str(config.PASTA_SAIDA) if config.PASTA_SAIDA else "")

    def _log(self, mensagem: str) -> None:
        self.fila_log.put(mensagem)

    def _drenar_log(self) -> None:
        while not self.fila_log.empty():
            mensagem = self.fila_log.get()
            self.log_text.configure(state="normal")
            self.log_text.insert(tk.END, mensagem + "\n")
            self.log_text.see(tk.END)
            self.log_text.configure(state="disabled")
        self.root.after(200, self._drenar_log)

    def _ligar(self) -> None:
        if self.rodando:
            return

        token = self.token_var.get().strip()
        pasta_entrada = self.pasta_entrada_var.get().strip()
        pasta_saida = self.pasta_saida_var.get().strip()

        if not token:
            messagebox.showwarning("Token vazio", 'Cole o token gerado em "Notas Fiscais > Configurar > Agente local" no painel.')
            return
        if not pasta_entrada and not pasta_saida:
            messagebox.showwarning("Pasta não configurada", "Informe ao menos uma pasta (entrada ou saída).")
            return

        config.salvar(token, self.backend_url_var.get().strip(), pasta_entrada, pasta_saida, INTERVALO_PADRAO_SEG)

        self.rodando = True
        self.btn_ligar.configure(state="disabled")
        self.btn_parar.configure(state="normal")
        self.status_var.set("Rodando")
        self._log("Agente ligado -- varrendo as pastas configuradas.")
        threading.Thread(target=self._loop, daemon=True).start()

    def _parar(self) -> None:
        self.rodando = False
        self.btn_ligar.configure(state="normal")
        self.btn_parar.configure(state="disabled")
        self.status_var.set("Parado")
        self._log("Agente parado pelo usuário.")

    def _loop(self) -> None:
        while self.rodando:
            try:
                agente_main.ciclo()
            except Exception as exc:  # noqa: BLE001 -- nunca mata a thread por um erro de ciclo
                self._log(f"Erro inesperado no ciclo: {exc}")
            for _ in range(int(config.INTERVALO_SEGUNDOS * 10)):
                if not self.rodando:
                    break
                threading.Event().wait(0.1)

    def _fechar(self) -> None:
        self.rodando = False
        self.root.destroy()


def main() -> None:
    root = tk.Tk()
    AgenteGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
