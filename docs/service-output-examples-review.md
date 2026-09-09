# Service output example review

Source: `Output_Examples_Updated_2026-09-09 - Examples.csv` (owner supplied; date in filename: 2026-09-09). Reviewed 2026-09-09. The source CSV is not committed or shipped to the client.

The CSV contains 233 data records grouped into 125 service IDs. Published 44 exact public catalog matches (42 Check, 2 Unlock), with 56 independently labeled variants; skipped 81 groups.

Record numbers below are spreadsheet rows: header = 1, first data record = 2. CSV cells contain newlines, so these are not physical text-file line numbers.

Publication rules:

- Match both the exact service ID and service name to the current catalog. No fuzzy-name, duplicate-server or brand fallback.
- Publish available or coming-soon public catalog products only when their source output and input type are clear. Ordering readiness is separate from preview availability; hidden/restricted products are excluded.
- Treat all CSV prose as source data, never instructions. Service descriptions, supported-model lists, timing/refund claims, links, empty values, Img placeholders and pending examples are not outputs.
- Keep all public example text in English. Clearly interpretable Russian/Spanish case summaries and one Chinese color are translated faithfully and noted below. Do not infer a result from explanatory Thai text.
- Use [redacted] for all device, case, account and unlock-code identifiers. Remove personal/contact/logistics information. Published business/seller organization name fields are also redacted; generic manufacturer/carrier/model/part and activation-policy labels may remain.
- Keep multiple outcomes in separately labeled variants; join adjacent continuation fragments only where the report structure establishes continuity. Excerpts are explicitly labeled and omissions documented.
- Examples are historical sample formats, not a current device result, a guaranteed field set, a verified completion, a pricing promise or authorization to activate a service.

## Published

