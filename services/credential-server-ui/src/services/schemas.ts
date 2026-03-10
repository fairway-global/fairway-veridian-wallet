import { config } from "../config";
import { httpInstance } from "./http";

const SchemaService = {
  getSchemas: async () => {
    return httpInstance.get(config.path.schemas);
  },
  getSchema: async (id: string) => {
    return httpInstance.get(config.path.schemaById.replace(":id", id));
  },
};

export { SchemaService };
