using System.Text.Json.Serialization;

namespace ImpactoSeisX1.Api.Application.Dtos;

public sealed class FuncionarioJornadaApiDto
{
    [JsonPropertyName("nome")]
    public string? Nome { get; set; }

    [JsonPropertyName("departamento")]
    public string? Departamento { get; set; }

    [JsonPropertyName("tipoEscala")]
    public string? TipoEscala { get; set; }

    [JsonPropertyName("horasSemanais")]
    public decimal HorasSemanais { get; set; }

    [JsonPropertyName("salarioMensal")]
    public decimal SalarioMensal { get; set; }
}
