import type { FearGreed } from '../types';

export async function fetchFearGreed(): Promise<FearGreed> {
  const res = await fetch('https://api.alternative.me/fng/?limit=30');
  if (!res.ok) throw new Error(`Fear&Greed ${res.status}`);
  const json = (await res.json()) as { data: { value: string; value_classification: string; timestamp: string }[] };
  return {
    value: parseInt(json.data[0].value, 10),
    label: json.data[0].value_classification,
    history: json.data.map((d) => ({ value: parseInt(d.value, 10), time: parseInt(d.timestamp, 10) })).reverse(),
  };
}
