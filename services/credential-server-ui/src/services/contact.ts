import { config } from "../config";
import { httpInstance } from "./http";

const ContactService = {
  list: async () => {
    return httpInstance.get(config.path.contacts);
  },
  delete: async (contactId: string) => {
    return httpInstance.delete(`${config.path.deleteContact}?id=${contactId}`);
  },
};

export { ContactService };