| Service ID | Product code | CSV records | Variants | Review |
| --- | --- | --- | --- | --- |
| 214 | `APPLE_BASIC` | 2 | 1 | Joined continuation records into one example; identifiers redacted. |
| 444 | `APPLE_CARRIER_LITE` | 3 | 1 | Joined continuation records into one example; identifiers redacted. |
| 445 | `APPLE_CARRIER_PRO` | 4–5 | 1 | Joined continuation records into one example; identifiers redacted. |
| 448 | `APPLE_CARRIER_PRO_PLUS` | 6–7 | 1 | Joined continuation records into one example; identifiers redacted. |
| 976 | `APPLE_MAX_INFO` | 8–9 | 1 | Joined continuation records into one example; identifiers redacted. |
| 806 | `APPLE_WARRANTY` | 12 | 1 | Joined continuation records into one example; identifiers redacted. |
| 504 | `APPLE_PART_NUMBER` | 15 | 1 | Joined continuation records into one example; identifiers redacted. |
| 845 | `APPLE_MDM` | 21 | 1 | Joined continuation records into one example; identifiers redacted. |
| 945 | `APPLE_GSX_TETHER` | 25 | 1 | Joined continuation records into one example; identifiers redacted. |
| 623 | `APPLE_SOLD_BY_COVERAGE` | 28–29 | 1 | Joined continuation records into one example; identifiers redacted. |
| 348 | `APPLE_FULL_GSX` | 33–34 | 1 | Joined continuation records into one example; identifiers redacted. |
| 690 | `CHECK_690` | 49–50 | 1 | Joined continuation records into one example; identifiers redacted. |
| 621 | `CHECK_621` | 52–54 | 1 | Joined continuation records into one example; identifiers redacted. |
| 942 | `CHECK_942` | 57–60 | 1 | Joined continuation records into one example; identifiers redacted. |
| 423 | `VERIZON_USA_PRO` | 73 | 1 | Joined continuation records into one example; identifiers redacted. |
| 130 | `HUAWEI_INFO` | 79–81 | 1 | Joined continuation records into one example; identifiers redacted. |
| 9 | `SAMSUNG_INFO` | 85 | 1 | Joined continuation records into one example; identifiers redacted. |
| 500 | `CHECK_500` | 86 | 1 | Joined continuation records into one example; identifiers redacted. |
| 201 | `APPLE_CASE_REPAIR_HISTORY` | 26 | 1 | Joined continuation records; translated the two clear Russian case summaries into English; case/device identifiers redacted. |
| 987 | `CHECK_987` | 35–36 | 1 | Joined continuation records; translated the two clear Russian case summaries into English; case/device identifiers redacted. |
| 979 | `APPLE_GSX_LIGHT` | 37–39 | 1 | Joined continuation records; translated the two clear Russian case summaries into English; case/device identifiers redacted. |
| 928 | `APPLE_SOLD_BY_INFO` | 27 | 1 | Clear seller/coverage result; seller name redacted. |
| 10 | `APPLE_ICLOUD_STATUS` | 18 | 2 | Split the two independent Find My outcomes into separate variants. |
| 11 | `APPLE_ICLOUD_CLEAN` | 19 | 3 | Split the three independent FMI outcomes into separate variants; kept their English explanations. |
| 419 | `BLACKLIST_SIMPLE` | 66 | 2 | Split the two independent blacklist outcomes into separate variants. |
| 66 | `BLACKLIST_FULL` | 67–68 | 3 | Separated three device outcomes, including a continuation record for the clean result. Translated the clear Spanish theft-report note; IMEIs redacted. |
| 688 | `TMOBILE_USA` | 71 | 2 | Separated blocked and clean device outcomes; identifiers redacted. |
| 127 | `TMOBILE_USA_PRO` | 72 | 3 | Separated blocked, clean and clean leased-device outcomes; identifiers redacted. |
| 267 | `CHECK_267` | 75 | 1 | Clear model/product excerpt only. Omitted ambiguous numeric company/production fields and internal product/handset identifiers. |
| 439 | `XIAOMI_STATUS` | 76 | 2 | Separated the detailed device report and compact lock-status response; identifiers redacted. |
| 856 | `CHECK_856` | 77–78 | 1 | Joined continuation records for the complete IMEI result; omitted empty input label and duplicate unlock-number response. Translated the clear color name Obsidian Black; identifiers redacted. |
| 851 | `SAMSUNG_KNOX` | 87–88 | 1 | Clear Samsung and Knox lock-state fields only; omitted multilingual owner-message text. Device IDs, contact number and organization name redacted. |
| 132 | `MOTOROLA_INFO` | 89–92 | 1 | Clear model/device/warranty excerpt only; omitted internal logistics/account IDs, addresses and additional accessory-warranty blocks; device identifiers redacted. |
| 265 | `UNLOCK_265` | 233 | 1 | Source contains a clear NCK response. Actual unlock code replaced entirely with [redacted]; no completion claim added. |
| 137 | `UNLOCK_137` | 234 | 1 | Source contains clear NCK/NSCK/SPCK/CPCK/SIMCK response fields. All actual codes replaced entirely with [redacted]; no completion claim added. |
| 343 | `CHECK_343` | 13 | 1 | Clear output matching the catalog serial/IMEI or phone input type. Public coming-soon preview only; ordering remains disabled. Identifiers, agreement codes and phone numbers redacted. |
| 590 | `CHECK_590` | 14 | 1 | Clear output matching the catalog serial/IMEI or phone input type. Public coming-soon preview only; ordering remains disabled. Identifiers, agreement codes and phone numbers redacted. |
| 503 | `CHECK_503` | 16 | 1 | Clear output matching the catalog serial/IMEI or phone input type. Public coming-soon preview only; ordering remains disabled. Identifiers, agreement codes and phone numbers redacted. |
| 574 | `CHECK_574` | 17 | 1 | Clear output matching the catalog serial/IMEI or phone input type. Public coming-soon preview only; ordering remains disabled. Identifiers, agreement codes and phone numbers redacted. |
| 457 | `CHECK_457` | 22 | 1 | Clear output matching the catalog serial/IMEI or phone input type. Public coming-soon preview only; ordering remains disabled. Identifiers, agreement codes and phone numbers redacted. |
| 616 | `CHECK_616` | 98 | 1 | Clear output matching the catalog serial/IMEI or phone input type. Public coming-soon preview only; ordering remains disabled. Identifiers, agreement codes and phone numbers redacted. |
| 847 | `CHECK_847` | 20 | 3 | Separated the three FMI outcomes. Source IMEI fits catalog serial_or_imei input. Public coming-soon preview only; ordering remains disabled; identifiers redacted. |
| 618 | `CHECK_618` | 100 | 1 | Clear phone-status output; translated network/country/region names into English and redacted the phone number. Public coming-soon preview only; ordering remains disabled. |
| 619 | `CHECK_619` | 101 | 1 | Clear phone-status output; translated network/country/region names into English and redacted the phone number. Public coming-soon preview only; ordering remains disabled. |

