using ImpactoSeisX1.Api.Application.Interfaces;
using ImpactoSeisX1.Api.Application.Services;
using ImpactoSeisX1.Api.Domain.Calculo;
using ImpactoSeisX1.Api.Endpoints;
using ImpactoSeisX1.Api.Infrastructure.Excel;
using ImpactoSeisX1.Api.Infrastructure.Http;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new()
    {
        Title = "ImpactoSeisX1 API",
        Version = "v1",
        Description = "Impacto financeiro e de conformidade da PEC que extingue a escala 6x1."
    });
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendDev", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddScoped<ImpactoCalculoService>();
builder.Services.AddScoped<IImpactoCalculoService, ImpactoCalculoServiceAdapter>();
builder.Services.AddScoped<IFuncionarioExcelService, FuncionarioExcelService>();
builder.Services.AddHttpClient<IFuncionarioJornadaApiClient, FuncionarioJornadaApiClient>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "ImpactoSeisX1 API v1");
    options.RoutePrefix = "swagger";
});

app.UseCors("FrontendDev");

app.MapGet("/api/health", () => Results.Ok(new
{
    nome = "ImpactoSeisX1",
    status = "ok",
    versao = "0.1.0"
}))
.WithName("HealthCheck")
.WithTags("Sistema");

app.MapImpactoEndpoints();

app.Run();
