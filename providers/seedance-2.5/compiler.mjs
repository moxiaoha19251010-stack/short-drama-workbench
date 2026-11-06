import { compile as compileGeneric } from "../generic-video/compiler.mjs";

export function compile(unit, context = {}) {
  const result = compileGeneric(unit, {
    ...context,
    provider: "seedance-2.5",
  });
  return {
    prompt: result.prompt,
    request: {
      ...result.request,
      provider: "seedance-2.5",
      notes: [
        "Seedance 2.5 首版为手动提示词包，参数能力待官方文档核实。",
        ...(result.request.notes || []),
      ],
    },
  };
}
