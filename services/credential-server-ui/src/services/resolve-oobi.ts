import axios from "axios";
import { config } from "../config";
import { httpInstance } from "./http";

export const resolveOobi = async (oobi: string) => {
  try {
    const response = await httpInstance.post(
      config.path.resolveOobi,
      { oobi },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error in resolveOobi function:", error);

    if (axios.isAxiosError(error) && error.response) {
      console.error(
        "Server responded with:",
        error.response.status,
        error.response.data
      );
    }

    throw error;
  }
};
