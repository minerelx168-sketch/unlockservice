import Image from 'next/image'
import type { CSSProperties } from 'react'

// Local marks only: no visitor requests to a logo CDN or carrier domain.
const MARKS: Record<string, { src: string; vector: boolean }> = {
  "AT&T": { src: "/brand-marks/atandt.svg", vector: true },
  "T-Mobile": { src: "/brand-marks/tmobile.svg", vector: true },
  "Verizon": { src: "/brand-marks/verizon.svg", vector: true },
  "Boost Mobile": { src: "/brand-marks/boost.svg", vector: true },
  "O2": { src: "/brand-marks/o2.svg", vector: true },
  "Vodafone": { src: "/brand-marks/vodafone.svg", vector: true },
  "Tesco Mobile": { src: "/brand-marks/tesco.svg", vector: true },
  "Apple": { src: "/brand-marks/apple.svg", vector: true },
  "Samsung": { src: "/brand-marks/samsung.svg", vector: true },
  "Google": { src: "/brand-marks/google.svg", vector: true },
  "Motorola": { src: "/brand-marks/motorola.svg", vector: true },
  "OnePlus": { src: "/brand-marks/oneplus.svg", vector: true },
  "Xiaomi": { src: "/brand-marks/xiaomi.svg", vector: true },
  "Sony": { src: "/brand-marks/sony.svg", vector: true },
  "Nokia": { src: "/brand-marks/nokia.svg", vector: true },
  "Honor": { src: "/brand-marks/honor.svg", vector: true },
  "Huawei": { src: "/brand-marks/huawei.svg", vector: true },
  "EE": { src: "/brand-marks/ee.png", vector: false },
  "Metro by T-Mobile": { src: "/brand-marks/metrobyt-mobile.png", vector: false },
  "Cricket Wireless": { src: "/brand-marks/cricketwireless.png", vector: false },
  "US Cellular": { src: "/brand-marks/uscellular.png", vector: false },
  "Dish": { src: "/brand-marks/dish.png", vector: false },
  "Three": { src: "/brand-marks/three.png", vector: false },
  "Rogers": { src: "/brand-marks/rogers.png", vector: false },
  "Bell": { src: "/brand-marks/bell.png", vector: false },
  "Freedom Mobile": { src: "/brand-marks/freedommobile.png", vector: false },
  "Fido": { src: "/brand-marks/fido.png", vector: false },
  "Telstra": { src: "/brand-marks/telstra.png", vector: false },
  "Optus": { src: "/brand-marks/optus.png", vector: false },
  "Telus": { src: "/brand-marks/telus.png", vector: false },
}

export function BrandLogo({ name }: { name: string }) {
  const mark = MARKS[name]
  if (!mark) return null
  if (mark.vector) {
    return <span className="brand-mark brand-mark--vector" aria-hidden="true"
      style={{ '--brand-mark': `url("${mark.src}")` } as CSSProperties} />
  }
  return <Image className="brand-mark brand-mark--raster" src={mark.src}
    alt="" width={24} height={24} unoptimized />
}
