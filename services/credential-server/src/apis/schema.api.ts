import { Request, Response } from "express";
import { listAvailableSchemas } from "../services/dashboardStore";

export async function schemaApi(req: Request, res: Response) {
  const schemas = await listAvailableSchemas();

  res.status(200).send({
    success: true,
    data: schemas,
  });
}
