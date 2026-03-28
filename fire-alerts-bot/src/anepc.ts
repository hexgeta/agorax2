/**
 * ANEPC (Autoridade Nacional de Emergência e Proteção Civil) data fetcher.
 *
 * Uses the same public endpoint that fogos.pt/fogosagora.pt uses to get
 * real-time fire/incident data from Portugal's civil protection system.
 */

const ANEPC_URL =
  'http://www.prociv.pt/_vti_bin/ARM.ANPC.UI/ANPC_SituacaoOperacional.svc/GetHistoryOccurrencesByLocation';

export interface AnepcIncident {
  id: string;
  number: string;
  dateTime: string;
  district: string;
  concelho: string;
  freguesia: string;
  locality: string;
  lat: number;
  lng: number;
  natureCode: string;
  natureShort: string;
  speciesShort: string;
  familyShort: string;
  statusId: number;
  statusName: string;
  personnel: number;
  terrainVehicles: number;
  aerialMeans: number;
  dico: string;
  sharepointId: string;
}

interface RawIncident {
  Numero: string;
  DataOcorrencia: string;
  Distrito: { Name: string };
  Concelho: { Name: string; DICO: string };
  Freguesia: { Name: string };
  Localidade: string;
  Latitude: string;
  Longitude: string;
  Natureza: {
    Codigo: string;
    NaturezaAbreviatura: string;
    EspecieAbreviatura: string;
    FamiliaAbreviatura: string;
  };
  EstadoOcorrencia: { ID: number; Name: string };
  NumeroOperacionaisTerrestresEnvolvidos: number;
  NumeroMeiosTerrestresEnvolvidos: number;
  NumeroMeiosAereosEnvolvidos: number;
  NumeroOperacionaisAereosEnvolvidos: number;
  ID: string;
}

function parseIncident(raw: RawIncident): AnepcIncident {
  return {
    id: raw.Numero,
    number: raw.Numero,
    dateTime: raw.DataOcorrencia,
    district: raw.Distrito?.Name ?? '',
    concelho: raw.Concelho?.Name ?? '',
    freguesia: raw.Freguesia?.Name ?? '',
    locality: raw.Localidade ?? '',
    lat: parseFloat(raw.Latitude) || 0,
    lng: parseFloat(raw.Longitude) || 0,
    natureCode: raw.Natureza?.Codigo ?? '',
    natureShort: raw.Natureza?.NaturezaAbreviatura ?? '',
    speciesShort: raw.Natureza?.EspecieAbreviatura ?? '',
    familyShort: raw.Natureza?.FamiliaAbreviatura ?? '',
    statusId: raw.EstadoOcorrencia?.ID ?? 0,
    statusName: raw.EstadoOcorrencia?.Name ?? '',
    personnel: (raw.NumeroOperacionaisTerrestresEnvolvidos ?? 0) + (raw.NumeroOperacionaisAereosEnvolvidos ?? 0),
    terrainVehicles: raw.NumeroMeiosTerrestresEnvolvidos ?? 0,
    aerialMeans: raw.NumeroMeiosAereosEnvolvidos ?? 0,
    dico: raw.Concelho?.DICO ?? '',
    sharepointId: raw.ID ?? '',
  };
}

/** Nature codes that represent fires (incêndios rurais / urbanos) */
const FIRE_NATURE_FAMILIES = ['Incêndios Rurais', 'Incêndios Urbanos'];

export function isFireIncident(incident: AnepcIncident): boolean {
  // Nature codes starting with 31xx are rural fires, 21xx are urban fires
  const code = incident.natureCode;
  if (code.startsWith('31') || code.startsWith('21')) return true;
  // Fallback: check the family abbreviation
  if (FIRE_NATURE_FAMILIES.some((f) => incident.familyShort.includes(f))) return true;
  return false;
}

export async function fetchActiveIncidents(): Promise<AnepcIncident[]> {
  const body = {
    allData: true,
    concelhoID: null,
    distritoID: null,
    forToday: false,
    freguesiaID: null,
    natureza: '0',
    pageIndex: 0,
    pageSize: 0,
  };

  const res = await fetch(ANEPC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'FireAlertsBot/1.0',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`ANEPC API returned ${res.status}: ${res.statusText}`);
  }

  const json = await res.json();
  const data: RawIncident[] =
    json?.GetHistoryOccurrencesByLocationResult?.ArrayInfo?.[0]?.Data ?? [];

  return data.map(parseIncident);
}
