# apple-imei-utils
MIT-licensed TypeScript utilities with no runtime dependencies. Run npm install, npm test and npm pack in this directory.
```js
import {validateImeiLuhn,extractTac,decodeAppleModelNumber} from 'apple-imei-utils'
validateImeiLuhn('490154203237518') // true: arithmetic only
extractTac('490154203237518') // '49015420'; null for invalid input
decodeAppleModelNumber('MU683LL/A')?.region // 'United States'
```
Distribution prefixes and region suffixes are historical hints, not Apple certification. Unknown codes remain unknown. A checksum cannot authenticate a physical phone. These functions make no network calls and cannot return carrier lock, Next Tether Policy or a GSMA blacklist record.
- [Part numbers](https://iunlockmobile.com/tools/apple-model-number-decoder)
- [Carrier eligibility](https://iunlockmobile.com/tools/unlock-eligibility-calculator)
- [TAC and checksum](https://iunlockmobile.com/tools/imei-luhn-tac-validator)
- [eSIM and radio bands](https://iunlockmobile.com/tools/us-esim-band-compatibility-checker)
- [2026 carrier policy comparison](https://iunlockmobile.com/reports/2026-used-iphone-carrier-lock-report)