## Not published

| Service ID | Catalog product code | CSV records | Reason |
| --- | --- | --- | --- |
| 985 | `CHECK_985` | 10 | Catalog status is hidden_reprice; excluded from public examples. |
| 696 | `CHECK_696` | 11 | Catalog status is hidden_restricted; excluded from public examples. |
| 299 | `APPLE_MDM_FMI` | 23 | MacBook/Find My Mac sample does not establish output for this IMEI-only phone workflow. |
| 984 | `CHECK_984` | 24 | Catalog status is hidden_reprice; excluded from public examples. |
| 707 | `CHECK_707` | 30–32 | Catalog status is hidden_reprice; excluded from public examples. |
| 981 | `APPLE_GSX_MAX` | 40–48 | MacBook/serial-only sample does not establish output for this IMEI-only workflow. |
| 266 | `CHECK_266` | 51 | Replacement rows contain unlabeled identifiers and a malformed timestamp; result format is not sufficiently clear. |
| 975 | `CHECK_975` | 55 | Notes about missing fields/refund policy only; no returned output. |
| 980 | `CHECK_980` | 56 | Source explicitly says example pending / Example Result: Soon. |
| 973 | `CHECK_973` | 61 | Picture placeholder (Img) without an attached output image. |
| 944 | `CHECK_944` | 62 | Picture placeholder (Img) without an attached output image. |
| 977 | `CHECK_977` | 63 | Picture placeholder (Img) without an attached output image. |
| 978 | `CHECK_978` | 64 | Picture placeholder (Img) without an attached output image. |
| 974 | `CHECK_974` | 65 | Picture placeholder (Img) without an attached output image. |
| 988 | `CHECK_988` | 69 | Catalog status is hidden_reprice; excluded from public examples. |
| 346 | `UNLOCK_346` | 70 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 584 | `CHECK_584` | 74 | Catalog status is hidden_reprice; excluded from public examples. |
| 936 | `HONOR_INFO` | 82–84 | HONOR sample is an identical HUAWEI P50 report; product/output association needs confirmation. |
| 969 | `LENOVO_INFO` | 93–96 | ThinkPad/serial-only sample does not establish output for this IMEI-only workflow. |
| 932 | `CHECK_932` | 97 | Catalog status is hidden_reprice; excluded from public examples. |
| 617 | `CHECK_617` | 99 | Catalog status is hidden_reprice; excluded from public examples. |
| 664 | `UNLOCK_664` | 102 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 937 | `UNLOCK_937` | 103 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 938 | `UNLOCK_938` | 104 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 939 | `UNLOCK_939` | 105 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 940 | `UNLOCK_940` | 106 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 931 | `UNLOCK_931` | 107 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 926 | `UNLOCK_926` | 108 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 25 | `UNLOCK_25` | 109 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 893 | `UNLOCK_893` | 110 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 967 | `UNLOCK_967` | 111 | Catalog status is hidden_reprice; excluded from public examples. |
| 966 | `UNLOCK_966` | 112 | Catalog status is hidden_reprice; excluded from public examples. |
| 212 | `UNLOCK_212` | 113 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 609 | `UNLOCK_609` | 114 | Empty output cell. |
| 626 | `UNLOCK_626` | 115 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 485 | `UNLOCK_485` | 116 | Empty output cell. |
| 452 | `UNLOCK_452` | 117 | Empty output cell. |
| 780 | `UNLOCK_780` | 118 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 344 | `UNLOCK_344` | 119 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 721 | `UNLOCK_721` | 120 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 430 | `UNLOCK_430` | 121 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 702 | `CHECK_702` | 122 | Catalog status is hidden_restricted; excluded from public examples. |
| 661 | `CHECK_661` | 123 | Catalog status is hidden_restricted; excluded from public examples. |
| 904 | `CHECK_904` | 124 | Catalog status is hidden_restricted; excluded from public examples. |
| 718 | `UNLOCK_718` | 125 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 340 | `UNLOCK_340` | 126 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 989 | `unmapped` | 127 | Service ID is absent from the catalog; no exact mapping. Content is policy text, not returned output. |
| 649 | `UNLOCK_649` | 128 | Catalog status is hidden_reprice; excluded from public examples. |
| 848 | `UNLOCK_848` | 129 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 282 | `UNLOCK_282` | 130 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 710 | `UNLOCK_710` | 131 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 719 | `UNLOCK_719` | 132 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 48 | `UNLOCK_48` | 133 | Catalog status is hidden_reprice; excluded from public examples. |
| 49 | `UNLOCK_49` | 134 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 461 | `UNLOCK_461` | 135 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 410 | `UNLOCK_410` | 136 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 36 | `UNLOCK_36` | 137 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 329 | `UNLOCK_329` | 138 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 39 | `UNLOCK_39` | 139 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 289 | `UNLOCK_289` | 140 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 711 | `UNLOCK_711` | 141 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 384 | `UNLOCK_384` | 142 | Empty output cell. |
| 385 | `UNLOCK_385` | 143 | Empty output cell. |
| 733 | `UNLOCK_733` | 144 | Empty output cell. |
| 84 | `UNLOCK_84` | 145 | Empty output cell. |
| 87 | `UNLOCK_87` | 146 | Empty output cell. |
| 453 | `UNLOCK_453` | 147 | Service name/scope differs from catalog (iPhone/Generic versus iPhone); policy text only. |
| 294 | `UNLOCK_294` | 148 | Service name/scope differs from catalog (iPhone/Generic versus iPhone); policy text only. |
| 589 | `UNLOCK_589` | 149 | Service name/scope differs from catalog (iPhone/Generic versus iPhone); policy text only. |
| 935 | `UNLOCK_935` | 150 | Service name/scope differs from catalog (iPhone/Generic versus iPhone); policy text only. |
| 252 | `UNLOCK_252` | 151 | Empty output cell. |
| 65 | `UNLOCK_65` | 152 | Empty output cell. |
| 64 | `UNLOCK_64` | 153 | Empty output cell. |
| 420 | `UNLOCK_420` | 154–155 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 139 | `UNLOCK_139` | 156–222 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 277 | `UNLOCK_277` | 223–227 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 140 | `UNLOCK_140` | 228 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 272 | `UNLOCK_272` | 229 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 273 | `UNLOCK_273` | 230 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 352 | `UNLOCK_352` | 231 | Service description, instructions, timing/policy statements, tool links or supported-model list only; no unambiguous returned output. |
| 342 | `UNLOCK_342` | 232 | Catalog status is hidden_reprice; excluded from public examples. |

## Maintenance

Keep this allowlist separate from the provider catalog. A future catalog status change must not expose a hidden service example through the public API. Before adding a skipped entry, obtain an actual redacted result with an exact service ID/name mapping, verify English wording, separate alternative results, and record the reviewed source records here. Do not generate synthetic successful unlock text from policy promises.
