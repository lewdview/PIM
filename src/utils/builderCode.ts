// ERC-8021 builder-code attribution for Base.
// Appends a data suffix to transaction calldata so Base can attribute onchain
// activity to this app (builder rewards). Smart contracts ignore trailing
// calldata, so no contract changes are needed.
// Builder code issued for pim.th3scr1b3.art at https://dashboard.base.org.

const BUILDER_CODE =
  (import.meta.env.VITE_BASE_BUILDER_CODE as string | undefined)?.trim() ||
  'bc_ejq21epn';

// 16-byte marker: 0x8021 repeating (ERC-8021 schema 0 canonical marker)
const ERC_8021_MARKER = '8021'.repeat(8);

function stringToHex(value: string): string {
  let hex = '';
  for (let i = 0; i < value.length; i++) {
    hex += value.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}

function toBuilderDataSuffix(code: string): string {
  const codesHex = stringToHex(code);
  const byteLength = codesHex.length / 2;
  if (byteLength > 255) {
    throw new Error('Builder code is too long for ERC-8021 schema 0 encoding.');
  }
  const lengthHex = byteLength.toString(16).padStart(2, '0');
  // layout: codes ++ byte-length (1B) ++ schema-id (1B, 0) ++ marker (16B)
  return '0x' + codesHex + lengthHex + '00' + ERC_8021_MARKER;
}

/** Hex data suffix to append to transaction calldata (`tx.data + suffix`). */
export const BUILDER_DATA_SUFFIX = toBuilderDataSuffix(BUILDER_CODE);
