using BackendApi.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackendApi.Controllers;

[ApiController]
[Authorize]
[Route("api/cct")]
public class CctController : ControllerBase
{
    [HttpGet("documentos")]
    public ActionResult<CctDocumentosResponse> GetDocumentos([FromQuery] CctDocumentosRequest request)
    {
        return Ok(new CctDocumentosResponse(
            Documentos: Array.Empty<CctDocumentoDto>()
        ));
    }

    [HttpPost("documentos")]
    public ActionResult<CctDocumentosResponse> SalvarDocumentos([FromBody] CctSalvarDocumentosRequest request)
    {
        return Ok(new CctDocumentosResponse(
            Documentos: Array.Empty<CctDocumentoDto>()
        ));
    }
}

