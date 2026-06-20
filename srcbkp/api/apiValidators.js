export function parseApiPayload(schema, payload, label = "payload") {
  const result = schema.safeParse(payload);
  if (result.success) return result.data;

  const details = result.error.issues
    .slice(0, 4)
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");

  const error = new Error(`Contrato inválido em ${label}: ${details}`);
  error.validationIssues = result.error.issues;
  error.payload = payload;
  throw error;
}
