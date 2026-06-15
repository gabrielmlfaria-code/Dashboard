namespace BackendApi.Contracts;

public record RadarPlaybookNotasRequest(
    string EventKey
);

public record RadarPlaybookNotasResponse(
    string EventKey,
    string? Juridico,
    string? Rh,
    string? ClausulaCct,
    DateTimeOffset? UpdatedAt,
    string? UpdatedBy
);

public record RadarPlaybookSalvarNotaRequest(
    string EventKey,
    string Area,
    string Text,
    string Author,
    string EventTitle
);

public record RadarPlaybookAuditoriaRequest(
    string? EventKey,
    int? Limit
);

public record RadarPlaybookAuditPageResponse(
    IReadOnlyCollection<RadarPlaybookAuditItemDto> Items
);

public record RadarPlaybookAuditItemDto(
    string Id,
    DateTimeOffset Ts,
    string Action,
    string Area,
    string EventKey,
    string? EventTitle,
    string? Author,
    string? Preview
);

