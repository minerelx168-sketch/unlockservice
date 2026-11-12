// Regional identifiers from https://support.apple.com/en-us/108044.
// Canada/Japan and mainland China/Hong Kong are separate markets on some models.
type Variant = readonly [
  displayName: string, releaseYear: number, us: string, canada: string, japan: string,
  globalUkEu: string, chinaMainland: string, hongKong: string,
]

const variants: readonly Variant[] = [
  ["iPhone 16e",2025,"A3212","A3408","A3409","A3409","A3410","A3409"],
  ["iPhone 16 Pro Max",2024,"A3084","A3295","A3295","A3296","A3297","A3297"],
  ["iPhone 16 Pro",2024,"A3083","A3292","A3292","A3293","A3294","A3294"],
  ["iPhone 16 Plus",2024,"A3082","A3289","A3289","A3290","A3291","A3291"],
  ["iPhone 16",2024,"A3081","A3286","A3286","A3287","A3288","A3288"],
  ["iPhone 15 Pro Max",2023,"A2849","A3105","A3105","A3106","A3108","A3108"],
  ["iPhone 15 Pro",2023,"A2848","A3101","A3101","A3102","A3104","A3104"],
  ["iPhone 15 Plus",2023,"A2847","A3093","A3093","A3094","A3096","A3096"],
  ["iPhone 15",2023,"A2846","A3089","A3089","A3090","A3092","A3092"],
  ["iPhone 14 Pro Max",2022,"A2651","A2893","A2893","A2894","A2896","A2896"],
  ["iPhone 14 Pro",2022,"A2650","A2889","A2889","A2890","A2892","A2892"],
  ["iPhone 14 Plus",2022,"A2632","A2885","A2885","A2886","A2888","A2888"],
  ["iPhone 14",2022,"A2649","A2881","A2881","A2882","A2884","A2884"],
  ["iPhone SE (3rd generation)",2022,"A2595","A2595","A2782","A2783","A2785","A2783"],
  ["iPhone 13 Pro Max",2021,"A2484","A2641","A2641","A2643","A2644","A2644"],
  ["iPhone 13 Pro",2021,"A2483","A2636","A2636","A2638","A2639","A2639"],
  ["iPhone 13",2021,"A2482","A2631","A2631","A2633","A2634","A2634"],
  ["iPhone 13 mini",2021,"A2481","A2626","A2626","A2628","A2629","A2628"],
  ["iPhone 12 Pro Max",2020,"A2342","A2410","A2410","A2411","A2412","A2412"],
  ["iPhone 12 Pro",2020,"A2341","A2406","A2406","A2407","A2408","A2408"],
  ["iPhone 12",2020,"A2172","A2402","A2402","A2403","A2404","A2404"],
  ["iPhone 12 mini",2020,"A2176","A2398","A2398","A2399","A2400","A2399"],
  ["iPhone SE (2nd generation)",2020,"A2275","A2275","A2296","A2296","A2298","A2296"],
  ["iPhone 11 Pro",2019,"A2160","A2160","A2215","A2215","A2217","A2217"],
  ["iPhone 11 Pro Max",2019,"A2161","A2161","A2218","A2218","A2220","A2220"],
  ["iPhone 11",2019,"A2111","A2111","A2221","A2221","A2223","A2223"],
]

export const iphoneHardwareSpecs = variants.map(([displayName, releaseYear, us, canada, japan, globalUkEu, chinaMainland, hongKong]) => {
  const usEsimOnly = /^iPhone 1[456]/.test(displayName)
  const compact = displayName.includes('mini') || displayName.includes('SE')
  const sub6Only = displayName === 'iPhone 16e' || displayName.includes('3rd generation')
  const lteOnly = releaseYear === 2019 || displayName.includes('2nd generation')
  const mainlandSim = compact ? 'Single nano-SIM' : 'Dual physical nano-SIM'
  const internationalSim = 'Nano-SIM + eSIM'
  return {
    slug: displayName.toLowerCase().replace(/[()]/g, '').replaceAll(' ', '-'),
    displayName, releaseYear,
    modelNumbers: { us, canada, japan, globalUkEu, chinaMainland, hongKong },
    simArchitecture: {
      us: usEsimOnly ? 'Dual eSIM only; no SIM tray' : internationalSim,
      canada: internationalSim, japan: internationalSim, globalUkEu: internationalSim,
      chinaMainland: mainlandSim, hongKong: hongKong === chinaMainland ? mainlandSim : internationalSim,
    },
    fiveGBandsSummary: {
      us: lteOnly ? 'LTE; no 5G' : sub6Only ? 'Sub-6 GHz' : displayName.startsWith('iPhone 12') ? 'Sub-6 GHz and mmWave n260/n261' : 'Sub-6 GHz and mmWave n258/n260/n261',
      international: lteOnly ? 'LTE; no 5G' : 'Sub-6 GHz',
      roaming: 'Check the destination network’s bands and eSIM provisioning separately from carrier-lock eligibility.',
    },
    tacNote: 'The first eight IMEI digits identify the allocated device type. A TAC alone does not identify the locking network, confirm ownership or establish unlock eligibility.',
  }
})
