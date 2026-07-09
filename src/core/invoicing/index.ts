import type { InvoiceProvider } from "./provider";
import { SevdeskProvider } from "./sevdesk-provider";

export type IntegrationProviderKey = "sevdesk";

const providers: Record<IntegrationProviderKey, InvoiceProvider> = {
  sevdesk: new SevdeskProvider(),
};

export function getInvoiceProvider(provider: IntegrationProviderKey): InvoiceProvider {
  return providers[provider];
}

export type {
  ContactInput,
  InvoiceProvider,
  TestConnectionResult,
  UpsertContactResult,
} from "./provider";
