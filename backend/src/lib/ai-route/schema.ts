// JSON Schema for stop selection, used with Groq `json_schema` response format
// on models that support it. Written to satisfy strict mode: every property is
// required and every object sets additionalProperties: false.

export const SELECTION_SCHEMA_NAME = "route_stop_selection";

export function buildSelectionJsonSchema(allowedKeys: readonly string[]): Record<string, unknown> {
  if (allowedKeys.length === 0) throw new Error("allowedKeys must not be empty");
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "stops"],
    properties: {
      title: { type: "string" },
      stops: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "reasoning", "visitMinutes"],
          properties: {
            // The enum makes out-of-list ids impossible under constrained decoding.
            id: { type: "string", enum: [...allowedKeys] },
            reasoning: { type: "string" },
            visitMinutes: { type: "integer" },
          },
        },
      },
    },
  };
}
