import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { config } from "../../config";
import { Contact } from "../../pages/Connections/components/ConnectionsTable/ConnectionsTable.types";
import { Credential, PresentationRequestData } from "./connectionsSlice.types";
import { httpInstance } from "../../services/http";

interface ConnectionsState {
  contacts: Contact[];
  credentials: Credential[];
  presentationRequests: PresentationRequestData[];
  status: "idle" | "loading" | "succeeded" | "failed";
  error: string | null;
}

const initialState: ConnectionsState = {
  contacts: [],
  credentials: [],
  presentationRequests: [],
  status: "idle",
  error: null,
};

export const fetchContacts = createAsyncThunk(
  "connections/fetchContacts",
  async () => {
    const response = await httpInstance.get(config.path.contacts);
    return response.data.data;
  }
);

export const fetchContactCredentials = createAsyncThunk(
  "connections/fetchContactCredentials",
  async (contactId: string) => {
    const response = await httpInstance.get(
      config.path.contactCredentials,
      {
        params: { contactId },
      }
    );
    return { contactId, credentials: response.data.data };
  }
);

export const fetchPresentationRequests = createAsyncThunk(
  "connections/fetchPresentationRequests",
  async () => {
    const response = await httpInstance.get(config.path.presentationRequestsV2);
    const items = Array.isArray(response.data?.data) ? response.data.data : [];

    return items.map((item: Record<string, unknown>): PresentationRequestData => ({
      id: String(item.id || ""),
      requestExnSaid: String(item.requestExnSaid || ""),
      holderDid: String(item.holderDid || ""),
      schemaId: String(item.schemaId || ""),
      requestedAttributes:
        item.requestedAttributes &&
        typeof item.requestedAttributes === "object" &&
        !Array.isArray(item.requestedAttributes)
          ? Object.fromEntries(
              Object.entries(item.requestedAttributes as Record<string, unknown>).map(
                ([key, value]) => [key, String(value ?? "")]
              )
            )
          : {},
      requestDate: new Date(String(item.requestedAt || "")).getTime(),
      status: String(item.status || "requested") as PresentationRequestData["status"],
      presentedCredentialId: item.presentedCredentialId
        ? String(item.presentedCredentialId)
        : null,
      presentedIssuerDid: item.presentedIssuerDid
        ? String(item.presentedIssuerDid)
        : null,
      presentedHolderDid: item.presentedHolderDid
        ? String(item.presentedHolderDid)
        : null,
      presentedAttributes:
        item.presentedAttributes &&
        typeof item.presentedAttributes === "object" &&
        !Array.isArray(item.presentedAttributes)
          ? (item.presentedAttributes as Record<string, unknown>)
          : {},
      verificationChecks:
        item.verificationChecks &&
        typeof item.verificationChecks === "object" &&
        !Array.isArray(item.verificationChecks)
          ? Object.fromEntries(
              Object.entries(item.verificationChecks as Record<string, unknown>).map(
                ([key, value]) => [key, Boolean(value)]
              )
            )
          : {},
      failureReason: item.failureReason ? String(item.failureReason) : null,
      verifiedDate: item.verifiedAt
        ? new Date(String(item.verifiedAt)).getTime()
        : null,
      completedDate: item.completedAt
        ? new Date(String(item.completedAt)).getTime()
        : null,
    }));
  }
);

const connectionsSlice = createSlice({
  name: "connections",
  initialState,
  reducers: {
    savePresentationRequest: (
      state,
      action: PayloadAction<PresentationRequestData>
    ) => {
      state.presentationRequests.push(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchContacts.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchContacts.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.contacts = action.payload;
      })
      .addCase(fetchContacts.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message || null;
      })
      .addCase(fetchContactCredentials.fulfilled, (state, action) => {
        const { contactId, credentials } = action.payload;
        const currentCredentials = state.credentials.filter(
          (item) => item.contactId !== contactId
        );
        state.credentials = currentCredentials.concat(
          credentials.map((cred: Credential) => ({ ...cred, contactId }))
        );
      })
      .addCase(fetchPresentationRequests.fulfilled, (state, action) => {
        state.presentationRequests = action.payload;
      });
  },
});

export const { savePresentationRequest } = connectionsSlice.actions;

export default connectionsSlice.reducer;
