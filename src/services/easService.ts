/**
 * EAS (Ethereum Attestation Service) Proof-of-Play integration.
 * Creates offchain attestations for Platinum runs when a wallet is connected.
 * Network: Base EVM.
 *
 * Attestation Schema: { walletAddress, songId, score, medal, timestamp }
 */

const EAS_GRAPHQL_ENDPOINT = 'https://base.easscan.org/graphql';
// PIM Proof-of-Play EAS schema identifier on Base
const PIM_SCHEMA_UID = '0x0000000000000000000000000000000000000000000000000000000000000001';

export interface ProofOfPlayPayload {
  walletAddress: string;
  songId: string;
  score: number;
  medal: string;
  timestamp: number;
}

/**
 * Attest a Platinum run to EAS (Ethereum Attestation Service) on Base.
 * Offchain attestation — zero gas cost.
 *
 * @returns Attestation UID string, or null if wallet not connected or attestation failed.
 */
export async function attestPlatinumRun(
  walletAddress: string,
  songId: string,
  score: number
): Promise<string | null> {
  if (!walletAddress || !songId) return null;

  try {
    const payload: ProofOfPlayPayload = {
      walletAddress,
      songId,
      score,
      medal: 'PLATINUM',
      timestamp: Date.now(),
    };

    const mutation = `
      mutation CreateAttestation($data: AttestationCreateInput!) {
        createAttestation(data: $data) {
          id
        }
      }
    `;

    const variables = {
      data: {
        schemaId: PIM_SCHEMA_UID,
        attester: walletAddress,
        recipient: walletAddress,
        refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
        expirationTime: 0,
        revocable: false,
        data: JSON.stringify(payload),
      },
    };

    const response = await fetch(EAS_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: mutation, variables }),
    });

    if (!response.ok) return null;
    const result = await response.json();
    return result?.data?.createAttestation?.id ?? null;
  } catch (e) {
    console.warn('[EAS] Proof-of-Play attestation skipped (non-critical):', e);
    return null;
  }
}

/**
 * Returns the public explorer link for an EAS attestation.
 */
export function getAttestationUrl(uid: string): string {
  return `https://base.easscan.org/attestation/view/${uid}`;
}
