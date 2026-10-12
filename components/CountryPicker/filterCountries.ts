import { COUNTRIES, Country } from '@/constants/countries';

/** Countries whose name contains `query`, case-insensitively; all of them when empty. */
export const filterCountries = (query: string, countries: Country[] = COUNTRIES): Country[] => {
  if (!query) return countries;
  const needle = query.toLowerCase();
  return countries.filter(country => country.name.toLowerCase().includes(needle));
};
