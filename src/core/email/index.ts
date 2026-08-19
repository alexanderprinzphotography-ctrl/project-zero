import { BrevoProvider } from "./brevo-provider";
import type { EmailProvider } from "./provider";

const provider: EmailProvider = new BrevoProvider();

export function getEmailProvider(): EmailProvider {
  return provider;
}

export type { EmailAddress, EmailProvider, SendEmailResult, SendTransactionalInput } from "./provider";
