/** BigInt -> string для JSON-ответов */
export function serialize<T>(data: T): any {
  return JSON.parse(JSON.stringify(data, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}
