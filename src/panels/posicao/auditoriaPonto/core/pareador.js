export function parearHorarios(horariosPlanejados = [], marcacoes = [], parametros = {}) {
  const janela = Number(parametros.janelaPareamentoMaxMinutos || 180);
  const used = new Set();
  const result = [];

  horariosPlanejados.forEach((horario, posicao) => {
    const candidates = marcacoes
      .map((marcacao, index) => ({
        index,
        marcacao,
        distancia: Math.abs(marcacao.minutes - horario.minutes),
      }))
      .filter((item) => !used.has(item.index) && item.distancia <= janela)
      .sort((a, b) => a.distancia - b.distancia);

    if (!candidates.length) {
      result.push({
        posicao,
        horarioPrevisto: horario,
        marcacaoEncontrada: null,
        desvioMinutos: null,
        status: "AUSENTE",
      });
      return;
    }

    if (candidates.length > 1 && Math.abs(candidates[0].distancia - candidates[1].distancia) < 1) {
      result.push({
        posicao,
        horarioPrevisto: horario,
        marcacaoEncontrada: candidates[0].marcacao,
        desvioMinutos: candidates[0].marcacao.minutes - horario.minutes,
        status: "AMBIGUO",
      });
      used.add(candidates[0].index);
      return;
    }

    result.push({
      posicao,
      horarioPrevisto: horario,
      marcacaoEncontrada: candidates[0].marcacao,
      desvioMinutos: candidates[0].marcacao.minutes - horario.minutes,
      status: "PAREADO",
    });
    used.add(candidates[0].index);
  });

  marcacoes.forEach((marcacao, index) => {
    if (!used.has(index)) {
      result.push({
        posicao: null,
        horarioPrevisto: null,
        marcacaoEncontrada: marcacao,
        desvioMinutos: null,
        status: "EXCEDENTE",
      });
    }
  });

  return result;
}
