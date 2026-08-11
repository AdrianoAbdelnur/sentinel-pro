export const CREDENTIAL_REF_PATTERN = /^vault:[a-z0-9]+\/[A-Za-z0-9_-]{1,100}$/;
const CREDENTIAL_REF_PROVIDER_PATTERN = /^vault:([a-z0-9]+)\//;

export function isCredentialRef(value: string): boolean {
  return CREDENTIAL_REF_PATTERN.test(value);
}

export function resolveCredentialRefProvider(credentialRef: string): string | undefined {
  return CREDENTIAL_REF_PROVIDER_PATTERN.exec(credentialRef)?.[1];
}

export function toCredentialRef(provider: string, reference: string): string {
  const candidate = `vault:${provider}/${reference}`;

  if (!isCredentialRef(candidate)) {
    throw new Error("Invalid credential reference");
  }

  return candidate;
}
