# DataForSEO response fixtures

Real responses from DataForSEO's free sandbox (`https://sandbox.dataforseo.com`),
trimmed to a few rows each. The sandbox returns dummy values in exactly the
live API's structure, so these pin the shapes the market-data tools parse.
They're what `test/unit/domains/market-data.test.ts` feeds the tools.

To refresh: point `DATAFORSEO_BASE_URL` at the sandbox (free, same
credentials) and re-save the endpoint's response.
