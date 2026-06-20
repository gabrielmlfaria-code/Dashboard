declare module "*.jsx" {
  import type { ComponentType } from "react";

  const Component: ComponentType<Record<string, unknown>>;
  export default Component;
  export const PosicaoDiaPanel: ComponentType<Record<string, unknown>>;
}
declare module "*.js";
