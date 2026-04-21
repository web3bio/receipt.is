/** EVM 交易哈希：0x + 64 个十六进制字符。 */
export const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

export function isValidTxHash(value: string): boolean {
  return TX_HASH_REGEX.test(value);
}
