namespace BackendApi.Contracts;

public record CctDocumentosRequest();

public record CctDocumentosResponse(
    IReadOnlyCollection<CctDocumentoDto> Documentos
);

public record CctSalvarDocumentosRequest(
    IReadOnlyCollection<CctDocumentoDto> Documentos
);

public record CctDocumentoDto(
    string Id,
    string FileName,
    string? Label,
    string? Status,
    DateOnly? ValidFrom,
    DateOnly? ValidUntil,
    int? PageCount,
    int? TextChars,
    object? AnalysisResult
);

